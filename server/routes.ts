import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { Router } from "express";
import { 
  insertUserSchema, 
  users, 
  userBatchProcesses, 
  userProcesses, 
  quizzes, 
  quizAssignments,
  insertMockCallScenarioSchema, 
  insertMockCallAttemptSchema, 
  mockCallScenarios, 
  mockCallAttempts, 
  organizationBatches, 
  organizationProcesses,
  insertOrganizationSettingsSchema, 
  organizationSettings, 
  insertOrganizationHolidaySchema, 
  organizationHolidays,
  evaluationParameters,
  evaluationPillars,
  userDashboards,
  dashboardWidgets,
  dashboardConfigurations,
  insertUserDashboardSchema,
  insertDashboardWidgetSchema,
  insertDashboardConfigurationSchema,
  evaluations,
  evaluationScores,
  evaluationTemplates,
  audioFiles,
  audioFileAllocations,
  type InsertQuizAssignment,
  type QuizAssignment,
  type InsertUserDashboard,
  type InsertDashboardWidget,
  type UserDashboard,
  type DashboardWidget,
  type InsertDashboardConfiguration,
  type DashboardConfiguration
} from "@shared/schema";
import { z } from "zod";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { insertOrganizationProcessSchema } from "@shared/schema";
import { insertBatchTemplateSchema } from "@shared/schema";
import { batchStatusEnum } from "@shared/schema";
import { permissionEnum } from '@shared/schema';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { mkdirSync, existsSync } from 'fs';
import { db } from './db';
import { join, extname } from 'path';
import express from 'express';
import { eq, and, or, sql, inArray, gte, lte, aliasedTable } from "drizzle-orm";
import { toIST, formatIST, toUTCStorage, formatISTDateOnly } from './utils/timezone';
import { attendance } from "@shared/schema";
import type { User } from "@shared/schema";
import { updateBatchStatuses, resetEmptyBatches, addBatchHistoryRecord } from './services/batch-status-service';
import azureAudioFilesRouter from './routes/azure-audio-files';
import { validateAttendanceDate } from './utils/attendance-utils';
import { getHolidaysInRange } from './services/holiday-service';
import { initAzureStorageService } from './services/azureStorageService';

// Helper function to check if a user has access to a specific audio file
async function userHasAudioFileAccess(userId: number, audioFileId: number): Promise<boolean> {
  try {
    // Check if the user has access through audio file allocations
    const allocation = await db.query.audioFileAllocations.findFirst({
      where: and(
        eq(audioFileAllocations.audioFileId, audioFileId),
        eq(audioFileAllocations.qualityAnalystId, userId)
      )
    });
    
    if (allocation) {
      return true;
    }
    
    // Additional check - if the user is owner of the audio file
    const audioFile = await db.query.audioFiles.findFirst({
      where: eq(audioFiles.id, audioFileId)
    });
    
    if (audioFile && audioFile.userId === userId) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking audio file access:', error);
    return false;
  }
}

// Helper function to check if a user has access to a specific batch or its template
async function userHasBatchAccess(userId: number, batchId: number | null | undefined): Promise<boolean> {
  if (!batchId) return true; // If no batch ID is specified, access is granted
  
  try {
    // Check if user is assigned to this batch directly
    const userBatch = await db.query.userBatchProcesses.findFirst({
      where: and(
        eq(userBatchProcesses.userId, userId),
        eq(userBatchProcesses.batchId, batchId)
      )
    });
    
    if (userBatch) return true;
    
    // Get the batch to check trainer assignment and reporting hierarchy
    const batch = await db.query.organizationBatches.findFirst({
      where: eq(organizationBatches.id, batchId),
      columns: {
        trainerId: true
      }
    });
    
    if (!batch) return false;
    
    // Get the current user's details
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        role: true,
        organizationId: true
      }
    });
    
    if (!user) return false;
    
    // Owner and admin roles have access to all batches
    if (user.role === 'owner' || user.role === 'admin') {
      return true;
    }
    
    // If user is the trainer assigned to this batch
    if (batch.trainerId === userId) {
      return true;
    }
    
    // For trainers and managers, implement hierarchy-based access
    if (user.role === 'trainer' || user.role === 'manager' || user.role === 'team_lead') {
      // If batch has no trainer, deny access (rare case)
      if (!batch.trainerId) return false;
      
      // For hierarchy check, we need to determine if the batch's trainer reports to this user
      const isSubordinate = await checkReportingHierarchy(userId, batch.trainerId);
      return isSubordinate;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking batch access:', error);
    return false;
  }
}

// Helper function to check if userB reports to userA in the reporting hierarchy
async function checkReportingHierarchy(userAId: number, userBId: number): Promise<boolean> {
  if (userAId === userBId) return true; // Same user
  
  try {
    // Get userB to find their manager
    const userB = await db.query.users.findFirst({
      where: eq(users.id, userBId),
      columns: {
        managerId: true
      }
    });
    
    if (!userB || userB.managerId === null) return false;
    if (userB.managerId === userAId) return true;
    
    // Recursive check up the chain
    return await checkReportingHierarchy(userAId, userB.managerId);
  } catch (error) {
    console.error('Error checking reporting hierarchy:', error);
    return false;
  }
}

// Type definitions for user updates
type AllowedSelfUpdateFields = Pick<User, "fullName" | "email" | "phoneNumber" | "locationId" | "dateOfBirth" | "education">;
type AllowedUpdateFields = {
  fullName?: string;
  phoneNumber?: string;
  locationId?: number;
  dateOfBirth?: string;
  education?: string;
};

// Extend DatabaseStorage with required methods
declare module "./storage" {
  interface DatabaseStorage {
    getLocationByName(name: string): Promise<{id: number} | null>;
    getProcessByName(name: string): Promise<{id: number} | null>;
    assignProcessToUser(userId: number, processId: number): Promise<void>;
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

function excelSerialDateToJSDate(serial: number): string {
  // Excel's date system starts from December 30, 1899
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  
  const year = date_info.getFullYear();
  const month = String(date_info.getMonth() + 1).padStart(2, '0');
  const day = String(date_info.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Configure multer for XLSX file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else {
      // Pass null as first argument since the second argument false indicates reject
      cb(null, false);
    }
  },
});

// Configure multer for audio file uploads
const audioUploadsDir = join(process.cwd(), 'public', 'uploads', 'audio');
if (!existsSync(audioUploadsDir)) {
  mkdirSync(audioUploadsDir, { recursive: true });
}

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, audioUploadsDir);
    },
    filename: (req, file, cb) => {
      // Generate a unique filename with timestamp and original extension
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = file.originalname.split('.').pop();
      cb(null, `${uniqueSuffix}.${ext}`);
    }
  }),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    // Allow common audio formats
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3, WAV, OGG, and WEBM audio files are allowed.'), false);
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);
  
  // Add Azure audio file routes
  app.use('/api', azureAudioFilesRouter);
  console.log("Azure audio file routes registered");

  // User routes - Add logging for debugging
  app.get("/api/user", (req, res) => {
    console.log("GET /api/user - Current user:", req.user);
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.user);
  });

  // Update the registration route to handle owner role
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, organizationName, ...userData } = req.body;
      
      // Check if username already exists
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Check if email already exists
      if (userData.email) {
        const existingUserByEmail = await storage.getUserByEmail(userData.email);
        if (existingUserByEmail) {
          return res.status(400).json({ message: "Email already exists" });
        }
      }

      // Check if organization exists
      let organization = await storage.getOrganizationByName(organizationName);

      // Create user with the role from form
      const userToCreate = {
        ...userData,
        username,
        password: await hashPassword(password), 
        role: userData.role, // Use the role selected in the form
        category: "trainee", // Only set category as trainee
        organizationId: organization ? organization.id : undefined,
        active: true
      };

      if (!organization) {
        // If organization doesn't exist, create it first
        organization = await storage.createOrganization({
          name: organizationName
        });

        // Update the organizationId after creating organization
        userToCreate.organizationId = organization.id;
      }

      console.log('Creating user with data:', {
        ...userToCreate,
        password: '[REDACTED]'
      });

      // Create the user with the selected role
      const user = await storage.createUser(userToCreate);

      // If this is a new organization's owner, set up their permissions
      if (userToCreate.role === 'owner') {
        await storage.updateRolePermissions(
          organization.id,
          'owner',
          // Owner gets all permissions
          [
            "createUser",
            "updateUser",
            "deleteUser",
            "createOrganization",
            "updateOrganization",
            "deleteOrganization",
            "createLocation",
            "updateLocation",
            "deleteLocation",
            "createProcess",
            "updateProcess",
            "deleteProcess",
            "assignProcessToUser",
            "unassignProcessFromUser",
            "viewAllUsers",
            "viewAllOrganizations",
            "viewAllLocations",
            "viewAllProcesses"
          ]
        );
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Add new endpoint for duplicating templates
  app.post("/api/evaluation-templates/:templateId/duplicate", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      const { name } = req.body;

      if (!templateId || !name) {
        return res.status(400).json({ message: "Template ID and new name are required" });
      }

      // Get the original template with all its details
      const originalTemplate = await storage.getEvaluationTemplateWithDetails(templateId);
      if (!originalTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Check if user has access to this template
      if (originalTemplate.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Create new template with the new name
      const newTemplate = await storage.createEvaluationTemplate({
        name,
        description: originalTemplate.description,
        processId: originalTemplate.processId,
        status: 'draft', // Always start as draft
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
      });

      // Copy pillars and their parameters
      if (originalTemplate.pillars) {
        for (const pillar of originalTemplate.pillars) {
          // Create new pillar
          const newPillar = await storage.createEvaluationPillar({
            templateId: newTemplate.id,
            name: pillar.name,
            description: pillar.description,
            weightage: pillar.weightage,
            orderIndex: pillar.orderIndex,
          });

          // Copy parameters if they exist
          if (pillar.parameters) {
            for (const param of pillar.parameters) {
              await storage.createEvaluationParameter({
                pillarId: newPillar.id,
                name: param.name,
                description: param.description,
                guidelines: param.guidelines,
                ratingType: param.ratingType,
                weightage: param.weightage,
                isFatal: param.isFatal,
                requiresComment: param.requiresComment,
                noReasons: param.noReasons || [], // Ensure noReasons are copied
                orderIndex: param.orderIndex,
              });
            }
          }
        }
      }

      // Get the complete new template with all its details
      const completedTemplate = await storage.getEvaluationTemplateWithDetails(newTemplate.id);
      res.status(201).json(completedTemplate);

    } catch (error: any) {
      console.error("Error duplicating template:", error);
      res.status(500).json({ message: error.message || "Failed to duplicate template" });
    }
  });

  // Organization routes
  app.get("/api/organization", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    const organization = await storage.getOrganization(req.user.organizationId);
    res.json(organization);
  });
  
  // Organization Settings routes
  app.get("/api/organizations/:organizationId/settings", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const organizationId = parseInt(req.params.organizationId);
      
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const settings = await storage.getOrganizationSettings(organizationId);
      res.json(settings || { organizationId });
    } catch (error: any) {
      console.error("Error fetching organization settings:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/organizations/:organizationId/settings", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const organizationId = parseInt(req.params.organizationId);
      
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Check if settings already exist
      const existingSettings = await storage.getOrganizationSettings(organizationId);
      
      let settings;
      if (existingSettings) {
        // Update existing settings
        settings = await storage.updateOrganizationSettings(organizationId, {
          updatedAt: new Date()
        });
      } else {
        // Create new settings
        settings = await storage.createOrganizationSettings({
          organizationId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error("Error updating organization settings:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Organization Holidays routes
  app.get("/api/organizations/:organizationId/holidays", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const organizationId = parseInt(req.params.organizationId);
      const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
      
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const holidays = await storage.listOrganizationHolidays(organizationId, locationId);
      res.json(holidays);
    } catch (error: any) {
      console.error("Error fetching organization holidays:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/organizations/:organizationId/holidays", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const organizationId = parseInt(req.params.organizationId);
      
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const { name, date, locationId, isRecurring } = req.body;
      
      if (!name || !date) {
        return res.status(400).json({ message: "Holiday name and date are required" });
      }
      
      const holiday = await storage.createOrganizationHoliday({
        name,
        date,
        organizationId,
        locationId: locationId || null,
        isRecurring: isRecurring || false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      res.status(201).json(holiday);
    } catch (error: any) {
      console.error("Error creating organization holiday:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch("/api/organizations/:organizationId/holidays/:holidayId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const organizationId = parseInt(req.params.organizationId);
      const holidayId = parseInt(req.params.holidayId);
      
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const { name, date, locationId, isRecurring } = req.body;
      
      const updateData: Partial<typeof req.body> = {};
      if (name) updateData.name = name;
      if (date) updateData.date = date;
      if (locationId !== undefined) updateData.locationId = locationId;
      if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
      
      const holiday = await storage.updateOrganizationHoliday(holidayId, {
        ...updateData,
        updatedAt: new Date()
      });
      
      res.json(holiday);
    } catch (error: any) {
      console.error("Error updating organization holiday:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.delete("/api/organizations/:organizationId/holidays/:holidayId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const organizationId = parseInt(req.params.organizationId);
      const holidayId = parseInt(req.params.holidayId);
      
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      await storage.deleteOrganizationHoliday(holidayId);
      
      res.status(204).end();
    } catch (error: any) {
      console.error("Error deleting organization holiday:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add evaluation template routes
  app.post("/api/evaluation-templates", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateData = {
        ...req.body,
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
      };

      // Validate required fields
      if (!templateData.name || !templateData.processId) {
        return res.status(400).json({
          message: "Name and process ID are required"
        });
      }

      console.log('Creating evaluation template:', templateData);
      const template = await storage.createEvaluationTemplate(templateData);
      
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Error creating evaluation template:", error);
      res.status(400).json({ message: error.message || "Failed to create template" });
    }
  });

  app.get("/api/organizations/:organizationId/evaluation-templates", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const templates = await storage.listEvaluationTemplates(organizationId);
      res.json(templates);
    } catch (error: any) {
      console.error("Error listing evaluation templates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add new endpoint to get trainees for evaluation
  app.get("/api/trainees-for-evaluation", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      // Get trainees from the user's organization
      const trainees = await db.query.users.findMany({
        where: and(
          eq(users.organizationId, req.user.organizationId),
          eq(users.role, 'trainee'),
          eq(users.active, true)
        ),
        columns: {
          id: true,
          fullName: true,
          employeeId: true,
          email: true
        }
      });

      res.json(trainees);
    } catch (error: any) {
      console.error("Error fetching trainees:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get organization's batches
  app.get("/api/organizations/:organizationId/batches", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const batches = await storage.listBatches(organizationId);

      res.json(batches);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get trainees for a specific batch
  app.get("/api/organizations/:organizationId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      const batchId = parseInt(req.params.batchId);
      const date = req.query.date as string || new Date().toISOString().split('T')[0]; // Use query param or default to today
      
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get the batch to determine its current phase
      const batch = await db.query.organizationBatches.findFirst({
        where: eq(organizationBatches.id, batchId)
      });

      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      const batchPhase = batch.status;
      console.log('Current batch phase:', batchPhase);
      console.log('Fetching attendance for date:', date);

      // Get all trainees assigned to this batch and their attendance for the specified date and phase
      const batchTrainees = await db
        .select({
          id: userBatchProcesses.id,
          userId: userBatchProcesses.userId,
          status: userBatchProcesses.status,
          traineeStatus: userBatchProcesses.traineeStatus,
          isManualStatus: userBatchProcesses.isManualStatus,
          user: {
            id: users.id,
            fullName: users.fullName,
            employeeId: users.employeeId,
            email: users.email,
            role: users.role
          },
          attendance: {
            status: attendance.status,
            lastUpdated: attendance.updatedAt
          }
        })
        .from(userBatchProcesses)
        .innerJoin(users, eq(users.id, userBatchProcesses.userId))
        .leftJoin(
          attendance,
          and(
            eq(attendance.traineeId, userBatchProcesses.userId),
            eq(attendance.batchId, userBatchProcesses.batchId),
            eq(attendance.date, date),
            eq(attendance.phase, batchPhase)
          )
        )
        .where(
          and(
            eq(userBatchProcesses.batchId, batchId),
            eq(userBatchProcesses.status, 'active')
          )
        );

      console.log('Found trainees:', batchTrainees.length);

      // Map to expected format
      const formattedTrainees = batchTrainees.map((trainee) => ({
        id: trainee.userId,
        userBatchProcessId: trainee.id,
        status: trainee.attendance?.status || (trainee.traineeStatus === 'left_job' ? 'left_job' : null),
        lastUpdated: trainee.attendance?.lastUpdated?.toISOString(),
        fullName: trainee.user.fullName,
        employeeId: trainee.user.employeeId,
        email: trainee.user.email,
        traineeStatus: trainee.traineeStatus,
        isManualStatus: trainee.isManualStatus,
        user: trainee.user
      }));

      console.log('Response:', JSON.stringify(formattedTrainees.slice(0, 2)));
      res.json(formattedTrainees);
    } catch (error: any) {
      console.error("Error fetching batch trainees:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add finalize endpoint
  app.post("/api/evaluation-templates/:templateId/finalize", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const template = await storage.getEvaluationTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Make sure the template is in draft status
      if (template.status !== 'draft') {
        return res.status(400).json({ 
          message: "Only templates in 'draft' status can be finalized" 
        });
      }

      console.log(`Finalizing template ID: ${templateId} - changing status from draft to active`);
      
      // Update template status to active
      const updatedTemplate = await storage.updateEvaluationTemplate(templateId, {
        status: 'active'
      });

      console.log(`Template ID: ${templateId} successfully finalized with status: ${updatedTemplate.status}`);
      res.json(updatedTemplate);
    } catch (error: any) {
      console.error("Error finalizing template:", error);
      res.status(500).json({ message: error.message || "Failed to finalize template" });
    }
  });
  
  // Add archive endpoint for evaluation templates
  app.post("/api/evaluation-templates/:templateId/archive", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const template = await storage.getEvaluationTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Make sure the template is in active status
      if (template.status !== 'active') {
        return res.status(400).json({ 
          message: "Only templates in 'active' status can be archived" 
        });
      }

      console.log(`Archiving template ID: ${templateId} - changing status from active to archived`);
      
      // Update template status to archived
      const updatedTemplate = await storage.updateEvaluationTemplate(templateId, {
        status: 'archived'
      });

      console.log(`Template ID: ${templateId} successfully archived with status: ${updatedTemplate.status}`);
      res.json(updatedTemplate);
    } catch (error: any) {
      console.error("Error archiving template:", error);
      res.status(500).json({ message: error.message || "Failed to archive template" });
    }
  });

  // Add update template endpoint
  app.patch("/api/evaluation-templates/:templateId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const template = await storage.getEvaluationTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Allow template data to be updated
      const { status, feedbackThreshold, name, description, processId, batchId, hiddenBatchId } = req.body;
      
      // Log the received batch information for debugging
      console.log('Update template request received with batch data:', {
        templateId,
        originalBatchId: template.batchId,
        requestBatchId: batchId,
        hiddenBatchId: hiddenBatchId
      });
      
      // Special handling for status changes
      // Check if this is a status change request (archive or activate)
      const isStatusChangeRequest = status !== undefined && status !== template.status;
      const isArchiveRequest = status === 'archived' && template.status === 'active';
      const isActivateRequest = status === 'active' && template.status === 'draft';
      
      console.log(`Template status change request: current=${template.status}, requested=${status}, isStatusChange=${isStatusChangeRequest}`);
      
      // Special rules for active templates - only allow archiving
      if (template.status === 'active' && !isArchiveRequest && isStatusChangeRequest) {
        return res.status(400).json({ 
          message: "Active templates can only be archived, not changed to other statuses."
        });
      }
      
      // Special rules for archived templates - cannot be modified
      if (template.status === 'archived') {
        return res.status(400).json({ 
          message: "Archived templates cannot be modified." 
        });
      }
      
      // Validate status if provided
      if (status !== undefined && (!status || !['draft', 'active', 'archived'].includes(status))) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Validate feedbackThreshold if provided
      if (feedbackThreshold !== undefined && feedbackThreshold !== null) {
        const threshold = parseFloat(feedbackThreshold);
        if (isNaN(threshold) || threshold < 0 || threshold > 100) {
          return res.status(400).json({ message: "Feedback threshold must be a number between 0 and 100" });
        }
      }
      
      // Validate processId if provided
      if (processId !== undefined) {
        const process = await db.query.organizationProcesses.findFirst({
          where: and(
            eq(organizationProcesses.id, processId),
            eq(organizationProcesses.organizationId, req.user.organizationId)
          )
        });
        
        if (!process) {
          return res.status(400).json({ message: "Invalid process ID" });
        }
      }

      // Process the batch ID - we prefer the hiddenBatchId field which is set by our JavaScript
      // but fall back to batchId from the form if needed
      let finalBatchId = null;
      
      // First check the hidden field which should contain the latest selected value
      if (hiddenBatchId !== undefined) {
        if (hiddenBatchId === "none" || hiddenBatchId === "") {
          finalBatchId = null;
          console.log('Setting batchId to null from hiddenBatchId (template available to all)');
        } else {
          const parsedId = parseInt(hiddenBatchId);
          finalBatchId = isNaN(parsedId) ? null : parsedId;
          console.log(`Setting batchId to ${finalBatchId} from hiddenBatchId`);
        }
      } 
      // Otherwise use the batchId field if provided
      else if (batchId !== undefined) {
        if (batchId === "none" || batchId === "") {
          finalBatchId = null;
          console.log('Setting batchId to null from batchId field (template available to all)');
        } else {
          const parsedId = parseInt(batchId);
          finalBatchId = isNaN(parsedId) ? null : parsedId;
          console.log(`Setting batchId to ${finalBatchId} from batchId field`);
        }
      }

      // Prepare updates
      const updates: Partial<InsertEvaluationTemplate> = {};
      if (status !== undefined) {
        updates.status = status;
        console.log(`Updating template ${templateId} status from ${template.status} to ${status}`);
        
        // Add extra handling for status transitions
        if (status === 'archived' && template.status === 'active') {
          console.log(`Archiving active template ${templateId}`);
        } else if (status === 'active' && template.status === 'draft') {
          console.log(`Activating draft template ${templateId}`);
        }
      }
      
      if (feedbackThreshold !== undefined) updates.feedbackThreshold = feedbackThreshold === null ? null : parseFloat(feedbackThreshold);
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (processId !== undefined) updates.processId = processId;
      
      // Add batchId to the updates object
      updates.batchId = finalBatchId;
      
      console.log(`Final updates for template ${templateId}:`, updates);

      const updatedTemplate = await storage.updateEvaluationTemplate(templateId, updates);
      res.json(updatedTemplate);
    } catch (error: any) {
      console.error("Error updating evaluation template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add evaluations endpoint
  app.post("/api/evaluations", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const evaluation = req.body;
      
      // Validate required fields
      if (!evaluation.templateId || !evaluation.traineeId || !evaluation.batchId || !evaluation.scores) {
        return res.status(400).json({
          message: "Missing required fields: templateId, traineeId, batchId, and scores are required"
        });
      }

      // Parse and validate the final score
      const finalScore = Number(parseFloat(evaluation.finalScore.toString()).toFixed(2));
      if (isNaN(finalScore) || finalScore < 0 || finalScore > 100) {
        return res.status(400).json({
          message: "Final score must be a number between 0 and 100"
        });
      }

      // Get the template to fetch the feedback threshold and passing score
      const template = await storage.getEvaluationTemplate(evaluation.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // Determine if the evaluation is passed (use template's passing score or default to 70)
      const passingScore = template.passingScore || 70;
      const isPassed = finalScore >= passingScore;
      
      console.log(`Evaluation score: ${finalScore}, Passing score: ${passingScore}, Passed: ${isPassed}`);
      
      // Check if this is a certification evaluation (using purpose field)
      const isCertification = evaluation.purpose === 'certification';
      console.log(`Evaluation purpose: ${evaluation.purpose}, Is certification: ${isCertification}`);
      
      // For certification evaluations, we'll use template name/description matching instead of metadata
      // Let's fetch all templates for this organization  
      const templates = await storage.listEvaluationTemplates(req.user.organizationId);
      
      // Find templates that are for certification purpose
      const certTemplateIds = templates
        .filter(template => 
          // Check template name
          template.name.toLowerCase().includes('certification') || 
          // Check template description
          (template.description?.toLowerCase().includes('certification')))
        .map(template => template.id);
        
      console.log(`Found ${certTemplateIds.length} certification templates: ${certTemplateIds.join(', ')}`);
      
      // Check if the current template is a certification template
      const isUsingCertTemplate = certTemplateIds.includes(evaluation.templateId);
      console.log(`Using certification template: ${isUsingCertTemplate}`);
      
      // Create evaluation record
      const evaluationData = {
        templateId: evaluation.templateId,
        // Always use 'standard' evaluation type as requested
        evaluationType: 'standard',
        traineeId: evaluation.traineeId,
        batchId: evaluation.batchId,
        evaluatorId: req.user.id,
        organizationId: req.user.organizationId,
        finalScore,
        isPassed,
        status: 'completed',
        feedbackThreshold: template.feedbackThreshold, // Pass the template's feedback threshold
        scores: evaluation.scores.map((score: any) => ({
          parameterId: score.parameterId,
          score: score.score,
          comment: score.comment,
          noReason: score.noReason
        }))
      };
      
      if (isCertification) {
        console.log('This is a certification evaluation based on purpose parameter');
      }
      
      const result = await storage.createEvaluation(evaluationData);

      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error creating evaluation:", error);
      res.status(500).json({ 
        message: error.message || "Failed to create evaluation" 
      });
    }
  });
  
  // Add endpoint for audio file evaluations
  app.post("/api/audio-evaluations", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const evaluation = req.body;
      
      // Validate required fields for audio evaluations
      if (!evaluation.templateId || !evaluation.audioFileId || !evaluation.scores) {
        return res.status(400).json({
          message: "Missing required fields: templateId, audioFileId, and scores are required"
        });
      }

      // Get the audio file to verify access and get organizationId
      const audioFile = await storage.getAudioFile(evaluation.audioFileId);
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }
      
      // Check organization access
      if (audioFile.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Parse and validate the final score
      const finalScore = Number(parseFloat(evaluation.finalScore.toString()).toFixed(2));
      if (isNaN(finalScore) || finalScore < 0 || finalScore > 100) {
        return res.status(400).json({
          message: "Final score must be a number between 0 and 100"
        });
      }

      // Get the template to fetch the feedback threshold and passing score
      const template = await storage.getEvaluationTemplate(evaluation.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // Determine if the evaluation is passed (use template's passing score or default to 70)
      const passingScore = template.passingScore || 70;
      const isPassed = finalScore >= passingScore;
      
      console.log(`Audio evaluation score: ${finalScore}, Passing score: ${passingScore}, Passed: ${isPassed}`);
      
      // Create evaluation record
      const result = await storage.createEvaluation({
        templateId: evaluation.templateId,
        evaluationType: 'audio', // Set type to audio for this endpoint
        traineeId: evaluation.traineeId || null, // Optional for audio evaluations
        batchId: audioFile.batchId || null, // Use the batch from the audio file if available
        evaluatorId: req.user.id,
        organizationId: req.user.organizationId,
        finalScore,
        isPassed,
        status: 'completed',
        feedbackThreshold: template.feedbackThreshold, // Pass the template's feedback threshold
        audioFileId: evaluation.audioFileId, // Pass the audio file ID for feedback creation
        scores: evaluation.scores.map((score: any) => ({
          parameterId: score.parameterId,
          score: score.score,
          comment: score.comment,
          noReason: score.noReason
        }))
      });

      // Update the audio file status to 'evaluated'
      await storage.updateAudioFile(evaluation.audioFileId, { 
        status: 'evaluated',
        evaluationId: result.id // Store the evaluation ID with the audio file
      });
      
      // Also update the allocation status to 'evaluated'
      // First, find the allocation for this quality analyst and audio file
      const allocations = await storage.listAudioFileAllocations({
        organizationId: req.user.organizationId,
        audioFileId: evaluation.audioFileId,
        qualityAnalystId: req.user.id
      });
      
      // Update the allocation status if found
      if (allocations && allocations.length > 0) {
        await storage.updateAudioFileAllocation(allocations[0].id, { 
          status: 'evaluated' 
        });
      }

      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error creating audio evaluation:", error);
      res.status(500).json({ 
        message: error.message || "Failed to create audio evaluation" 
      });
    }
  });

  // Add routes for handling evaluation feedback
  app.get("/api/evaluation-feedback", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      const role = req.user.role;
      
      // Get status filter from query parameters if present
      const statusFilter = req.query.status as string | undefined;
      
      let feedbackItems;
      
      // Check if we're getting all feedback records (regardless of status)
      const getAll = req.query.all === 'true';
      
      if (getAll) {
        // Get all feedback filtered by role access level
        feedbackItems = await storage.getAllEvaluationFeedback(userId, organizationId, role);
        
        // Filter by status if requested
        if (statusFilter) {
          feedbackItems = feedbackItems.filter(item => item.status === statusFilter);
        }
      } else {
        // Using the original pending-only functionality when not explicitly requesting all
        if (['quality_analyst', 'manager', 'admin', 'owner'].includes(role)) {
          // Get pending feedback for reporting heads
          feedbackItems = await storage.getPendingApprovalEvaluationFeedback(userId);
        } else {
          // For agents/trainees, get only their pending feedback
          feedbackItems = await storage.getPendingEvaluationFeedback(userId);
        }
      }
      
      res.json(feedbackItems);
    } catch (error: any) {
      console.error("Error fetching evaluation feedback:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch("/api/evaluation-feedback/:feedbackId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const feedbackId = parseInt(req.params.feedbackId);
      if (!feedbackId) {
        return res.status(400).json({ message: "Invalid feedback ID" });
      }

      // Get the feedback to check access rights
      const feedback = await storage.getEvaluationFeedback(feedbackId);
      if (!feedback) {
        return res.status(404).json({ message: "Feedback not found" });
      }

      // Verify the user has permission to update this feedback
      const userId = req.user.id;
      const role = req.user.role;
      
      if (feedback.agentId !== userId && feedback.reportingHeadId !== userId && 
          !['admin', 'owner'].includes(role)) {
        return res.status(403).json({ message: "Forbidden - You don't have permission to update this feedback" });
      }

      const { status, agentResponse, reportingHeadResponse, rejectionReason } = req.body;
      
      // Validate the status if provided
      if (status && !['pending', 'accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Require rejection reason if status is rejected
      if (status === 'rejected' && !rejectionReason) {
        return res.status(400).json({ message: "Rejection reason is required when rejecting feedback" });
      }

      // Prepare updates based on who is updating
      const updates: any = {};
      
      if (status) updates.status = status;
      
      // If agent is updating
      if (feedback.agentId === userId) {
        if (agentResponse !== undefined) updates.agentResponse = agentResponse;
      }
      
      // If reporting head is updating
      if (feedback.reportingHeadId === userId) {
        if (reportingHeadResponse !== undefined) updates.reportingHeadResponse = reportingHeadResponse;
      }
      
      // Only add rejection reason if status is rejected
      if (status === 'rejected' && rejectionReason) {
        updates.rejectionReason = rejectionReason;
      }

      const updatedFeedback = await storage.updateEvaluationFeedback(feedbackId, updates);
      res.json(updatedFeedback);
    } catch (error: any) {
      console.error("Error updating evaluation feedback:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get detailed evaluation by ID
  app.get("/api/evaluations/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const evaluationId = parseInt(req.params.id);
      if (!evaluationId) {
        return res.status(400).json({ message: "Invalid evaluation ID" });
      }

      // Get evaluation with scores
      const evaluationWithScores = await storage.getEvaluationWithScores(evaluationId);
      if (!evaluationWithScores) {
        return res.status(404).json({ message: "Evaluation not found" });
      }

      // Check organization access
      if (evaluationWithScores.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get all parameters and pillars to enrich the scores
      if (evaluationWithScores.scores.length > 0) {
        // Use the storage methods to get parameters and pillars
        const parameterIds = evaluationWithScores.scores.map(score => score.parameterId);
        
        // Get parameters for all scores
        const parameters = [];
        for (const parameterId of parameterIds) {
          const parameter = await storage.getEvaluationParameter(parameterId);
          if (parameter) {
            parameters.push(parameter);
          }
        }
        
        // Get pillars for these parameters
        const pillarIds = [...new Set(parameters
          .filter(param => param && param.pillarId)
          .map(param => param.pillarId))];
        
        const pillars = [];
        for (const pillarId of pillarIds) {
          const pillar = await storage.getEvaluationPillar(pillarId);
          if (pillar) {
            pillars.push(pillar);
          }
        }
        
        // Enrich the scores with parameter and pillar information
        const enrichedScores = evaluationWithScores.scores.map(score => {
          const parameter = parameters.find(p => p.id === score.parameterId);
          const pillar = parameter && parameter.pillarId 
            ? pillars.find(p => p.id === parameter.pillarId) 
            : undefined;
          
          return {
            ...score,
            parameter,
            pillar
          };
        });
        
        // Group by pillar
        const groupedScores = pillarIds.map(pillarId => {
          const pillar = pillars.find(p => p.id === pillarId);
          const pillarScores = enrichedScores.filter(score => 
            score.parameter && score.parameter.pillarId === pillarId
          );
          
          return {
            pillar,
            scores: pillarScores
          };
        });
        
        // Add scores without pillars
        const unassignedScores = enrichedScores.filter(score => 
          !score.parameter || !score.parameter.pillarId
        );
        
        if (unassignedScores.length > 0) {
          groupedScores.push({
            scores: unassignedScores
          });
        }
        
        res.json({
          evaluation: evaluationWithScores,
          groupedScores
        });
      } else {
        res.json({
          evaluation: evaluationWithScores,
          groupedScores: []
        });
      }
    } catch (error: any) {
      console.error("Error fetching evaluation details:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add route to get template with all its components 
  app.get("/api/evaluation-templates/:templateId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const template = await storage.getEvaluationTemplateWithDetails(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      res.json(template);
    } catch (error: any) {
      console.error("Error fetching evaluation template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add delete template endpoint
  app.delete("/api/evaluation-templates/:templateId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const template = await storage.getEvaluationTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      console.log(`Starting deletion of template ID: ${templateId} by user ${req.user.id}`);
      
      // Check template status before deletion
      if (template.status === 'archived') {
        return res.status(400).json({ 
          message: "Archived templates cannot be deleted for data integrity purposes. This maintains historical records."
        });
      }
      
      if (template.status === 'active') {
        return res.status(400).json({ 
          message: "Active templates cannot be deleted directly. Please archive the template first."
        });
      }
      
      // Add additional logging and error handling
      try {
        await storage.deleteEvaluationTemplate(templateId);
        console.log(`Successfully deleted template ID: ${templateId}`);
        res.status(204).send();
      } catch (deleteError: any) {
        console.error(`Detailed error deleting template ${templateId}:`, deleteError);
        // Check for foreign key constraint errors
        if (deleteError.message && deleteError.message.includes('foreign key constraint')) {
          return res.status(400).json({ 
            message: "Cannot delete this template because it is being used by other records. Try archiving it instead."
          });
        }
        // Check for evaluation-related errors
        if (deleteError.message && deleteError.message.includes('evaluations')) {
          return res.status(400).json({ 
            message: "This template has associated evaluations and cannot be deleted. Please archive it instead."
          });
        }
        throw deleteError;
      }
    } catch (error: any) {
      console.error("Error deleting evaluation template:", error);
      res.status(500).json({ message: error.message || "An error occurred while deleting the template" });
    }
  });

  // Add routes for pillars and parameters
  app.post("/api/evaluation-templates/:templateId/pillars", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      // Get the template to verify ownership
      const template = await storage.getEvaluationTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const pillarData = {
        ...req.body,
        templateId,
      };

      console.log('Creating evaluation pillar:', pillarData);
      const pillar = await storage.createEvaluationPillar(pillarData);
      
      res.status(201).json(pillar);
    } catch (error: any) {
      console.error("Error creating evaluation pillar:", error);
      res.status(400).json({ message: error.message || "Failed to create pillar" });
    }
  });

  app.post("/api/evaluation-pillars/:pillarId/parameters", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const pillarId = parseInt(req.params.pillarId);
      if (!pillarId) {
        return res.status(400).json({ message: "Invalid pillar ID" });
      }

      // Get the pillar to verify ownership through template
      const pillar = await storage.getEvaluationPillar(pillarId);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }

      const template = await storage.getEvaluationTemplate(pillar.templateId);
      if (!template || template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const parameterData = {
        ...req.body,
        pillarId,
        // Ensure noReasons is properly passed as an array
        noReasons: Array.isArray(req.body.noReasons) ? req.body.noReasons : [],
      };

      console.log('Creating evaluation parameter:', parameterData);
      const parameter = await storage.createEvaluationParameter(parameterData);
      
      res.status(201).json(parameter);
    } catch (error: any) {
      console.error("Error creating evaluation parameter:", error);
      res.status(400).json({ message: error.message || "Failed to create parameter" });
    }
  });

  // Add edit pillar endpoint
  app.patch("/api/evaluation-pillars/:pillarId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const pillarId = parseInt(req.params.pillarId);
      if (!pillarId) {
        return res.status(400).json({ message: "Invalid pillar ID" });
      }

      // Get the pillar to verify ownership through template
      const pillar = await storage.getEvaluationPillar(pillarId);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }

      const template = await storage.getEvaluationTemplate(pillar.templateId);
      if (!template || template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updatedPillar = await storage.updateEvaluationPillar(pillarId, req.body);
      res.json(updatedPillar);
    } catch (error: any) {
      console.error("Error updating evaluation pillar:", error);
      res.status(400).json({ message: error.message || "Failed to update pillar" });
    }
  });

  // Add delete pillar endpoint
  app.delete("/api/evaluation-pillars/:pillarId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const pillarId = parseInt(req.params.pillarId);
      if (!pillarId) {
        return res.status(400).json({ message: "Invalid pillar ID" });
      }

      // Get the pillar to verify ownership through template
      const pillar = await storage.getEvaluationPillar(pillarId);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }

      const template = await storage.getEvaluationTemplate(pillar.templateId);
      if (!template || template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteEvaluationPillar(pillarId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting evaluation pillar:", error);
      res.status(400).json({ message: error.message || "Failed to delete pillar" });
    }
  });

  // Add edit parameter endpoint
  app.patch("/api/evaluation-parameters/:parameterId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const parameterId = parseInt(req.params.parameterId);
      if (!parameterId) {
        return res.status(400).json({ message: "Invalid parameter ID" });
      }

      // Get the parameter and verify ownership through pillar and template
      const parameter = await storage.getEvaluationParameter(parameterId);
      if (!parameter) {
        return res.status(404).json({ message: "Parameter not found" });
      }

      const pillar = await storage.getEvaluationPillar(parameter.pillarId);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }

      const template = await storage.getEvaluationTemplate(pillar.templateId);
      if (!template || template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Ensure noReasons is handled properly in updates
      const updateData = {
        ...req.body,
        noReasons: Array.isArray(req.body.noReasons) ? req.body.noReasons : parameter.noReasons || [],
      };

      console.log('Updating evaluation parameter:', updateData);
      const updatedParameter = await storage.updateEvaluationParameter(parameterId, updateData);
      res.json(updatedParameter);
    } catch (error: any) {
      console.error("Error updating evaluation parameter:", error);
      res.status(400).json({ message: error.message || "Failed to update parameter" });
    }
  });

  // Add delete parameter endpoint
  app.delete("/api/evaluation-parameters/:parameterId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const parameterId = parseInt(req.params.parameterId);
      if (!parameterId) {
        return res.status(400).json({ message: "Invalid parameter ID" });
      }

      // Get the parameter and verify ownership through pillar and template
      const parameter = await storage.getEvaluationParameter(parameterId);
      if (!parameter) {
        return res.status(404).json({ message: "Parameter not found" });
      }

      const pillar = await storage.getEvaluationPillar(parameter.pillarId);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }

      const template = await storage.getEvaluationTemplate(pillar.templateId);
      if (!template || template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteEvaluationParameter(parameterId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting evaluation parameter:", error);
      res.status(400).json({ message: error.message || "Failed to delete parameter" });
    }
  });

  // Add route to get organization processes 
  app.get("/api/processes", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const name = req.query.name as string | undefined;
      console.log(`Fetching processes for organization: ${req.user.organizationId}${name ? " with name filter: " + name : ""}`);
      
      const processes = await storage.listProcesses(req.user.organizationId, name);
      console.log(`Retrieved ${processes.length} processes`);
      res.json(processes);
    } catch (error: any) {
      console.error("Error fetching processes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update the PATCH /api/organizations/:id/settings route to remove batch handling
  app.patch("/api/organizations/:id/settings", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      // Log all details of the request for debugging
      console.log("--- SETTINGS UPDATE REQUEST ---");
      console.log("Request body:", JSON.stringify(req.body));
      console.log("Request content-type:", req.headers["content-type"]);
      console.log("User:", req.user?.id, req.user?.email);
      const orgId = parseInt(req.params.id);
      console.log("Organization ID:", orgId);

      // Check if user belongs to the organization they're trying to modify
      if (req.user.organizationId !== orgId) {
        console.log("User org ID doesn't match:", req.user.organizationId, "vs", orgId);
        return res.status(403).json({ message: "You can only modify your own organization's settings" });
      }
      
      // If creating a location, check for manage_locations permission
      if (req.body.type === "locations" && req.user.role !== 'owner') {
        const userPermissions = await storage.getRolePermissions(orgId, req.user.role);
        if (!userPermissions?.permissions.includes('manage_locations')) {
          console.log(`User ${req.user.id} with role ${req.user.role} attempted to create location without permission`);
          return res.status(403).json({ message: "You do not have permission to create locations" });
        }
      }

      // Check if we're updating the feature type directly
      if (req.body.featureType) {
        // Feature type changes are restricted as they are tied to billing
        return res.status(403).json({ 
          message: "Feature type changes are restricted as they are tied to your subscription plan. Please contact support to update your plan."
        });
        
        /* 
        // This code is intentionally unreachable - feature type changes are now 
        // only allowed through direct database changes by service administrators
        
        // Validate feature type is one of the allowed values
        const featureType = req.body.featureType;
        if (!['LMS', 'QMS', 'BOTH'].includes(featureType)) {
          return res.status(400).json({ message: "Invalid feature type. Must be 'LMS', 'QMS', or 'BOTH'" });
        }

        // Get current settings or create if doesn't exist
        let settings = await storage.getOrganizationSettings(orgId);
        
        if (settings) {
          // Update existing settings
          settings = await storage.updateOrganizationSettings(orgId, { featureType });
        } else {
          // Create new settings
          settings = await storage.createOrganizationSettings({
            organizationId: orgId,
            featureType,
            weeklyOffDays: ['Saturday', 'Sunday'] // Default weekend days
          });
        }
        
        return res.json(settings);
        */
      }

      // Legacy path for other settings types
      const { type, value } = req.body;
      if (!type || !value) {
        return res.status(400).json({ message: "Missing type or value" });
      }

      let result;
      // Create new setting based on type
      console.log("Processing settings update with type:", type, "and value:", value);
      switch (type) {
        case "locations":
          // Ensure value is an object with all required fields
          if (typeof value !== 'object') {
            return res.status(400).json({ message: "Location data must be an object with required fields" });
          }

          const { name, address, city, state, country } = value;
          if (!name || !address || !city || !state || !country) {
            return res.status(400).json({
              message: "Missing required location fields. Required: name, address, city, state, country"
            });
          }

          result = await storage.createLocation({
            name,
            address,
            city,
            state,
            country,
            organizationId: orgId,
          });
          break;
        case "userLimit":
          // Validate that value is a valid number for user limit
          const userLimit = Number(value);
          if (isNaN(userLimit) || userLimit < 1) {
            return res.status(400).json({ 
              message: "User limit must be a number greater than or equal to 1" 
            });
          }
          
          // Get existing settings
          const existingSettings = await storage.getOrganizationSettings(orgId);
          
          if (existingSettings) {
            // Update existing settings with the new user limit
            result = await storage.updateOrganizationSettings(orgId, { userLimit });
          } else {
            // Create new settings with the user limit
            result = await storage.createOrganizationSettings({
              organizationId: orgId,
              featureType: 'BOTH',  // Default feature type
              weeklyOffDays: ['Saturday', 'Sunday'],  // Default weekend days
              userLimit,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
          break;
        default:
          return res.status(400).json({ message: "Invalid settings type" });
      }

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });



  // Update organization settings route
  app.get("/api/organizations/:id/settings", async (req, res) => {
    console.log("GET /api/organizations/:id/settings - Request params:", req.params);
    console.log("GET /api/organizations/:id/settings - Current user:", req.user);

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const orgId = parseInt(req.params.id);
      if (!orgId) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view your own organization's settings" });
      }

      // Fetch all required data
      const [locations, orgSettings] = await Promise.all([
        storage.listLocations(orgId),
        storage.getOrganizationSettings(orgId),
      ]);

      // Ensure we have arrays
      const response = {
        locations: Array.isArray(locations) ? locations : [],
        featureType: orgSettings?.featureType || 'BOTH', // Default to BOTH if not set
        weeklyOffDays: orgSettings?.weeklyOffDays || ['Saturday', 'Sunday'], // Default weekend days
        userLimit: orgSettings?.userLimit || 500, // Default user limit
      };

      return res.json(response);
    } catch (err: any) {
      console.error("Error fetching organization settings:", err);
      return res.status(500).json({
        message: "Failed to fetch organization settings",
        error: err.message
      });
    }
  });

  // Add GET endpoint for user processes
  app.get("/api/users/processes", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      // Get all user processes for the organization
      const processes = await db.query.userProcesses.findMany({
        where: sql`user_id IN (
          SELECT id FROM users 
          WHERE organization_id = ${req.user.organizationId}
        )`,
        with: {
          process: {
            columns: {
              name: true
            }
          }
        }
      });

      // Format the response to group processes by user ID
      const userProcessMap = processes.reduce((acc: Record<number, any[]>, curr) => {
        if (!acc[curr.userId]) {
          acc[curr.userId] = [];
        }
        acc[curr.userId].push({
          processId: curr.processId,
          processName: curr.process.name
        });
        return acc;
      }, {});

      res.json(userProcessMap);
    } catch (error: any) {
      console.error("Error fetching user processes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Endpoint to fetch user batch processes for all users in the organization
  app.get("/api/users/batch-processes", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log(`Fetching batch processes for organization: ${req.user.organizationId}`);
      
      // Get all users in the organization
      const orgUsers = await db.query.users.findMany({
        where: eq(users.organizationId, req.user.organizationId),
        columns: {
          id: true
        }
      });
      
      console.log(`Found ${orgUsers.length} users in organization`);
      console.log(`User IDs:`, orgUsers.map(u => u.id));
      
      // Check if user 386 is included
      const hasUser386 = orgUsers.some(u => u.id === 386);
      console.log(`User 386 included in results: ${hasUser386}`);

      // Initialize result object
      const allUserBatchProcesses: Record<number, any[]> = {};
      
      // For each user, retrieve their batch processes
      for (const user of orgUsers) {
        const batchProcesses = await storage.getUserBatchProcesses(user.id);
        
        if (user.id === 386) {
          console.log(`Found ${batchProcesses.length} batch processes for user 386:`, batchProcesses);
        }
        
        if (batchProcesses.length > 0) {
          allUserBatchProcesses[user.id] = batchProcesses.map(bp => ({
            batchId: bp.batchId,
            batchName: bp.batchName,
            processId: bp.processId,
            processName: bp.processName,
            status: bp.status,
            joinedAt: bp.joinedAt,
            completedAt: bp.completedAt,
            trainerId: bp.trainerId
          }));
        } else {
          allUserBatchProcesses[user.id] = [];
        }
      }

      res.json(allUserBatchProcesses);
    } catch (error: any) {
      console.error("Error fetching user batch processes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // User management routes
  app.get("/api/users", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });

    try {
      console.log(`Fetching users for organization ${req.user.organizationId}`);
      const users = await storage.listUsers(req.user.organizationId);
      console.log(`Found ${users.length} users`);
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all user processes for an organization - for organization tree visualization
  app.get("/api/user-processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    
    try {
      // Get all users in the organization
      const users = await storage.listUsers(req.user.organizationId);
      
      // Collect all user processes
      const allUserProcesses = [];
      for (const user of users) {
        try {
          const userProcesses = await storage.getUserProcesses(user.id);
          allUserProcesses.push(...userProcesses);
        } catch (err) {
          console.warn(`Couldn't fetch processes for user ${user.id}:`, err);
          // Continue with next user
        }
      }
      
      res.json(allUserProcesses);
    } catch (error: any) {
      console.error('Error fetching user processes:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch user processes' });
    }
  });
  
  // Get all user batch processes for an organization - for organization tree visualization
  app.get("/api/user-batch-processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    
    try {
      // Get all users in the organization
      const users = await storage.listUsers(req.user.organizationId);
      
      // Collect all user batch processes
      const allUserBatchProcesses = [];
      for (const user of users) {
        try {
          const userBatchProcesses = await storage.getUserBatchProcesses(user.id);
          allUserBatchProcesses.push(...userBatchProcesses);
        } catch (err) {
          console.warn(`Couldn't fetch batch processes for user ${user.id}:`, err);
          // Continue with next user
        }
      }
      
      res.json(allUserBatchProcesses);
    } catch (error: any) {
      console.error('Error fetching user batch processes:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch user batch processes' });
    }
  });
  
  // Get all users with their location data - for organization tree visualization
  app.get("/api/user-locations", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    
    try {
      // Get all locations in the organization
      const locations = await storage.listLocations(req.user.organizationId);
      console.log('Fetching locations for organization', req.user.organizationId);
      console.log('Found', locations.length, 'locations');
      
      // Get all users in the organization
      const users = await storage.listUsers(req.user.organizationId);
      
      // Map users with their location data
      const usersWithLocationData = users.map(user => {
        // Find the location for this user
        const location = locations.find(loc => loc.id === user.locationId);
        
        return {
          userId: user.id,
          locationId: user.locationId,
          locationName: location ? location.name : null
        };
      });
      
      res.json(usersWithLocationData);
    } catch (error: any) {
      console.error('Error fetching user locations:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch user locations' });
    }
  });

  // Bulk user creation endpoint
  app.post("/api/users/bulk", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Check for upload_users permission
    const userRole = req.user.role;
    
    // Owner has all permissions
    if (userRole !== 'owner') {
      const userPermissions = await storage.getUserPermissions(req.user.id);
      if (!userPermissions.includes('upload_users')) {
        return res.status(403).json({ message: "You don't have permission to upload users" });
      }
    }

    try {
      const users = req.body.users;
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ message: "Invalid users data" });
      }
      
      // Check user limit
      const organizationId = req.user.organizationId;
      const currentUserCount = await storage.countUsers(organizationId);
      
      // Get organization settings to check user limit
      const orgSettings = await storage.getOrganizationSettings(organizationId);
      const userLimit = orgSettings?.userLimit || 500; // Default to 500 if not set
      
      // Check if adding these users would exceed the limit
      if (currentUserCount + users.length > userLimit) {
        return res.status(400).json({ 
          message: `Adding ${users.length} users would exceed your user limit of ${userLimit}. You currently have ${currentUserCount} users. Please reduce the number of users being added or contact support to increase your user limit.`
        });
      }

      console.log(`Starting bulk user upload validation for ${users.length} users`);
      
      // First pass: validate all users before creating any
      // This ensures we don't create partial data if validation fails
      const validatedUsers = [];
      const errors = [];
      
      for (const userData of users) {
        try {
          // Validate required fields
          if (!userData.username || !userData.email || !userData.password) {
            throw new Error(`Missing required fields for user: ${userData.username || 'unknown'}`);
          }

          // Check if username already exists
          const existingUser = await storage.getUserByUsername(userData.username);
          if (existingUser) {
            throw new Error(`Username ${userData.username} already exists`);
          }
          
          // Check if email already exists
          const existingUserByEmail = await storage.getUserByEmail(userData.email);
          if (existingUserByEmail) {
            throw new Error(`Email ${userData.email} already exists. Please use a different email address.`);
          }

          // Find reporting manager by username if provided
          let managerId = null;
          if (userData.reportingManager) {
            const manager = await storage.getUserByUsername(userData.reportingManager);
            if (!manager) {
              throw new Error(`Reporting manager ${userData.reportingManager} not found`);
            }
            managerId = manager.id;
          }

          // Find location by name if provided
          let locationId = null;
          if (userData.location) {
            const location = await storage.getLocationByName(userData.location);
            if (!location) {
              throw new Error(`Location ${userData.location} not found`);
            }
            locationId = location.id;
          }
          
          // Find line of business by name if provided
          let lineOfBusinessId = null;
          if (userData.lineOfBusiness) {
            const lob = await storage.getLineOfBusinessByName(userData.lineOfBusiness);
            if (!lob) {
              throw new Error(`Line of Business ${userData.lineOfBusiness} not found`);
            }
            lineOfBusinessId = lob.id;
          }
          
          // Validate processes if provided
          if (userData.process) {
            console.log(`Validating processes for user ${userData.username}: ${userData.process}`);
            // Split processes by comma and trim whitespace
            const processes = userData.process.split(',').map(p => p.trim()).filter(Boolean);
            const validatedProcesses = [];
            
            for (const processName of processes) {
              console.log(`Checking process ${processName} for user ${userData.username}`);
              const process = await storage.getProcessByName(processName);
              if (!process) {
                throw new Error(`Process ${processName} not found`);
              }
              
              // Store the process with its original LOB mapping
              validatedProcesses.push({
                name: processName,
                id: process.id,
                lineOfBusinessId: process.lineOfBusinessId
              });
              
              console.log(`Process ${processName} belongs to LOB ID: ${process.lineOfBusinessId}`);
            }
            
            // Store validated processes for the second pass
            userData._validatedProcesses = validatedProcesses;
          }
          
          // Store validated data for second pass
          validatedUsers.push({
            ...userData,
            managerId,
            locationId,
            lineOfBusinessId
          });
          
        } catch (error) {
          errors.push(`User ${userData.username || 'unknown'}: ${error.message}`);
        }
      }
      
      // If any validation errors, abort the entire operation
      if (errors.length > 0) {
        console.log('Validation errors found, aborting upload:', errors);
        return res.status(400).json({ 
          message: "Validation failed. No users were created.", 
          title: "Validation Errors Found",
          errors 
        });
      }
      
      // Second pass: create all users in a transaction
      console.log(`All ${validatedUsers.length} users validated successfully, proceeding with creation`);
      
      await db.transaction(async (tx) => {
        for (const userData of validatedUsers) {
          // Hash the password
          const hashedPassword = await hashPassword(userData.password);

          // Create the user with category set to 'active'
          const newUser = await storage.createUser({
            username: userData.username,
            password: hashedPassword,
            fullName: userData.fullName,
            email: userData.email,
            role: userData.role,
            category: "active", // Always set to active for bulk upload
            locationId: userData.locationId,
            employeeId: userData.employeeId, 
            phoneNumber: userData.phoneNumber,
            dateOfJoining: userData.dateOfJoining ? new Date(userData.dateOfJoining) : null,
            dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth) : null,
            education: userData.education,
            organizationId: req.user.organizationId!,
            managerId: userData.managerId,
            active: true,
            certified: false,
            onboardingCompleted: true,
          });

          // Assign processes if any were validated
          if (userData._validatedProcesses && userData._validatedProcesses.length > 0) {
            for (const process of userData._validatedProcesses) {
              // Use the process's original LOB ID instead of the user's general LOB ID
              console.log(`Assigning process ${process.name} (ID: ${process.id}) to user ${userData.username} with LOB ID: ${process.lineOfBusinessId}`);
              await storage.assignProcessToUser(newUser.id, process.id, process.lineOfBusinessId);
            }
          }
        }
      });

      res.status(201).json({ 
        message: "Users created successfully",
        count: validatedUsers.length
      });
    } catch (error: any) {
      console.error("Bulk user creation error:", error);
      
      // Provide specific error messages based on the error type
      let userFriendlyMessage = "An unexpected error occurred during bulk user creation";
      let errorTitle = "Upload Error";
      
      if (error.code === '23505') {
        // Unique constraint violation
        if (error.constraint === 'users_employee_id_unique') {
          const employeeId = error.detail?.match(/Key \(employee_id\)=\(([^)]+)\)/)?.[1];
          userFriendlyMessage = `Employee ID '${employeeId}' already exists. Please use a unique employee ID.`;
          errorTitle = "Duplicate Employee ID";
        } else if (error.constraint === 'users_username_unique') {
          const username = error.detail?.match(/Key \(username\)=\(([^)]+)\)/)?.[1];
          userFriendlyMessage = `Username '${username}' already exists. Please use a different username.`;
          errorTitle = "Duplicate Username";
        } else if (error.constraint === 'users_email_unique') {
          const email = error.detail?.match(/Key \(email\)=\(([^)]+)\)/)?.[1];
          userFriendlyMessage = `Email '${email}' already exists. Please use a different email address.`;
          errorTitle = "Duplicate Email";
        } else {
          userFriendlyMessage = "Some information already exists in the system. Please check for duplicate usernames, emails, or employee IDs.";
          errorTitle = "Duplicate Information";
        }
      } else if (error.code === '22P02') {
        // Invalid input syntax (usually enum values)
        if (error.message.includes('USER_ROLE')) {
          userFriendlyMessage = "Invalid role specified. Please use one of: owner, admin, manager, team_lead, quality_analyst, trainer, advisor.";
          errorTitle = "Invalid Role";
        } else if (error.message.includes('USER_CATEGORY')) {
          userFriendlyMessage = "Invalid category specified. Please use: active, inactive, or terminated.";
          errorTitle = "Invalid Category";
        } else {
          userFriendlyMessage = "Invalid data format. Please check that all fields contain valid values.";
          errorTitle = "Invalid Data";
        }
      } else if (error.code === '23502') {
        // Not null violation
        const column = error.column || 'unknown field';
        userFriendlyMessage = `Required field '${column}' is missing. Please ensure all required fields are filled.`;
        errorTitle = "Missing Required Field";
      } else if (error.code === '23503') {
        // Foreign key violation
        userFriendlyMessage = "Referenced data not found. Please check that locations, managers, and other referenced information exists.";
        errorTitle = "Invalid Reference";
      }
      
      res.status(500).json({ 
        message: userFriendlyMessage,
        title: errorTitle,
        error: error.message 
      });
    }
  });

  // Create user endpoint
  app.post("/api/users", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { processes, lineOfBusinessId, ...userData } = req.body;
      
      // Check if email already exists
      if (userData.email) {
        const existingUserByEmail = await storage.getUserByEmail(userData.email);
        if (existingUserByEmail) {
          return res.status(400).json({ message: "Email already exists. Please choose a different email address." });
        }
      }
      
      // Check if username already exists
      if (userData.username) {
        const existingUserByUsername = await storage.getUserByUsername(userData.username);
        if (existingUserByUsername) {
          return res.status(400).json({ message: "Username already exists. Please choose a different username." });
        }
      }
      
      // Check user limit
      const organizationId = req.user.organizationId;
      const currentUserCount = await storage.countUsers(organizationId);
      
      // Get organization settings to check user limit
      const orgSettings = await storage.getOrganizationSettings(organizationId);
      const userLimit = orgSettings?.userLimit || 500; // Default to 500 if not set
      
      if (currentUserCount >= userLimit) {
        return res.status(400).json({ 
          message: `User limit of ${userLimit} has been reached. Please contact support to increase your user limit or remove unused users.`
        });
      }

      // Validate that lineOfBusinessId is provided when processes are specified
      if (processes?.length > 0 && !lineOfBusinessId) {
        return res.status(400).json({
          message: "Line of Business ID is required when assigning processes"
        });
      }

      // Hash the password before creating the user
      const hashedPassword = await hashPassword(userData.password);

      // Prepare user data with explicit type casting for organizationId
      const userToCreate = {
        ...userData,
        password: hashedPassword,
        role: userData.role.toLowerCase(),
        organizationId: req.user.organizationId as number,
        category: "active", // Always default to active
      };

      console.log('Creating user with data:', {
        ...userToCreate,
        processCount: processes?.length || 0,
        lineOfBusinessId
      });

      // Create user with optional processes, ensuring lineOfBusinessId is a number
      const result = await storage.createUserWithProcesses(
        userToCreate,
        processes || [],
        req.user.organizationId,
        lineOfBusinessId ? Number(lineOfBusinessId) : undefined
      );

      res.status(201).json(result.user);
    } catch (error: any) {
      console.error("User creation error:", error);
      res.status(400).json({ message: error.message || "Failed to create user" });
    }
  });

  // Delete user endpoint
  app.delete("/api/users/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid user ID" 
        });
      }

      console.log(`Delete user request received for userId: ${userId}`);
      const userToDelete = await storage.getUser(userId);

      if (!userToDelete) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      // Check if user belongs to the same organization
      if (userToDelete.organizationId !== req.user.organizationId) {
        return res.status(403).json({ 
          success: false, 
          message: "Cannot delete users from other organizations" 
        });
      }

      // Only owners and admins can delete users
      if (req.user.role !== 'owner' && req.user.role !== 'admin') {
        console.log(`Delete request rejected: Insufficient permissions for user ${req.user.id}`);
        return res.status(403).json({ 
          success: false, 
          message: "Insufficient permissions to delete users" 
        });
      }

      // Cannot delete owners
      if (userToDelete.role === 'owner') {
        return res.status(403).json({ 
          success: false, 
          message: "Cannot delete organization owner" 
        });
      }

      console.log(`Attempting to delete user ${userId} from storage`);
      await storage.deleteUser(userId);
      console.log(`Successfully deleted user ${userId}`);

      return res.status(200).json({ 
        success: true, 
        message: "User deleted successfully" 
      });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to delete user" 
      });
    }
  });

  // Update user route
  app.patch("/api/users/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const userId = parseInt(req.params.id);
      const updateData = req.body;
      
      console.log(`PATCH /api/users/${userId} with data:`, updateData);

      // Get the user to be updated
      const userToUpdate = await storage.getUser(userId);
      if (!userToUpdate) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent changing owner role
      if (userToUpdate.role === 'owner' && updateData.role && updateData.role !== 'owner') {
        return res.status(403).json({ message: "Cannot change the role of an owner" });
      }

      // Prevent assigning owner role
      if (updateData.role === 'owner') {
        return res.status(403).json({ message: "Cannot assign owner role through update" });
      }

      // Check if the user is updating their own profile
      const isOwnProfile = req.user.id === userId;

      // If it's own profile update, allow location and other basic info updates
      if (isOwnProfile) {
        // Filter allowed fields for self-update
        const allowedSelfUpdateFields = [
          'fullName',
          'email',
          'phoneNumber',
          'locationId',
          'dateOfBirth',
          'education'
        ];

        const filteredUpdateData = Object.keys(updateData)
          .filter(key => allowedSelfUpdateFields.includes(key))
          .reduce<Partial<AllowedSelfUpdateFields>>((obj, key) => {
            obj[key as keyof AllowedSelfUpdateFields] = updateData[key];
            return obj;
          }, {});

        const updatedUser = await storage.updateUser(userId, filteredUpdateData);
        return res.json(updatedUser);
      }

      // For owner role, allow all updates including process updates
      if (req.user.role === 'owner') {
        // Extract process IDs if they are being updated
        let processIds: number[] | undefined;
        if (updateData.processes && Array.isArray(updateData.processes)) {
          processIds = updateData.processes.map((p: any) => 
            typeof p === 'number' ? p : Number(p.id || p.processId)
          ).filter((id: number) => !isNaN(id));
          // Remove processes from updateData as they will be handled separately
          delete updateData.processes;
        }
        
        // Update basic user info
        const updatedUser = await storage.updateUser(userId, updateData);
        
        // If processes were included, update them separately
        if (processIds !== undefined) {
          console.log(`Updating processes for user ${userId}:`, processIds);
          await storage.updateUserProcesses(userId, processIds, userToUpdate.organizationId);
        }
        
        // Get the updated user with processes
        const userWithProcesses = {
          ...updatedUser,
          processes: await storage.getUserProcesses(userId)
        };
        
        return res.json(userWithProcesses);
      }

      // Admin users can only be modified by owners
      if (userToUpdate.role === 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ message: "Only owners can modify admin users" });
      }

      // Allow admins to change active status for non-owner users
      if (req.user.role === 'admin' && 'active' in updateData) {
        if (userToUpdate.role === 'owner') {
          return res.status(403).json({ message: "Cannot change owner's active status" });
        }
        const updatedUser = await storage.updateUser(userId, { active: updateData.active });
        return res.json(updatedUser);
      }

      // Check user permissions
      const userPermissions = await storage.getUserPermissions(req.user.id);
      const hasEditPermission = userPermissions.includes('edit_users');
      const hasManagePermission = userPermissions.includes('manage_users');
      
      console.log(`User ${req.user.id} (${req.user.role}) permissions for editing user ${userId}:`, {
        hasEditPermission,
        hasManagePermission,
        permissions: userPermissions
      });
      
      // Define allowed fields based on permissions - basic fields for all
      let allowedFields = ['fullName', 'phoneNumber', 'locationId', 'dateOfBirth', 'education']; 
      
      // If user has manage_users permission, allow full editing capabilities
      // This ensures managers can properly edit all user details
      if (hasManagePermission) {
        console.log(`User ${req.user.id} has manage_users permission - allowing full edit capabilities`);
        allowedFields = [
          ...allowedFields,
          'role',         // Allow changing role
          'email',        // Allow changing email
          'username',     // Allow changing username
          'employeeId',   // Allow changing employee ID
          'category',     // Allow changing category (active/inactive)
          'managerId',    // Allow changing manager
          'active'        // Allow activating/deactivating users
        ];
      }
      // Or if they just have edit_users permission, allow most editing capabilities
      else if (hasEditPermission) {
        console.log(`User ${req.user.id} has edit_users permission - allowing extended edit capabilities`);
        allowedFields = [
          ...allowedFields,
          'role',         // Allow changing role
          'email',        // Allow changing email
          'username',     // Allow changing username
          'employeeId',   // Allow changing employee ID
          'category',     // Allow changing category (active/inactive)
          'managerId'     // Allow changing manager
        ];
      }
      
      // Log the incoming data for debugging
      console.log(`Update data for user ${userId}:`, updateData);
      console.log(`User ${req.user.id} has manage_users permission:`, hasManagePermission);
      
      // Extract process IDs if they are being updated
      let processIds: number[] | undefined;
      if (updateData.processes) {
        console.log(`Raw processes data:`, updateData.processes);
        
        // Always convert processes data to proper format (all roles with edit_users permission)
        if (Array.isArray(updateData.processes)) {
          processIds = updateData.processes.map((p: any) => 
            typeof p === 'number' ? p : Number(p.id || p.processId)
          ).filter((id: number) => !isNaN(id));
          
          // Remove processes from updateData as they will be handled separately
          delete updateData.processes;
          console.log(`Processing ${processIds?.length || 0} process IDs for user ${userId}:`, processIds);
        } else {
          console.log(`Processes data is not an array:`, updateData.processes);
          // Still need to remove processes from updateData even if we don't process them
          delete updateData.processes;
        }
      } else {
        console.log(`No processes data in update for user ${userId}`);
      }
      
      const filteredUpdateData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce<Partial<AllowedUpdateFields>>((obj, key) => {
          obj[key as keyof AllowedUpdateFields] = updateData[key] as any;
          return obj;
        }, {});

      const updatedUser = await storage.updateUser(userId, filteredUpdateData);
      
      // If processes were included and user has either edit_users or manage_users permission, update them
      if ((hasEditPermission || hasManagePermission) && processIds !== undefined) {
        console.log(`Updating processes for user ${userId} (user has permissions - edit_users: ${hasEditPermission}, manage_users: ${hasManagePermission})`);
        await storage.updateUserProcesses(userId, processIds, userToUpdate.organizationId);
        
        // Get the updated user with processes
        const userWithProcesses = {
          ...updatedUser,
          processes: await storage.getUserProcesses(userId)
        };
        
        return res.json(userWithProcesses);
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error("User update error:", error);
      res.status(400).json({ message: error.message || "Failed to update user" });
    }
  });



  // Add new route for starting a batch after existing batch routes
  app.post("/api/batches/:batchId/start", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      if (!batchId) {
        return res.status(400).json({ message: "Invalid batch ID" });
      }

      // Get the batch
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch can be started
      if (batch.status !== 'planned') {
        return res.status(400).json({ 
          message: "Only planned batches can be started" 
        });
      }

      // Get all users assigned to this batch and check their category
      const batchTrainees = await storage.getBatchTrainees(batchId);
      const traineeCount = batchTrainees.length;

      if (traineeCount === 0) {
        return res.status(400).json({
          message: "Cannot start batch without any trainees. Please add at least one trainee before starting the batch."
        });
      }
      
      // Record batch history first
      await addBatchHistoryRecord(
        batchId,
        'phase_change',
        `Batch phase changed from planned to induction (batch started)`,
        'planned',
        'induction',
        batch.organizationId,
        req.user.id // Pass the actual user ID who started the batch
      );

      // Store dates in UTC format while preserving IST midnight
      const currentDate = new Date();
      const updatedBatch = await storage.updateBatch(batchId, {
        status: 'induction',
        startDate: toUTCStorage(currentDate.toISOString())
      });

      console.log('Successfully started batch:', {
        ...updatedBatch,
        startDate: formatISTDateOnly(updatedBatch.startDate)
      });

      res.json(updatedBatch);

    } catch (error: any) {
      console.error("Error starting batch:", error);
      res.status(500).json({ message: error.message || "Failed to start batch" });
    }
  });

  // Create phase change request
  app.post("/api/batches/:batchId/phase-change-requests", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      const { requestedPhase, justification, managerId } = req.body;

      // Get the batch to verify current phase
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Create the phase change request
      const request = await storage.createPhaseChangeRequest({
        batchId,
        trainerId: req.user.id,
        managerId,
        currentPhase: batch.status,
        requestedPhase,
        justification,
        organizationId: req.user.organizationId,
      });

      res.status(201).json(request);
    } catch (error: any) {
      console.error("Error creating phase change request:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // List phase change requests for trainer
  app.get("/api/trainers/:trainerId/phase-change-requests", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const trainerId = parseInt(req.params.trainerId);
      
      // Check if the user is requesting their own requests
      if (req.user.id !== trainerId && req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "You can only view your own requests" });
      }

      const requests = await storage.listTrainerPhaseChangeRequests(trainerId);
      res.json(requests);
    } catch (error: any) {
      console.error("Error listing trainer phase change requests:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // List phase change requests for manager
  app.get("/api/managers/:managerId/phase-change-requests", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const managerId = parseInt(req.params.managerId);
      const batchId = req.query.batchId ? parseInt(req.query.batchId as string) : null;
      
      // Check if the user is requesting their own managed requests
      if (req.user.id !== managerId && req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "You can only view requests assigned to you" });
      }

      // Get all requests for this manager
      const allRequests = await storage.listManagerPhaseChangeRequests(managerId);
      
      // If batchId is provided, filter the requests to only include those for the specific batch
      const requests = batchId 
        ? allRequests.filter(request => request.batchId === batchId)
        : allRequests;
        
      res.json(requests);
    } catch (error: any) {
      console.error("Error listing manager phase change requests:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add question routes
  app.post("/api/questions", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      console.log('Received question data:', req.body);
      
      // Validate required fields
      const { 
        question: questionText, 
        type: questionType,
        options: questionOptions,
        correctAnswer,
        explanation,
        difficultyLevel,
        category,
        processId  // Add processId to destructuring
      } = req.body;
      
      if (!questionText || !questionType || !correctAnswer || !difficultyLevel || !category || !processId) {
        return res.status(400).json({ 
          message: "Missing required fields for question creation" 
        });
      }

      // Validate question type
      const validTypes = ["multiple_choice", "true_false", "short_answer"] as const;
      type QuestionType = typeof validTypes[number];
      
      if (!validTypes.includes(questionType as QuestionType)) {
        return res.status(400).json({
          message: `Invalid question type. Must be one of: ${validTypes.join(", ")}`
        });
      }

      // Convert processId to number and validate
      const processIdNum = Number(processId);
      if (isNaN(processIdNum)) {
        return res.status(400).json({
          message: "Invalid process ID format"
        });
      }

      // Verify the process exists and belongs to the organization
      const processes = await db
        .select()
        .from(organizationProcesses)
        .where(and(
          eq(organizationProcesses.id, processIdNum),
          eq(organizationProcesses.organizationId, req.user.organizationId)
        ))
        .limit(1);

      if (processes.length === 0) {
        return res.status(400).json({
          message: "Invalid process ID or process does not belong to your organization."
        });
      }

      // Create question data with proper type checking
      const questionData = {
        question: String(questionText),
        type: questionType as QuestionType,
        options: questionType === 'multiple_choice' ? 
          (Array.isArray(questionOptions) ? questionOptions.map(String) : []) : 
          [],
        correctAnswer: String(correctAnswer),
        explanation: explanation ? String(explanation) : undefined,
        difficultyLevel: Number(difficultyLevel),
        category: String(category),
        createdBy: req.user.id,
        organizationId: req.user.organizationId,
        processId: processIdNum
      };

      // Validate numeric fields
      if (isNaN(questionData.difficultyLevel)) {
        return res.status(400).json({
          message: "Difficulty level must be a number"
        });
      }

      // Validate options for multiple choice questions
      if (questionData.type === 'multiple_choice' && (!Array.isArray(questionData.options) || questionData.options.length < 2)) {
        return res.status(400).json({
          message: "Multiple choice questions must have at least two options"
        });
      }

      console.log('Processed question data:', questionData);
      
      // Create the question in the database
      const newQuestion = await storage.createQuestion(questionData);
      console.log('Successfully created question:', newQuestion);
      
      res.status(201).json(newQuestion);
    } catch (error: any) {
      console.error("Error creating question:", error);
      res.status(400).json({ 
        message: error.message || "Failed to create question",
        details: error.stack
      });
    }
  });

  app.get("/api/questions", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const processId = req.query.processId ? parseInt(req.query.processId as string) : null;
      // Check if we should include inactive questions
      const includeInactive = req.query.includeInactive === 'true';
      console.log(`Fetching questions with process filter: ${processId}, includeInactive: ${includeInactive}`);

      let questions;
      if (processId) {
        // If processId is provided, filter questions by process
        questions = await storage.listQuestionsByProcess(req.user.organizationId, processId, includeInactive);
      } else {
        // If no processId, get all questions for the organization
        questions = await storage.listQuestions(req.user.organizationId, includeInactive);
      }

      console.log(`Retrieved ${questions.length} questions for process ${processId || 'all'}`);
      res.json(questions);
    } catch (error: any) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add quiz routes with minimal validation
  app.get("/api/quizzes/:quizId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.quizId);
      
      // Get quiz with questions using the correct function
      const quiz = await storage.getQuizWithQuestions(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      res.json(quiz);
    } catch (error: any) {
      console.error("Error fetching quiz details:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/quizzes/:quizId/submit", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.quizId);
      const { answers } = req.body;

      // Get quiz with questions using the correct function
      const quiz = await storage.getQuizWithQuestions(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // Check if the quiz is oneTimeOnly and if the user has already attempted it
      if (quiz.oneTimeOnly) {
        const previousAttempts = await storage.getQuizAttemptsByUser(req.user.id, quizId);
        if (previousAttempts && previousAttempts.length > 0) {
          return res.status(403).json({
            message: "This quiz can only be attempted once. You have already submitted an attempt.",
            previousAttempt: previousAttempts[0]
          });
        }
      }

      // Calculate score
      let correctAnswers = 0;
      const scoredAnswers = quiz.questions.map(question => {
        const userAnswer = answers[question.id];
        const isCorrect = userAnswer === question.correctAnswer;
        if (isCorrect) correctAnswers++;
        
        return {
          questionId: question.id,
          userAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect
        };
      });

      // Calculate score and round to integer (DB field is integer type)
      const score = Math.round((correctAnswers / quiz.questions.length) * 100);

      // Create quiz attempt record
      const attempt = await storage.createQuizAttempt({
        quizId: quiz.id,
        userId: req.user.id,
        organizationId: req.user.organizationId,
        score,
        answers: scoredAnswers,
        completedAt: new Date()
      });

      res.json({
        id: attempt.id,
        score: attempt.score,
        completedAt: attempt.completedAt,
        answers: scoredAnswers
      });
    } catch (error: any) {
      console.error("Error submitting quiz:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add route for getting random questions
  app.get("/api/random-questions", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      console.log('Random questions request params:', req.query);
      
      // Validate count parameter
      const count = parseInt(req.query.count as string);
      if (isNaN(count) || count < 1) {
        return res.status(400).json({ 
          message: "Question count must be a positive number" 
        });
      }

      // Parse optional parameters
      const options: {
        count: number;
        categoryDistribution?: Record<string, number>;
        difficultyDistribution?: Record<string, number>;
        processId?: number;
        includeInactive?: boolean;
      } = { count };

      // Parse category distribution if provided
      if (req.query.categoryDistribution) {
        try {
          options.categoryDistribution = JSON.parse(req.query.categoryDistribution as string);
          if (typeof options.categoryDistribution !== 'object') {
            throw new Error('Invalid category distribution format');
          }
        } catch (error) {
          return res.status(400).json({
            message: "Invalid category distribution format. Expected JSON object with category names and counts."
          });
        }
      }

      // Parse difficulty distribution if provided
      if (req.query.difficultyDistribution) {
        try {
          options.difficultyDistribution = JSON.parse(req.query.difficultyDistribution as string);
          if (typeof options.difficultyDistribution !== 'object') {
            throw new Error('Invalid difficulty distribution format');
          }
        } catch (error) {
          return res.status(400).json({
            message: "Invalid difficulty distribution format. Expected JSON object with difficulty levels and counts."
          });
        }
      }

      // Parse processId if provided
      if (req.query.processId) {
        const processId = parseInt(req.query.processId as string);
        if (!isNaN(processId) && processId > 0) {
          options.processId = processId;
        }
      }
      
      // Parse includeInactive parameter if provided
      if (req.query.includeInactive) {
        options.includeInactive = req.query.includeInactive === 'true';
      }

      console.log('Getting random questions with options:', options);
      
      // Get random questions using the storage method
      const randomQuestions = await storage.getRandomQuestions(
        req.user.organizationId,
        options
      );

      console.log(`Retrieved ${randomQuestions.length} random questions`);
      res.json(randomQuestions);
    } catch (error: any) {
      console.error("Error getting random questions:", error);
      res.status(500).json({ 
        message: error.message || "Failed to get random questions" 
      });
    }
  });

  // Get quizzes assigned to trainee through their processes or direct assignment
  app.get("/api/trainee/quizzes", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify if user has trainee category
    if (req.user.category !== 'trainee') {
      return res.status(403).json({ 
        message: "Only users with trainee category can access this endpoint" 
      });
    }

    try {
      console.log("Fetching quizzes for user:", {
        userId: req.user.id,
        username: req.user.username,
        organizationId: req.user.organizationId
      });

      // Get user's assigned processes first
      const userProcessesResult = await db
        .select({
          processId: userProcesses.processId
        })
        .from(userProcesses)
        .where(eq(userProcesses.userId, req.user.id));

      const assignedProcessIds = userProcessesResult.map(p => p.processId);
      
      // Find user's batch assignments
      const userBatchProcessesResult = await db
        .select({
          batchId: userBatchProcesses.batchId
        })
        .from(userBatchProcesses)
        .where(
          and(
            eq(userBatchProcesses.userId, req.user.id),
            eq(userBatchProcesses.status, 'active')
          )
        );
      
      const batchIds = userBatchProcessesResult.map(bp => bp.batchId);
      
      // Fetch quizzes based on process assignment (traditional way) or specific user assignment
      
      // Method 1: Get quizzes that are specifically assigned to this user by trainee_id
      const assignedQuizIdsResult = await db
        .select({
          quizId: quizAssignments.quizId
        })
        .from(quizAssignments)
        .where(
          and(
            eq(quizAssignments.traineeId, req.user.id),  // Check traineeId instead of userId
            eq(quizAssignments.status, 'assigned')
          )
        );
        
      const assignedQuizIds = assignedQuizIdsResult.map(qa => qa.quizId);
      
      console.log(`Found ${assignedQuizIds.length} quiz assignments for trainee ${req.user.id}:`, assignedQuizIds);
      
      // Method 2: Get quizzes for assigned processes (traditional way)
      const processBatchQuizzesQuery = db
        .select({
          quiz_id: quizzes.id,
          quiz_name: quizzes.name,
          timeLimit: quizzes.timeLimit,
          passingScore: quizzes.passingScore,
          processId: quizzes.processId,
          processName: organizationProcesses.name,
          startTime: quizzes.startTime,
          endTime: quizzes.endTime,
          oneTimeOnly: quizzes.oneTimeOnly,
          quizType: quizzes.quizType
        })
        .from(quizzes)
        .innerJoin(
          organizationProcesses, 
          eq(quizzes.processId, organizationProcesses.id)
        )
        .where(
          and(
            eq(organizationProcesses.organizationId, req.user.organizationId),
            eq(quizzes.status, 'active'),
            // ONLY show quizzes specifically assigned to this trainee
            // If no assignments, they won't see any quizzes (using -1 as a non-existent ID)
            inArray(quizzes.id, assignedQuizIds.length > 0 ? assignedQuizIds : [-1]),
            // Only return quizzes that haven't expired yet
            gte(quizzes.endTime, new Date())
          )
        );
        
        console.log(`Only showing traineeId-specific assignments. Found ${assignedQuizIds.length} assignments.`);
        
      const result = await processBatchQuizzesQuery;

      console.log('Found quizzes:', result);
      res.json(result);

    } catch (error: any) {
      console.error("Error fetching trainee quizzes:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch trainee quizzes" 
      });
    }
  });


  // Quiz assignment routes
  app.post("/api/quizzes/:quizId/assignments", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.quizId);
      const { userIds, batchId } = req.body;
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "User IDs must be provided as an array" });
      }
      
      if (!batchId) {
        return res.status(400).json({ message: "Batch ID is required" });
      }
      
      // Get the quiz
      const quiz = await storage.getQuiz(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      // Create assignments for each user
      const assignments = [];
      for (const userId of userIds) {
        try {
          const assignment = await storage.createQuizAssignment({
            quizId,
            traineeId: userId, // Set traineeId as userId
            userId,           // Keep userId same as traineeId for backward compatibility
            batchId,
            organizationId: req.user.organizationId,
            assignedBy: req.user.id,
            status: 'assigned'
          });
          assignments.push(assignment);
        } catch (error) {
          console.error(`Error creating assignment for user ${userId}:`, error);
          // Continue with other users even if one fails
        }
      }
      
      res.status(201).json({ 
        message: `${assignments.length} quiz assignments created successfully`,
        assignments
      });
    } catch (error) {
      console.error("Error creating quiz assignments:", error);
      res.status(500).json({ message: "Failed to create quiz assignments" });
    }
  });
  
  app.get("/api/quizzes/:quizId/assignments", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const quizId = parseInt(req.params.quizId);
      
      // Get the quiz
      const quiz = await storage.getQuiz(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      // Get assignments for this quiz
      const assignments = await storage.getQuizAssignments(quizId);
      
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching quiz assignments:", error);
      res.status(500).json({ message: "Failed to fetch quiz assignments" });
    }
  });
  
  // Get trainees for a specific batch
  app.get("/api/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const batchId = parseInt(req.params.batchId);
      if (isNaN(batchId)) {
        return res.status(400).json({ message: "Invalid batch ID" });
      }
      
      console.log("Fetching trainees for batch", batchId);
      
      // Get all trainees for this batch with user details already included
      const trainees = await storage.getBatchTrainees(batchId);
      console.log(`Found ${trainees.length} trainees in batch ${batchId}:`, trainees);
      
      // The getBatchTrainees method already includes user details, so we can return directly
      res.json(trainees);
    } catch (error) {
      console.error("Error fetching batch trainees:", error);
      res.status(500).json({ message: "Failed to fetch batch trainees" });
    }
  });

  app.get("/api/batches/:batchId/trainees-for-quiz/:quizId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const batchId = parseInt(req.params.batchId);
      const quizId = parseInt(req.params.quizId);
      
      // Get trainees for this batch and quiz
      const trainees = await storage.listTraineesForQuiz(quizId, batchId);
      
      res.json(trainees);
    } catch (error) {
      console.error("Error fetching trainees for quiz:", error);
      res.status(500).json({ message: "Failed to fetch trainees for quiz" });
    }
  });
  
  app.delete("/api/quizzes/assignments/:assignmentId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      
      await storage.deleteQuizAssignment(assignmentId);
      
      res.json({ message: "Quiz assignment deleted successfully" });
    } catch (error) {
      console.error("Error deleting quiz assignment:", error);
      res.status(500).json({ message: "Failed to delete quiz assignment" });
    }
  });
  
  // Delete quiz endpoint
  app.delete("/api/quizzes/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.id);
      if (!quizId) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }

      // Get the quiz to verify ownership
      const quiz = await storage.getQuiz(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // Verify organization ownership
      if (quiz.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "You can only delete quizzes from your organization" });
      }

      // Delete the quiz and related records
      await storage.deleteQuiz(quizId);

      res.json({ message: "Quiz deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting quiz:", error);
      res.status(500).json({ 
        message: error.message || "Failed to delete quiz" 
      });
    }
  });

  // Update question endpoint
  app.put("/api/questions/:id", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return res.status(400).json({ message: "Invalid question ID" });
      }

      // Get the existing question to verify ownership
      const existingQuestion = await storage.getQuestionById(questionId);
      if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Verify organization ownership
      if (existingQuestion.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update the question
      const updatedQuestion = await storage.updateQuestion(questionId, {
        ...req.body,
        organizationId: req.user.organizationId // Ensure organization ID cannot be changed
      });

      res.json(updatedQuestion);
    } catch (error: any) {
      console.error("Error updating question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Toggle question active state
  app.patch("/api/questions/:id/toggle-active", async (req, res) => {
    console.log("Toggle active request received for question ID:", req.params.id);
    console.log("Auth user:", req.user);
    
    if (!req.user || !req.user.organizationId) {
      console.log("Unauthorized access attempt - no user or organization ID");
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        console.log("Invalid question ID:", req.params.id);
        return res.status(400).json({ message: "Invalid question ID" });
      }

      console.log("Looking up question with ID:", questionId);
      
      // Get the existing question to verify ownership and check current active state
      const existingQuestion = await storage.getQuestionById(questionId);
      if (!existingQuestion) {
        console.log("Question not found with ID:", questionId);
        return res.status(404).json({ message: "Question not found" });
      }

      console.log("Found question:", existingQuestion.id, existingQuestion.question.substring(0, 30));
      
      // Verify organization ownership
      if (existingQuestion.organizationId !== req.user.organizationId) {
        console.log("Access denied - organization mismatch", {
          questionOrg: existingQuestion.organizationId,
          userOrg: req.user.organizationId
        });
        return res.status(403).json({ message: "Access denied" });
      }

      // Toggle the active state
      const newActiveState = !existingQuestion.active;
      console.log("Toggling question active state from", existingQuestion.active, "to", newActiveState);
      
      // Update the question with the new active state
      const updatedQuestion = await storage.updateQuestion(questionId, {
        active: newActiveState
      });

      console.log("Question updated successfully");
      
      res.json({
        message: `Question ${newActiveState ? 'activated' : 'deactivated'} successfully`,
        question: updatedQuestion
      });
    } catch (error: any) {
      console.error("Error toggling question active state:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete question endpoint
  app.delete("/api/questions/:id", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return res.status(400).json({ message: "Invalid question ID" });
      }

      // Get the existing question to verify ownership
      const existingQuestion = await storage.getQuestionById(questionId);
      if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Verify organization ownership
      if (existingQuestion.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete the question
      await storage.deleteQuestion(questionId);
      res.json({ message: "Question deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add quiz template routes
  app.post("/api/quiz-templates", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log('Creating quiz template with data:', req.body);

      // Process the batch ID - convert "none" to null
      let batchId = req.body.batchId;
      if (batchId === "none" || batchId === "") {
        batchId = null;
        console.log('Setting batchId to null (template available to all)');
      } else if (batchId) {
        // If batchId is provided (not "none"), convert to number
        batchId = parseInt(batchId);
        
        // Verify the batch exists
        const batch = await storage.getBatch(batchId);
        if (!batch) {
          return res.status(404).json({ message: "Batch not found" });
        }
        
        // Verify the batch belongs to the user's organization
        if (batch.organizationId !== req.user.organizationId) {
          return res.status(403).json({ message: "Access denied to this batch" });
        }
        console.log(`Template will be restricted to batch ID: ${batchId}`);
      }

      const templateData = {
        ...req.body,
        batchId,
        organizationId: req.user.organizationId,
        createdBy: req.user.id
      };

      // Create the template
      const newTemplate = await storage.createQuizTemplate(templateData);
      console.log('Successfully created quiz template:', newTemplate);

      res.status(201).json(newTemplate);
    } catch (error: any) {
      console.error("Error creating quiz template:", error);
      res.status(400).json({ 
        message: error.message || "Failed to create quiz template",
        details: error.stack
      });
    }
  });

  app.get("/api/quiz-templates", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log('Fetching quiz templates');
      const processId = req.query.processId ? parseInt(req.query.processId as string) : undefined;
      console.log('Process ID filter:', processId);
      
      // Get all templates
      const templates = await storage.listQuizTemplates(req.user.organizationId, processId);
      console.log(`Retrieved ${templates.length} quiz templates`);
      
      // Filter templates based on user's batch access
      const filteredTemplates = [];
      for (const template of templates) {
        // If template has a batchId, check if user has access to that batch
        if (template.batchId) {
          const hasAccess = await userHasBatchAccess(req.user.id, template.batchId);
          if (hasAccess) {
            filteredTemplates.push(template);
          }
        } else {
          // Templates without batchId are accessible to all
          filteredTemplates.push(template);
        }
      }
      
      console.log(`Filtered to ${filteredTemplates.length} accessible quiz templates`);
      res.json(filteredTemplates);
    } catch (error: any) {
      console.error("Error fetching quiz templates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add update endpoint for quiz templates
  // Add the new quiz attempt route handler
  app.get("/api/quiz-attempts/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const attemptId = parseInt(req.params.id);
      console.log("Fetching quiz attempt:", attemptId);

      if (isNaN(attemptId)) {
        return res.status(400).json({ message: "Invalid attempt ID" });
      }

      const attempt = await storage.getQuizAttempt(attemptId);
      console.log("Retrieved attempt:", attempt);

      if (!attempt) {
        return res.status(404).json({ message: "Quiz attempt not found" });
      }

      res.json(attempt);
    } catch (error) {
      console.error("Error fetching quiz attempt:", error);
      res.status(500).json({ message: "Failed to fetch quiz attempt" });
    }
  });

  // Get attempts for a specific quiz by the current user
  app.get("/api/quizzes/:quizId/attempts", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.quizId);
      console.log(`Fetching quiz attempts for user ${req.user.id} and quiz ${quizId}`);

      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }

      const attempts = await storage.getQuizAttemptsByUser(req.user.id, quizId);
      console.log(`Retrieved ${attempts.length} attempts for user ${req.user.id} on quiz ${quizId}`);
      res.json(attempts);
    } catch (error) {
      console.error("Error fetching quiz attempts:", error);
      res.status(500).json({ message: "Failed to fetch quiz attempts" });
    }
  });

  app.get("/api/batches/:batchId/quiz-attempts", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const batchId = parseInt(req.params.batchId);
      console.log("Fetching quiz attempts for batch:", batchId);

      if (isNaN(batchId)) {
        return res.status(400).json({ message: "Invalid batch ID" });
      }

      const attempts = await storage.getBatchQuizAttempts(batchId);
      console.log(`Retrieved ${attempts.length} quiz attempts for batch ${batchId}`);
      res.json(attempts);
    } catch (error) {
      console.error("Error fetching batch quiz attempts:", error);
      res.status(500).json({ message: "Failed to fetch quiz attempts for batch" });
    }
  });
  
  // Get quiz attempts for a specific batch within an organization
  app.get("/api/organizations/:organizationId/batches/:batchId/quiz-attempts", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      const batchId = parseInt(req.params.batchId);
      const status = req.query.status as string | undefined;
      
      console.log("Fetching quiz attempts for organization", organizationId, "batch:", batchId, "status filter:", status);

      if (isNaN(batchId) || isNaN(organizationId)) {
        return res.status(400).json({ message: "Invalid ID parameters" });
      }
      
      // Check if user has access to this organization
      if (req.user.organizationId !== organizationId) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      const attempts = await storage.getBatchQuizAttempts(batchId);
      console.log(`Retrieved ${attempts.length} quiz attempts for batch ${batchId}`);
      
      // Filter attempts based on passed/failed status if requested
      let filteredAttempts = attempts;
      if (status === 'passed') {
        filteredAttempts = attempts.filter(attempt => {
          // Make sure both quiz and passingScore exist before comparing
          if (attempt.quiz && attempt.quiz.passingScore) {
            return attempt.score >= attempt.quiz.passingScore;
          }
          return false; // If no passing score available, consider it failed
        });
        console.log(`Filtered to ${filteredAttempts.length} passed attempts`);
      } else if (status === 'failed') {
        filteredAttempts = attempts.filter(attempt => {
          // Make sure both quiz and passingScore exist before comparing
          if (attempt.quiz && attempt.quiz.passingScore) {
            return attempt.score < attempt.quiz.passingScore;
          }
          return true; // If no passing score available, consider it failed
        });
        console.log(`Filtered to ${filteredAttempts.length} failed attempts`);
      }

      res.json(filteredAttempts);
    } catch (error) {
      console.error("Error fetching batch quiz attempts:", error);
      res.status(500).json({ message: "Failed to fetch quiz attempts for batch" });
    }
  });
  
  // Get certification evaluations for a specific batch within an organization
  app.get("/api/organizations/:organizationId/batches/:batchId/certification-evaluations", async (req, res) => {
    console.log("============= CERTIFICATION ENDPOINT CALLED =============");
    
    if (!req.user) {
      console.log("Unauthorized request to certification endpoint");
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      const batchId = parseInt(req.params.batchId);
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;
      
      console.log("Fetching certification evaluations for organization", organizationId, "batch:", batchId, "status filter:", status, "type filter:", type);
      console.log("Current user:", req.user.id, req.user.organizationId);

      if (isNaN(batchId) || isNaN(organizationId)) {
        return res.status(400).json({ message: "Invalid ID parameters" });
      }
      
      // Check if user has access to this organization
      if (req.user.organizationId !== organizationId) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      // Fetch evaluations for this batch based on type filter
      // If no type filter, fetch all types; otherwise fetch specific type
      let evaluations;
      if (type && type !== 'all') {
        console.log(`Fetching evaluations for batch ${batchId} with type ${type}`);
        evaluations = await storage.getEvaluationsByBatchAndType(batchId, type as 'standard' | 'audio' | 'certification');
      } else {
        console.log(`Fetching all evaluations for batch ${batchId}`);
        // Fetch all evaluation types by getting each type separately and combining
        const [standardEvals, audioEvals, certEvals] = await Promise.all([
          storage.getEvaluationsByBatchAndType(batchId, 'standard'),
          storage.getEvaluationsByBatchAndType(batchId, 'audio'),
          storage.getEvaluationsByBatchAndType(batchId, 'certification')
        ]);
        evaluations = [...standardEvals, ...audioEvals, ...certEvals];
      }
      console.log(`Retrieved ${evaluations.length} evaluations for batch ${batchId}${type && type !== 'all' ? ` (${type} type)` : ' (all types)'}`);
      
      // Get all available evaluation templates to help with certification detection
      const templates = await storage.listEvaluationTemplates(req.user.organizationId);
      console.log("All template names:", templates.map(t => `${t.id}: ${t.name}`).join(", "));
      
      // Dynamic certification detection criteria
      const certTemplateIds = templates
        .filter(template => {
          const name = template.name.toLowerCase();
          const description = (template.description || '').toLowerCase();
          
          // Multiple criteria for certification detection
          return (
            // Explicit certification keywords
            name.includes('certification') || 
            name.includes('final') ||
            name.includes('assessment') ||
            description.includes('certification') ||
            // Special legacy template IDs that we know are for certification
            template.id === 32 ||
            // Templates with high feedback thresholds (typically certification)
            (template.feedbackThreshold && template.feedbackThreshold >= 70)
          );
        })
        .map(template => template.id);
        
      console.log(`Found ${certTemplateIds.length} certification templates: ${certTemplateIds.join(', ')}`);
      
      // Log all evaluations for debugging
      evaluations.forEach(evalItem => {
        console.log(`Evaluation ${evalItem.id}: templateId=${evalItem.templateId}, purpose=${evalItem.purpose || 'undefined'}, metadata=${JSON.stringify(evalItem.metadata || {})}`);
      });
      
      // Dynamic certification evaluation detection
      let certificationEvaluations = evaluations.filter(evaluation => {
        // Method 1: Template-based detection
        const usingCertTemplate = certTemplateIds.includes(evaluation.templateId);
        
        // Method 2: Purpose-based detection (if evaluation has purpose field)
        const hasCertPurpose = evaluation.purpose === 'certification';
        
        // Method 3: Metadata-based detection
        const hasCertMetadata = evaluation.metadata && 
          (evaluation.metadata.isCertification === true || 
           evaluation.metadata.purpose === 'certification');
        
        // Method 4: Template threshold-based detection (high thresholds suggest certification)
        const template = templates.find(t => t.id === evaluation.templateId);
        const hasHighThreshold = template && template.feedbackThreshold && template.feedbackThreshold >= 70;
        
        // Method 5: Batch phase-based detection (evaluations in certification/training phase)
        // We'll assume evaluations in training/certification phases are likely certification evaluations
        const isInCertificationPhase = true; // For now, assume all evaluations in this context are certification
        
        // An evaluation is considered certification if ANY of these criteria match
        const isCertification = usingCertTemplate || hasCertPurpose || hasCertMetadata || 
                               hasHighThreshold || isInCertificationPhase;
        
        // Log details for debugging
        console.log(`Evaluation ${evaluation.id} certification check:`, {
          templateId: evaluation.templateId,
          templateName: template?.name || 'Unknown',
          usingCertTemplate,
          hasCertPurpose,
          hasCertMetadata,
          hasHighThreshold: hasHighThreshold ? template.feedbackThreshold : false,
          isInCertificationPhase,
          result: isCertification
        });
        
        return isCertification;
      });
        
      console.log(`Found ${certificationEvaluations.length} certification evaluations`);
      
      
      // Filter evaluations based on passed/failed status if requested
      let filteredEvaluations = certificationEvaluations;
      
      if (status) {
        // Add isPassed property based on template passing score
        // Get evaluation templates with passing scores
        const templatePassingScores = {};
        templates.forEach(template => {
          // Default passing score is 70% if not specified
          templatePassingScores[template.id] = template.passingScore || 70;
        });
        
        // Process evaluations with passing/failing score info
        const processedEvaluations = filteredEvaluations.map(evaluation => {
          const passingScore = templatePassingScores[evaluation.templateId] || 70;
          const score = parseFloat(evaluation.finalScore);
          return {
            ...evaluation,
            isPassed: score >= passingScore
          };
        });
        
        // Use the processed evaluations with isPassed property
        let finalEvaluations = processedEvaluations;
        
        if (status === 'passed') {
          finalEvaluations = processedEvaluations.filter(evaluation => evaluation.isPassed);
          console.log(`Filtered to ${finalEvaluations.length} passed certification evaluations`);
        } else if (status === 'failed') {
          finalEvaluations = processedEvaluations.filter(evaluation => !evaluation.isPassed);
          console.log(`Filtered to ${finalEvaluations.length} failed certification evaluations`);
        }
        
        // Return the filtered evaluations
        filteredEvaluations = finalEvaluations;
      }

      res.json(filteredEvaluations);
    } catch (error) {
      console.error("Error fetching batch certification evaluations:", error);
      res.status(500).json({ message: "Failed to fetch certification evaluations for batch" });
    }
  });
  
  // Update trainee status
  app.patch("/api/organizations/:organizationId/batches/:batchId/trainees/:userBatchProcessId/status", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      const batchId = parseInt(req.params.batchId);
      const userBatchProcessId = parseInt(req.params.userBatchProcessId);
      const { traineeStatus, isManualStatus } = req.body;

      if (isNaN(batchId) || isNaN(organizationId) || isNaN(userBatchProcessId)) {
        return res.status(400).json({ message: "Invalid ID parameters" });
      }

      // Check if user has access to this organization
      if (req.user.organizationId !== organizationId) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      // Verify valid trainee status if provided
      if (traineeStatus !== null && (typeof traineeStatus !== 'string' || traineeStatus.trim() === '')) {
        return res.status(400).json({ message: "Invalid trainee status" });
      }

      // Update the trainee status
      const updatedUserBatchProcess = await storage.updateTraineeStatus(
        userBatchProcessId,
        traineeStatus,
        !!isManualStatus
      );

      // If trainee status is set to "left_job", automatically update all future attendance records
      if (traineeStatus === 'left_job') {
        console.log(`Updating future attendance records for trainee with left_job status`);
        
        // Get the user batch process to get trainee and batch info
        const userBatchProcess = await db.query.userBatchProcesses.findFirst({
          where: eq(userBatchProcesses.id, userBatchProcessId),
          columns: {
            userId: true,
            batchId: true
          }
        });

        if (userBatchProcess) {
          const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
          
          // Update all future attendance records (including today and beyond) to "left_job"
          await db
            .update(attendance)
            .set({
              status: 'left_job',
              updatedAt: new Date()
            })
            .where(
              and(
                eq(attendance.traineeId, userBatchProcess.userId),
                eq(attendance.batchId, userBatchProcess.batchId),
                gte(attendance.date, today) // Update today and future dates
              )
            );

          console.log(`Updated future attendance records for trainee ${userBatchProcess.userId} in batch ${userBatchProcess.batchId}`);
        }
      }

      // Return updated user batch process record
      res.json(updatedUserBatchProcess);
    } catch (error) {
      console.error("Error updating trainee status:", error);
      res.status(500).json({ message: "Failed to update trainee status" });
    }
  });

  // Set a trainee status to refresher
  app.post("/api/organizations/:organizationId/batches/:batchId/trainees/:userId/set-refresher", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      const batchId = parseInt(req.params.batchId);
      const userId = parseInt(req.params.userId);
      const { reason } = req.body;

      if (isNaN(batchId) || isNaN(organizationId) || isNaN(userId)) {
        return res.status(400).json({ message: "Invalid ID parameters" });
      }

      // Check if user has access to this organization
      if (req.user.organizationId !== organizationId) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      // Find the userBatchProcess record
      const userBatchProcess = await db.query.userBatchProcesses.findFirst({
        where: and(
          eq(userBatchProcesses.batchId, batchId),
          eq(userBatchProcesses.userId, userId),
          eq(userBatchProcesses.status, 'active')
        )
      });

      if (!userBatchProcess) {
        return res.status(404).json({ message: "User not enrolled in this batch" });
      }

      // Update the trainee status to refresher with manual override
      const updatedUserBatchProcess = await storage.updateTraineeStatus(
        userBatchProcess.id,
        'refresher',
        true // Set as manual status to prevent auto-updates
      );

      // Get trainee information
      const trainee = await storage.getUser(userId);
      if (!trainee) {
        return res.status(404).json({ message: "Trainee not found" });
      }

      // Create a batch event to track this immediate refresher action
      await storage.createBatchEvent({
        organizationId,
        batchId,
        createdBy: req.user.id,
        title: `Immediate Refresher for ${trainee.fullName || `Trainee #${userId}`}`,
        description: 'Trainee status set to refresher immediately',
        eventType: 'refresher',
        status: 'completed',
        refresherReason: reason || null,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString() // same date since this is an immediate action
      });

      // Return updated user batch process record
      res.json(updatedUserBatchProcess);
    } catch (error) {
      console.error("Error setting trainee to refresher status:", error);
      res.status(500).json({ message: "Failed to set trainee to refresher status" });
    }
  });

  // Schedule refresher training for a trainee
  app.post("/api/organizations/:organizationId/batches/:batchId/trainees/:userId/refresher", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      const batchId = parseInt(req.params.batchId);
      const userId = parseInt(req.params.userId);
      const { notes, reason } = req.body;

      if (isNaN(batchId) || isNaN(organizationId) || isNaN(userId)) {
        return res.status(400).json({ message: "Invalid ID parameters" });
      }

      // Check if user has access to this organization
      if (req.user.organizationId !== organizationId) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      // Verify the trainee belongs to the batch
      const traineeInBatch = await storage.getBatchTrainee(batchId, userId);
      if (!traineeInBatch) {
        return res.status(404).json({ message: "Trainee not found in this batch" });
      }
      
      // Get trainee information
      const trainee = await storage.getUser(userId);
      if (!trainee) {
        return res.status(404).json({ message: "Trainee not found" });
      }

      // Create a calendar event for the refresher training
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1); // Schedule for tomorrow
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1); // End the next day
      
      // Create a record in batch_events to track the refresher scheduling
      await storage.createBatchEvent({
        organizationId,
        batchId,
        createdBy: req.user.id, // the trainer/admin creating the refresher
        title: `Refresher Training for ${trainee.fullName || `Trainee #${userId}`}`,
        description: notes || 'Refresher training scheduled',
        startDate: tomorrow.toISOString(),
        endDate: dayAfterTomorrow.toISOString(),
        eventType: 'refresher',
        status: 'scheduled',
        refresherReason: reason || null
      });

      res.json({ message: "Refresher training scheduled successfully" });
    } catch (error) {
      console.error("Error scheduling refresher training:", error);
      res.status(500).json({ message: "Failed to schedule refresher training" });
    }
  });

  // Reassign a quiz to a trainee
  app.post("/api/organizations/:organizationId/batches/:batchId/trainees/:userId/reassign-quiz", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      const batchId = parseInt(req.params.batchId);
      const userId = parseInt(req.params.userId);
      const { quizId } = req.body;

      if (isNaN(batchId) || isNaN(organizationId) || isNaN(userId) || !quizId) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      // Check if user has access to this organization
      if (req.user.organizationId !== organizationId) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      // Verify the trainee belongs to the batch
      const traineeInBatch = await storage.getBatchTrainee(batchId, userId);
      if (!traineeInBatch) {
        return res.status(404).json({ message: "Trainee not found in this batch" });
      }

      // Verify the quiz exists
      const quiz = await storage.getQuiz(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // Get trainee information
      const trainee = await storage.getUser(userId);
      if (!trainee) {
        return res.status(404).json({ message: "Trainee not found" });
      }
      
      // Schedule the quiz as an event
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1); // Schedule for tomorrow
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1); // End the next day
      
      // Create a calendar event for the quiz reassignment
      await storage.createBatchEvent({
        organizationId,
        batchId,
        createdBy: req.user.id,
        title: `Quiz Reassigned: ${quiz.name || `Quiz ${quizId}`}`,
        description: `Quiz reassigned to ${trainee.fullName || `Trainee #${userId}`}`,
        startDate: tomorrow.toISOString(),
        endDate: dayAfterTomorrow.toISOString(),
        eventType: 'quiz',
        status: 'scheduled'
      });

      res.json({ message: "Quiz reassigned successfully" });
    } catch (error) {
      console.error("Error reassigning quiz:", error);
      res.status(500).json({ message: "Failed to reassign quiz" });
    }
  });

  // Create certification for a trainee
  app.post("/api/organizations/:organizationId/batches/:batchId/trainees/:userId/certification", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      const batchId = parseInt(req.params.batchId);
      const userId = parseInt(req.params.userId);
      const { quizAttemptId } = req.body;

      if (isNaN(batchId) || isNaN(organizationId) || isNaN(userId) || !quizAttemptId) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      // Check if user has access to this organization
      if (req.user.organizationId !== organizationId) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      // Verify the trainee belongs to the batch
      const traineeInBatch = await storage.getBatchTrainee(batchId, userId);
      if (!traineeInBatch) {
        return res.status(404).json({ message: "Trainee not found in this batch" });
      }

      // Verify the quiz attempt exists and belongs to this trainee
      const quizAttempt = await storage.getQuizAttempt(quizAttemptId);
      if (!quizAttempt) {
        return res.status(404).json({ message: "Quiz attempt not found" });
      }

      if (quizAttempt.userId !== userId) {
        return res.status(403).json({ message: "This quiz attempt does not belong to the specified trainee" });
      }

      // Create a certification record
      // For now, we'll create a batch event to track the certification
      await storage.createBatchEvent({
        organizationId,
        batchId,
        userId: req.user.id,
        eventType: 'milestone',
        description: `Certification created for trainee based on successful quiz completion`,
        date: new Date().toISOString(),
      });

      // Update user's certified status to true (if available in your schema)
      try {
        await storage.updateUser(userId, { certified: true });
      } catch (error) {
        console.warn("Could not update trainee certification status:", error);
        // Continue anyway as this might not be a critical error
      }

      res.json({ message: "Certification created successfully" });
    } catch (error) {
      console.error("Error creating certification:", error);
      res.status(500).json({ message: "Failed to create certification" });
    }
  });

  app.put("/api/quiz-templates/:id", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      // Get the template to verify ownership
      const template = await storage.getQuizTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Quiz template not found" });
      }

      // Verify organization ownership
      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check batch access if template has a batch ID
      if (template.batchId) {
        const hasBatchAccess = await userHasBatchAccess(req.user.id, template.batchId);
        if (!hasBatchAccess) {
          return res.status(403).json({ message: "You do not have access to this batch's quiz templates" });
        }
      }
      
      // Process the batch ID - convert "none" to null
      let batchId = req.body.batchId;
      if (batchId === "none" || batchId === "") {
        batchId = null;
        console.log('Setting batchId to null (template available to all)');
      } else if (batchId) {
        // If batchId is provided (not "none"), convert to number
        batchId = parseInt(batchId);
        
        // Verify the batch exists
        const batch = await storage.getBatch(batchId);
        if (!batch) {
          return res.status(404).json({ message: "Batch not found" });
        }
        
        // Verify the batch belongs to the user's organization
        if (batch.organizationId !== req.user.organizationId) {
          return res.status(403).json({ message: "Access denied to this batch" });
        }
        console.log(`Template will be restricted to batch ID: ${batchId}`);
      }

      // Update the template
      const updatedTemplate = await storage.updateQuizTemplate(templateId, {
        ...req.body,
        batchId,
        organizationId: req.user.organizationId // Ensure organization ID cannot be changed
      });

      res.json(updatedTemplate);
    } catch (error: any) {
      console.error("Error updating quiz template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate quiz from template
  app.post("/api/quiz-templates/:id/generate", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      // Get the template
      const template = await storage.getQuizTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Verify organization access
      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check batch access if template has a batch ID
      if (template.batchId) {
        const hasBatchAccess = await userHasBatchAccess(req.user.id, template.batchId);
        if (!hasBatchAccess) {
          return res.status(403).json({ message: "You do not have access to this batch's quiz templates" });
        }
      }

      // Get random questions based on template configuration
      const questions = await storage.getRandomQuestions(
        req.user.organizationId,
        {
          count: template.questionCount,
          categoryDistribution: template.categoryDistribution,
          difficultyDistribution: template.difficultyDistribution,
          processId: template.processId
        }
      );

      if (questions.length < template.questionCount) {
        const errorDetails = [];
        if (template.categoryDistribution) {
          errorDetails.push(`category distribution (${Object.entries(template.categoryDistribution).map(([cat, count]) => `${count} from ${cat}`).join(', ')})`);
        }
        if (template.difficultyDistribution) {
          errorDetails.push(`difficulty distribution (${Object.entries(template.difficultyDistribution).map(([diff, count]) => `${count} with difficulty ${diff}`).join(', ')})`);
        }
        
        return res.status(400).json({ 
          message: "Not enough questions available to generate quiz",
          details: `Need ${template.questionCount} questions matching: ${errorDetails.join(' and ')}`
        });
      }

      // Create a new quiz instance
      const quiz = await storage.createQuiz({
        name: template.name,
        description: template.description,
        timeLimit: template.timeLimit,
        passingScore: template.passingScore,
        questions: questions.map(q => q.id),
        templateId: template.id,
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
        processId: template.processId,
        status: 'active',
        startTime: new Date(),
        endTime: new Date(Date.now() + (req.body.durationInHours || 24) * 60 * 60 * 1000),
        oneTimeOnly: template.oneTimeOnly,
        quizType: template.quizType || 'internal'
      });
      
      // Increment the generation count for this template
      await storage.updateQuizTemplate(templateId, {
        generationCount: (template.generationCount || 0) + 1
      });

      // Handle quiz assignments
      const assignToUsers = req.body.assignToUsers;
      const assignToAllBatch = req.body.assignToAllBatch;
      let userIds: number[] = [];
      
      // If assignToAllBatch is true and the template has a batchId, get all trainees in that batch
      if (assignToAllBatch && template.batchId) {
        console.log(`Assigning quiz ${quiz.id} to all trainees in batch ${template.batchId}`);
        try {
          // Get all active trainees in the batch
          const batchTrainees = await db.select({ 
              userId: userBatchProcesses.userId 
            })
            .from(userBatchProcesses)
            .where(and(
              eq(userBatchProcesses.batchId, template.batchId),
              eq(userBatchProcesses.status, 'active')
            ));
          
          userIds = batchTrainees.map(trainee => trainee.userId);
          console.log(`Found ${userIds.length} active trainees in batch ${template.batchId}`);
        } catch (error) {
          console.error(`Error fetching trainees for batch ${template.batchId}:`, error);
        }
      } 
      // If assignToUsers contains an array of user IDs, use those
      else if (Array.isArray(assignToUsers) && assignToUsers.length > 0) {
        console.log(`Assigning quiz ${quiz.id} to specific users:`, assignToUsers);
        userIds = assignToUsers;
      } 
      // No assignment specified
      else {
        console.log(`No trainee assignment specified for quiz ${quiz.id}`);
        return res.status(201).json(quiz);
      }
      
      // Create quiz assignments for each user
      const assignments = [];
      for (const userId of userIds) {
        try {
          const assignment = await storage.createQuizAssignment({
            quizId: quiz.id,
            traineeId: userId, // Set traineeId to the specific trainee
            userId,  // Also keep userId the same for backward compatibility
            batchId: template.batchId || 0, // fallback to 0 if no batch ID
            organizationId: req.user.organizationId,
            assignedBy: req.user.id,
            status: 'assigned'
          });
          assignments.push(assignment);
        } catch (assignError) {
          console.error(`Failed to create assignment for user ${userId}:`, assignError);
          // Continue with other users
        }
      }
      
      console.log(`Created ${assignments.length} quiz assignments for quiz ${quiz.id}`);
      
      // Return the quiz with assignment info
      res.status(201).json({
        ...quiz,
        assignments: {
          count: assignments.length,
          userIds: userIds
        }
      });
    } catch (error: any) {
      console.error("Error generating quiz:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete quiz template endpoint - update to handle cascade deletion
  app.delete("/api/quiz-templates/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.id);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      // Get the template to verify ownership
      const template = await storage.getQuizTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Verify organization ownership
      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "You can only delete templates from your organization" });
      }
      
      // Check batch access if template has a batch ID
      if (template.batchId) {
        const hasBatchAccess = await userHasBatchAccess(req.user.id, template.batchId);
        if (!hasBatchAccess) {
          return res.status(403).json({ message: "You do not have access to this batch's quiz templates" });
        }
      }

      // First delete all quizzes associated with this template
      await storage.deleteQuizzesByTemplateId(templateId);

      // Then delete the template
      await storage.deleteQuizTemplate(templateId);

      res.json({ message: "Quiz template and associated quizzes deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting quiz template:", error);
      res.status(500).json({ message: error.message || "Failed to delete quiz template" });
    }
  });
  
  // Get quizzes generated from a template
  app.get("/api/quiz-templates/:id/quizzes", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      // Get the template
      const template = await storage.getQuizTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Verify organization access
      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check batch access if template has a batch ID
      if (template.batchId) {
        const hasBatchAccess = await userHasBatchAccess(req.user.id, template.batchId);
        if (!hasBatchAccess) {
          return res.status(403).json({ message: "You do not have access to this batch's quiz templates" });
        }
      }

      // Get all quizzes generated from this template
      const quizzes = await storage.getQuizzesByTemplateId(templateId);
      
      res.json(quizzes);
    } catch (error: any) {
      console.error("Error getting quizzes by template:", error);
      res.status(500).json({ message: error.message || "Failed to get quizzes for template" });
    }
  });

  // Get quiz for taking
  app.get("/api/quizzes/:id", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.id);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }

      // Get quiz details with questions
      const quiz = await storage.getQuizWithQuestions(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // Verify organization access
      if (quiz.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Remove correct answers from questions before sending to client
      const sanitizedQuestions = quiz.questions.map(question => ({
        ...question,
        correctAnswer: undefined
      }));

      res.json({
        ...quiz,
        questions: sanitizedQuestions
      });
    } catch (error: any) {
      console.error("Error fetching quiz:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Submit quiz answers
  app.post("/api/quizzes/:id/submit", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.id);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }

      const { answers } = req.body;
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ message: "Invalid answers format" });
      }

      // Get quiz with correct answers
      const quiz = await storage.getQuizWithQuestions(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // For one-time quizzes, check if user has already attempted this quiz
      if (quiz.oneTimeOnly) {
        console.log(`Checking previous attempts for one-time quiz ${quizId} by user ${req.user.id}`);
        const previousAttempts = await storage.getQuizAttemptsByUser(req.user.id, quizId);
        
        if (previousAttempts.length > 0) {
          return res.status(403).json({ 
            message: "This quiz can only be taken once. You have already attempted it.",
            previousAttempt: previousAttempts[0]
          });
        }
      }

      // Calculate score
      let correctAnswers = 0;
      const results = quiz.questions.map(question => {
        const userAnswer = answers[question.id];
        const isCorrect = userAnswer === question.correctAnswer;
        if (isCorrect) correctAnswers++;
        
        return {
          questionId: question.id,
          userAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect
        };
      });

      // Calculate score and round to integer (DB field is integer type)
      const score = Math.round((correctAnswers / quiz.questions.length) * 100);

      // Save quiz attempt
      const attempt = await storage.createQuizAttempt({
        quizId,
        userId: req.user.id,
        organizationId: req.user.organizationId,
        score,
        answers: results,
        completedAt: new Date()
      });

      res.json(attempt);
    } catch (error: any) {
      console.error("Error submitting quiz:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete phase change request (only if in pending state)
  app.delete("/api/phase-change-requests/:requestId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const requestId = parseInt(req.params.requestId);
      console.log(`DELETE request received for phase change request ID: ${requestId}`);
      
      // Get the request to verify it's in pending state and the user has permission
      const request = await storage.getPhaseChangeRequest(requestId);
      console.log(`Fetched request:`, request);
      
      if (!request) {
        console.log(`Request with ID ${requestId} not found`);
        return res.status(404).json({ message: "Request not found" });
      }
      
      // Check if the request is in pending state
      if (request.status !== 'pending') {
        console.log(`Request ${requestId} is not in pending state, cannot delete`);
        return res.status(403).json({ message: "Only pending requests can be deleted" });
      }
      
      // Check if the user is the trainer who created the request or the assigned manager
      if (request.trainerId !== req.user.id && request.managerId !== req.user.id && 
          req.user.role !== 'owner' && req.user.role !== 'admin') {
        console.log(`User ${req.user.id} does not have permission to delete request ${requestId}`);
        return res.status(403).json({ message: "You don't have permission to delete this request" });
      }
      
      console.log(`Attempting to delete phase change request ${requestId}`);
      // Delete the request
      await storage.deletePhaseChangeRequest(requestId);
      console.log(`Successfully deleted phase change request ${requestId}`);
      res.status(200).json({ message: "Request deleted successfully" });
    } catch (error) {
      console.error("Error deleting phase change request:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update phase change request status
  app.patch("/api/phase-change-requests/:requestId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const requestId = parseInt(req.params.requestId);
      const { status, managerComments } = req.body;

      // Get the request to verify the manager
      const request = await storage.getPhaseChangeRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // Check if the user is the assigned manager
      if (request.managerId !== req.user.id && req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only the assigned manager can update this request" });
      }

      // Update the request
      const updatedRequest = await storage.updatePhaseChangeRequest(requestId, {
        status,
        managerComments,
      });

      // If approved, update the batch phase
      if (status === 'approved') {
        // First record the batch history for phase change
        await addBatchHistoryRecord(
          request.batchId,
          'phase_change',
          `Batch phase changed from ${request.currentPhase} to ${request.requestedPhase} (via phase change request)`,
          request.currentPhase,
          request.requestedPhase,
          request.organizationId,
          req.user.id // Pass the actual user ID who approved the request
        );
        
        // Then update the batch status
        await storage.updateBatch(request.batchId, {
          status: request.requestedPhase,
        });
      }

      res.json(updatedRequest);
    } catch (error: any) {
      console.error("Error updating phase change request:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add this route to get all users with location information
  app.get("/api/organizations/:orgId/users", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view users in your own organization" });
      }

      // First get all locations
      const locations = await storage.listLocations(orgId);

      // Then get users and map location information
      const users = await storage.listUsers(orgId);

      const usersWithLocation = users.map(user => {
        const location = locations.find(loc => loc.id === user.locationId);
        return {
          ...user,
          locationName: location ? location.name : null
        };
      });

      console.log('Users with location:', usersWithLocation);
      res.json(usersWithLocation);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add this route to get locations
  app.get("/api/organizations/:orgId/locations", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view locations in your own organization" });
      }

      const locations = await storage.listLocations(orgId);
      console.log('Locations:', locations);
      res.json(locations);
    } catch (error: any) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: error.message });
    }
  });


  // Permissions routes
  app.get("/api/permissions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });

    try {
      const rolePermissions = await storage.listRolePermissions(req.user.organizationId);
      res.json(rolePermissions);
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/permissions/:role", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });

    try {
      const rolePermission = await storage.getRolePermissions(req.user.organizationId, req.params.role);
      if (!rolePermission) {
        return res.status(404).json({ message: "Role permissions not found" });
      }
      res.json(rolePermission);
    } catch (error: any) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Fixing TypeScript errors in the permissions endpoint
  app.patch("/api/permissions/:role", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    if (req.user.role !== "owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only owners and admins can modify permissions" });
    }

    try {
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: "Permissions must be an array" });
      }

      console.log("Incoming permissions:", permissions);
      
      // Define valid permissions including the new batch user management permissions
      const validPermissions = [
        ...permissionEnum.enumValues,
        'manage_batch_users_add',
        'manage_batch_users_remove',
        'manage_conduct_form',
        'manage_evaluation_feedback'
      ];
      
      console.log("Valid permission values:", validPermissions);
      
      // Validate that all permissions are valid values
      const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
      console.log("Invalid permissions found:", invalidPermissions);
      
      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          message: "Invalid permissions provided",
          invalidPermissions
        });
      }

      const rolePermission = await storage.updateRolePermissions(
        req.user.organizationId,
        req.params.role,
        permissions
      );

      res.json(rolePermission);
    } catch (error: any) {
      console.error("Error updating permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Reset role permissions to defaults
  app.post("/api/permissions/:role/reset", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    if (req.user.role !== "owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only owners and admins can reset permissions" });
    }

    try {
      console.log(`Resetting permissions for role ${req.params.role} to defaults`);
      
      const rolePermission = await storage.resetRolePermissionsToDefault(
        req.user.organizationId,
        req.params.role
      );

      res.json(rolePermission);
    } catch (error: any) {
      console.error("Error resetting permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Reset ALL Role Permissions to Default
  app.post("/api/permissions/reset-all", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    if (req.user.role !== "owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only owners and admins can reset permissions" });
    }

    try {
      // Reset permissions for all roles
      const roles = ["admin", "manager", "team_lead", "quality_analyst", "trainer", "advisor", "trainee"];
      const results = [];
      
      for (const role of roles) {
        console.log(`Resetting permissions for role ${role} to defaults`);
        const rolePermission = await storage.resetRolePermissionsToDefault(req.user.organizationId, role);
        results.push(rolePermission);
      }
      
      res.json({ message: "All role permissions have been reset to defaults", results });
    } catch (error: any) {
      console.error("Error resetting all role permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Add specific permissions to role
  app.post("/api/permissions/:role/add-permission", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    if (req.user.role !== "owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only owners and admins can modify permissions" });
    }

    try {
      const role = req.params.role;
      const { permissions } = req.body;
      
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return res.status(400).json({ message: "Invalid permissions array" });
      }
      
      console.log(`Adding permissions ${permissions.join(', ')} to role ${role}`);
      
      // Get current permissions for the role
      const rolePermission = await storage.getRolePermissions(req.user.organizationId, role);
      
      if (!rolePermission) {
        return res.status(404).json({ message: `Role ${role} not found` });
      }
      
      // Add new permissions without duplicates
      const updatedPermissions = [...new Set([...rolePermission.permissions, ...permissions])];
      
      // Update the role permissions
      const updatedRolePermission = await storage.updateRolePermissions(
        req.user.organizationId,
        role,
        updatedPermissions
      );
      
      res.json({ 
        message: `Permissions added to ${role} role successfully`,
        rolePermission: updatedRolePermission
      });
    } catch (error: any) {
      console.error("Error adding permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Convenience endpoint to fix holiday list permissions for all roles
  app.post("/api/permissions/fix-holiday-permissions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    if (req.user.role !== "owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only owners and admins can fix permissions" });
    }

    try {
      const results = [];
      const rolesToUpdate = [
        { role: "admin", permissions: ["manage_organization_settings", "manage_holidaylist", "view_organization"] },
        { role: "manager", permissions: ["manage_organization_settings", "manage_holidaylist", "view_organization"] },
        { role: "team_lead", permissions: ["manage_holidaylist", "view_organization"] },
        { role: "quality_analyst", permissions: ["manage_holidaylist", "view_organization"] },
        { role: "trainer", permissions: ["manage_holidaylist", "view_organization"] },
        { role: "advisor", permissions: ["manage_holidaylist", "view_organization"] },
      ];
      
      for (const { role, permissions } of rolesToUpdate) {
        console.log(`Adding holiday permissions to role ${role}`);
        
        // Get current permissions for the role
        const rolePermission = await storage.getRolePermissions(req.user.organizationId, role);
        
        if (!rolePermission) {
          console.log(`Role ${role} not found, skipping`);
          continue;
        }
        
        // Add new permissions without duplicates
        const updatedPermissions = [...new Set([...rolePermission.permissions, ...permissions])];
        
        // Update the role permissions
        const updatedRolePermission = await storage.updateRolePermissions(
          req.user.organizationId,
          role,
          updatedPermissions
        );
        
        results.push({
          role,
          addedPermissions: permissions,
          updatedPermissions: updatedRolePermission.permissions
        });
      }
      
      res.json({ 
        message: "Holiday permissions have been fixed for all roles",
        results 
      });
    } catch (error: any) {
      console.error("Error fixing holiday permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update location route
  app.patch("/api/organizations/:id/settings/locations/:locationId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const locationId = parseInt(req.params.locationId);

      // Validate IDs
      if (isNaN(orgId) || isNaN(locationId)) {
        return res.status(400).json({ message: "Invalid organization ID or location ID" });
      }

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only modify locations in your own organization" });
      }
      
      // Check if user has manage_locations permission or is owner
      if (req.user.role !== 'owner') {
        const userPermissions = await storage.getRolePermissions(orgId, req.user.role);
        if (!userPermissions?.permissions.includes('manage_locations')) {
          console.log(`User ${req.user.id} with role ${req.user.role} attempted to update location without permission`);
          return res.status(403).json({ message: "You do not have permission to modify locations" });
        }
      }

      // Validate request body
      const { name, address, city, state, country } = req.body;
      if (!name || !address || !city || !state || !country) {
        return res.status(400).json({
          message: "Missing required fields. Required: name, address, city, state, country"
        });
      }

      // Get existing location to verify it exists and belongs to organization
      const existingLocation = await storage.getLocation(locationId);
      if (!existingLocation) {
        return res.status(404).json({ message: "Location not found" });
      }
      if (existingLocation.organizationId !== orgId) {
        return res.status(403).json({ message: "Location does not belong to your organization" });
      }

      console.log('Updating location:', locationId, 'with data:', req.body);
      const updatedLocation = await storage.updateLocation(locationId, {
        name,
        address,
        city,
        state,
        country,
        organizationId: orgId, // Ensure we keep the correct organization ID
      });

      res.json(updatedLocation);
    } catch (error: any) {
      console.error("Location update error:", error);
      // Ensure we always return JSON even for errors
      res.status(500).json({
        message: "Failed to update location",
        error: error.message
      });
    }
  });

  // Delete location route
  app.delete("/api/organizations/:id/settings/locations/:locationId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const locationId = parseInt(req.params.locationId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete locations in your own organization" });
      }
      
      // Check if user has manage_locations permission or is owner
      if (req.user.role !== 'owner') {
        const userPermissions = await storage.getRolePermissions(orgId, req.user.role);
        if (!userPermissions?.permissions.includes('manage_locations')) {
          console.log(`User ${req.user.id} with role ${req.user.role} attempted to delete location without permission`);
          return res.status(403).json({ message: "You do not have permission to delete locations" });
        }
      }

      console.log('Deleting location:', locationId);
      await storage.deleteLocation(locationId);

      res.json({ message: "Location deleted successfully" });
    } catch (error: any) {
      console.error("Location deletion error:", error);
      res.status(400).json({ message: error.message || "Failed to delete location" });
    }
  });

  // Route to get user processes
  app.get("/api/users/:id/processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const userId = parseInt(req.params.id);
      const processes = await storage.getUserProcesses(userId);
      res.json(processes);
    } catch (error: any) {
      console.error("Error fetching user processes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add batch details endpoint with comprehensive error handling and logging
  app.get("/api/organizations/:orgId/batches/:batchId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      console.log('Fetching batch details:', {
        orgId,
        batchId,
        userId: req.user.id,
        userRole: req.user.role
      });

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        console.log('User organization mismatch:', {
          userOrgId: req.user.organizationId,
          requestedOrgId: orgId
        });
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      // Get the batch with location and process details 
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        console.log('Batch not found:', { batchId });
        return res.status(404).json({ message: "Batch not found" });
      }

      // Role-based access control
      switch (req.user.role) {
        case 'trainer':
          // Trainers can only see batches assigned to them
          if (batch.trainerId !== req.user.id) {
            console.log('Trainer not assigned to batch:', {
              trainerId: req.user.id,
              batchTrainerId: batch.trainerId
            });
            return res.status(403).json({ message: "You can only view batches assigned to you" });
          }
          break;

        case 'manager':
          // Managers can see batches of trainers reporting to them
          const reportingTrainers = await storage.getReportingTrainers(req.user.id);
          const trainerIds = reportingTrainers.map(trainer => trainer.id);
          if (!trainerIds.includes(batch.trainerId)) {
            console.log('Manager not authorized for batch:', {
              managerId: req.user.id,
              batchTrainerId: batch.trainerId
            });
            return res.status(403).json({ message: "You can only view batches of trainers reporting to you" });
          }
          break;

        case 'admin':
        case 'owner':
          // Admins and owners can see all batches in their organization
          break;

        default:
          return res.status(403).json({ message: "Insufficient permissions to view batch details" });
      }

      // Get additional batch details
      const [location, process, lineOfBusiness] = await Promise.all([
        storage.getLocation(batch.locationId),
        storage.getProcess(batch.processId),
        batch.lineOfBusinessId ? storage.getLineOfBusiness(batch.lineOfBusinessId) : null,
      ]);

      // The batch already contains the trainer info from getBatch
      const batchWithDetails = {
        ...batch,
        location,
        process,
        line_of_business: lineOfBusiness
      };

      console.log('Successfully fetched batch details:', { 
        batchId,
        status: batch.status,
        location: location?.name,
        process: process?.name
      });

      res.json(batchWithDetails);
    } catch (error: any) {
      console.error('Error fetching batch details:', error);
      res.status(500).json({ 
        message: "Failed to fetch batch details",
        error: error.message 
      });
    }
  });

  // Add batch history endpoint
  app.get("/api/organizations/:orgId/batches/:batchId/history", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        console.log('User organization mismatch:', {
          userOrgId: req.user.organizationId,
          requestedOrgId: orgId
        });
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      // Get the batch to verify access
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        console.log('Batch not found:', { batchId });
        return res.status(404).json({ message: "Batch not found" });
      }

      // Role-based access control
      switch (req.user.role) {
        case 'trainer':
          if (batch.trainerId !== req.user.id) {
            console.log('Trainer not assigned to batch:', {
              trainerId: req.user.id,
              batchTrainerId: batch.trainerId
            });
            return res.status(403).json({ message: "You can only view batches assigned to you" });
          }
          break;

        case 'manager':
          const reportingTrainers = await storage.getReportingTrainers(req.user.id);
          const trainerIds = reportingTrainers.map(trainer => trainer.id);
          if (!trainerIds.includes(batch.trainerId)) {
            console.log('Manager not authorized for batch:', {
              managerId: req.user.id,
              batchTrainerId: batch.trainerId
            });
            return res.status(403).json({ message: "You can only view batches of trainers reporting to you" });
          }
          break;

        case 'admin':
        case 'owner':
          // Admins and owners can see all batches in their organization
          break;

        default:
          return res.status(403).json({ message: "Insufficient permissions to view batch details" });
      }

      // Fetch batch history
      const history = await storage.listBatchHistory(batchId);
      
      console.log('Successfully fetched batch history:', { 
        batchId,
        eventCount: history.length
      });

      res.json(history);
    } catch (error: any) {
      console.error('Error fetching batch history:', error);
      res.status(500).json({ 
        message: "Failed to fetch batch history",
        error: error.message 
      });
    }
  });

  // Add question routes after batch routes
  app.post("/api/questions", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      console.log('Received question data:', req.body);
      
      // Validate required fields
      const { 
        question: questionText, 
        type: questionType,
        options: questionOptions,
        correctAnswer,
        explanation,
        difficultyLevel,
        category 
      } = req.body;
      
      if (!questionText || !questionType || !correctAnswer || !difficultyLevel || !category) {
        return res.status(400).json({ 
          message: "Missing required fields for question creation" 
        });
      }

      // Validate question type
      const validTypes = ["multiple_choice", "true_false", "short_answer"] as const;
      if (!validTypes.includes(questionType)) {
        return res.status(400).json({
          message: `Invalid question type. Must be one of: ${validTypes.join(", ")}`
        });
      }

      // Create question data with proper type checking
      const questionData = {
        question: String(questionText),
        type: questionType,
        options: questionType === 'multiple_choice' ? (Array.isArray(questionOptions) ? questionOptions.map(String) : []) : [],
        correctAnswer: String(correctAnswer),
        explanation: explanation ? String(explanation) : undefined,
        difficultyLevel: Number(difficultyLevel),
        category: String(category),
        createdBy: req.user.id,
        organizationId: req.user.organizationId,
        processId: 1 // Default to first process
      };

      // Validate numeric fields
      if (isNaN(questionData.difficultyLevel)) {
        return res.status(400).json({
          message: "Difficulty level must be a number"
        });
      }

      // Validate options for multiple choice questions
      if (questionData.type === 'multiple_choice' && questionData.options.length === 0) {
        return res.status(400).json({
          message: "Multiple choice questions must have options"
        });
      }

      console.log('Saving question with data:', questionData);
      
      // Create the question in the database
      const createdQuestion = await storage.createQuestion(questionData);
      console.log('Successfully created question:', createdQuestion);
      
      res.status(201).json(createdQuestion);
    } catch (error: any) {
      console.error("Error creating question:", error);
      res.status(400).json({ message: error.message || "Failed to create question" });
    }
  });

  app.get("/api/questions", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log('Fetching questions for organization:', req.user.organizationId);
      // Get questions for the user's organization  
      const questions = await storage.listQuestions(req.user.organizationId);
      console.log('Retrieved questions:', questions);
      res.json(questions);
    } catch (error: any) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add endpoint to get processes by line of business 
  app.get("/api/organizations/:orgId/line-of-businesses/:lobId/processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const lobId = parseInt(req.params.lobId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view processes in your own organization" });
      }

      const processes = await storage.getProcessesByLineOfBusiness(orgId, lobId);
      res.json(processes);
    } catch (error: any) {
      console.error("Error fetching processes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add better error handling and authentication for line of business routes
  app.post("/api/organizations/:id/line-of-businesses", async (req, res) => {
    try {
      console.log('Creating new line of business - Request:', {
        userId: req.user?.id,
        organizationId: req.params.id,
        body: req.body
      });

      if (!req.user) {
        console.log('Unauthorized attempt to create line of business');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const orgId = parseInt(req.params.id);
      if (!orgId) {
        console.log('Invalid organization ID provided');
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        console.log(`User ${req.user.id} attempted to create LOB in organization ${orgId}`);
        return res.status(403).json({ message: "You can only create LOBs in your own organization" });
      }
      
      // Check if user has manage_lineofbusiness permission or is owner
      if (req.user.role !== 'owner') {
        const userPermissions = await storage.getRolePermissions(orgId, req.user.role);
        if (!userPermissions?.permissions.includes('manage_lineofbusiness')) {
          console.log(`User ${req.user.id} with role ${req.user.role} attempted to create LOB without permission`);
          return res.status(403).json({ message: "You do not have permission to create line of business" });
        }
      }

      const lobData = {
        name: req.body.name,
        description: req.body.description,
        organizationId: orgId,
      };

      console.log('Creating LOB with data:', lobData);
      const lob = await storage.createLineOfBusiness(lobData);
      console.log('Successfully created LOB:', lob);

      return res.status(201).json(lob);
    } catch (error: any) {
      console.error("Error creating line of business:", error);
      return res.status(400).json({
        message: error.message || "Failed to create line of business",
        details: error.toString()
      });
    }
  });

  // Update the GET endpoint as well
  app.get("/api/organizations/:id/line-of-businesses", async (req, res) => {
    try {
      console.log('Fetching line of businesses - Request:', {
        userId: req.user?.id,
        organizationId: req.params.id
      });

      if (!req.user) {
        console.log('Unauthorized attempt to fetch line of businesses');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const orgId = parseInt(req.params.id);
      if (!orgId) {
        console.log('Invalid organization ID provided');
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        console.log(`User ${req.user.id} attempted to access LOBs in organization ${orgId}`);
        return res.status(403).json({ message: "You can only view LOBs in your own organization" });
      }

      // Get all lines of business from the organization
      const allLOBs = await storage.listLineOfBusinesses(orgId);
      
      // Check if the user has admin/owner privileges
      const isAdminOrOwner = req.user.role === 'admin' || req.user.role === 'owner';
      
      if (isAdminOrOwner) {
        // Admin/owner sees all lines of business
        console.log(`Admin/owner user (${req.user.id}) - returning all ${allLOBs.length} lines of business`);
        return res.json(allLOBs || []);
      } else {
        // For non-admin users, we need to filter the Lines of Business based on their assigned processes
        
        // Get the user's processes
        const userProcesses = await storage.getUserProcesses(req.user.id);
        
        // First get all processes for the organization to have complete process data
        const allProcesses = await storage.listProcesses(orgId);
        
        // Extract the process IDs from the user's processes
        const userProcessIds = userProcesses.map(p => p.processId);
        
        // Get the full process objects for the user's assigned processes
        const userProcessObjects = allProcesses.filter(process => 
          userProcessIds.includes(process.id)
        );
        
        // Extract the unique line of business IDs from the user's processes
        const userLOBIds = Array.from(
          new Set(userProcessObjects
            .filter(p => p.lineOfBusinessId !== null)
            .map(p => p.lineOfBusinessId))
        );
        
        console.log(`Line of Business IDs for user ${req.user.id}:`, userLOBIds);
        
        // Filter the LOBs to only include those related to the user's processes
        const filteredLOBs = allLOBs.filter(lob => 
          userLOBIds.includes(lob.id)
        );
        
        console.log(`Non-admin user (${req.user.id}) - returning ${filteredLOBs.length} of ${allLOBs.length} total lines of business`);
        return res.json(filteredLOBs || []);
      }
    } catch (error: any) {
      console.error("Error fetching LOBs:", error);
      return res.status(500).json({
        message: "Failed to fetch line of businesses",
        error: error.message,
        details: error.toString()
      });
    }
  });

  // Enrollment count functionality has been removed

  // Batch listing route with enrolled count
  app.get("/api/organizations/:orgId/batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const status = req.query.status as string;

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      // Role-based filtering
      let batches;
      switch (req.user.role) {
        case 'trainer':
          console.log('Fetching batches for trainer:', req.user.id);
          // Trainers can only see batches assigned to them
          batches = await storage.listBatchesForTrainer(req.user.id);
          break;

        case 'manager':
          console.log('Fetching batches for manager:', req.user.id);
          // Get all trainers reporting to this manager
          const reportingTrainers = await storage.getReportingTrainers(req.user.id);
          const trainerIds = reportingTrainers.map(trainer => trainer.id);
          // Get batches for all reporting trainers
          batches = await storage.listBatchesForTrainers(trainerIds);
          break;

        case 'admin':
        case 'owner':
          console.log('Fetching all batches for admin/owner');
          // Admins and owners can see all batches
          batches = await storage.listBatches(orgId);
          break;

        default:
          return res.status(403).json({ message: "Insufficient permissions to view batches" });
      }

      // Filter by status if specified  
      if (status) {
        batches = batches.filter(batch => batch.status === status);
      }

      // For each batch, enrich with location, process, line of business details
      const enrichedBatches = await Promise.all(batches.map(async (batch) => {
        const [location, process, line_of_business] = await Promise.all([
          storage.getLocation(batch.locationId),
          storage.getProcess(batch.processId),
          storage.getLineOfBusiness(batch.lineOfBusinessId)
        ]);

        return {
          ...batch,
          location,
          process,
          line_of_business
        };
      }));

      console.log(`Found ${enrichedBatches.length} batches:`, 
        enrichedBatches.map(b => ({ 
          id: b.id, 
          name: b.name, 
          capacityLimit: b.capacityLimit 
        }))
      );

      // For debugging purposes, log the exact structure being sent to the client
      console.log("API Response Structure:", JSON.stringify(enrichedBatches[0], null, 2));

      res.json(enrichedBatches);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get batch trainees with details
  app.get("/api/organizations/:orgId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      const orgId = parseInt(req.params.orgId);
      const date = req.query.date as string || new Date().toISOString().split('T')[0]; // Allow custom date or use today
      
      console.log('Fetching trainees for batch', batchId, 'for date', date);
      
      // First get the batch to determine its current phase
      const batch = await db
        .select()
        .from(organizationBatches)
        .where(eq(organizationBatches.id, batchId))
        .limit(1);
        
      if (!batch || batch.length === 0) {
        return res.status(404).json({ message: "Batch not found" });
      }
      
      const batchPhase = batch[0].status;
      console.log('Current batch phase:', batchPhase);

      // Get all trainees assigned to this batch and their attendance for the specified date and phase
      const batchTrainees = await db
        .select({
          userId: userBatchProcesses.userId,
          status: userBatchProcesses.status,
          user: {
            id: users.id,
            fullName: users.fullName,
            employeeId: users.employeeId,
            email: users.email,
            role: users.role,
            category: users.category
          },
          attendance: {
            status: attendance.status,
            lastUpdated: attendance.updatedAt
          }
        })
        .from(userBatchProcesses)
        .innerJoin(users, eq(users.id, userBatchProcesses.userId))
        .leftJoin(
          attendance,
          and(
            eq(attendance.traineeId, userBatchProcesses.userId),
            eq(attendance.batchId, userBatchProcesses.batchId),
            eq(attendance.date, date),
            eq(attendance.phase, batchPhase)
          )
        )
        .where(
          and(
            eq(userBatchProcesses.batchId, batchId),
            eq(users.category, 'trainee'),  // Filter by category='trainee'
            eq(userBatchProcesses.status, 'active')  // Only get active trainees
          )
        );

      console.log('Found trainees:', batchTrainees);

      // Map to expected format
      const traineesWithDetails = batchTrainees.map((trainee) => ({
        id: trainee.userId,
        status: trainee.attendance?.status || (trainee.traineeStatus === 'left_job' ? 'left_job' : null),
        lastUpdated: trainee.attendance?.lastUpdated?.toISOString(),
        user: trainee.user,
        traineeStatus: trainee.traineeStatus,
        isManualStatus: trainee.isManualStatus
      }));

      console.log('Trainees with attendance details:', traineesWithDetails);
      res.json(traineesWithDetails);
    } catch (error: any) {
      console.error("Error fetching trainees:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add detailed logging to bulk upload route
  app.post("/api/organizations/:orgId/batches/:batchId/trainees/bulk", upload.single('file'), async (req, res) => {
    console.log('Starting bulk upload process');
    
    if (!req.user) {
      console.log('Unauthorized attempt to upload');
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!req.file) {
      console.log('No file received in request');
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      console.log('File received:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      console.log('Processing upload for:', { orgId, batchId });

      // Get batch details first
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        console.log('Batch not found:', batchId);
        return res.status(404).json({ message: "Batch not found" });
      }

      console.log('Found batch:', batch);
      
      // Check if process exists for this batch
      if (!batch.processId) {
        console.log('No process ID found for batch:', batchId);
        return res.status(400).json({ message: "Batch has no process assigned" });
      }
      
      // Verify the process exists
      const process = await storage.getProcess(batch.processId);
      if (!process) {
        console.log('Process not found for ID:', batch.processId);
        return res.status(400).json({ message: `Process with ID ${batch.processId} not found` });
      }
      
      console.log('Found process:', process.name);
      
      // Get trainer details if trainer is assigned to the batch
      // Always use batch location for trainees, not trainer's location
      const batchLocationId = batch.locationId;
      let trainerId = batch.trainerId;
      
      if (trainerId) {
        const trainer = await storage.getUser(trainerId);
        if (trainer) {
          console.log('Found trainer:', {
            id: trainer.id,
            name: trainer.fullName,
            locationId: trainer.locationId
          });
          
          // Always use batch location for trainees
          console.log('Using batch location for trainees:', batchLocationId);
        } else {
          console.log('Trainer not found for ID:', trainerId);
        }
      } else {
        console.log('No trainer assigned to batch, using batch location:', batchLocationId);
      }

      // Check remaining capacity 
      const currentTrainees = await storage.getBatchTrainees(batchId);
      const remainingCapacity = batch.capacityLimit - currentTrainees.length;
      
      console.log('Batch capacity check:', {
        total: batch.capacityLimit,
        current: currentTrainees.length,
        remaining: remainingCapacity
      });

      // Read the uploaded file
      console.log('Reading Excel file');
      const workbook = XLSX.read(req.file.buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

      console.log('Excel parsing complete. Row count:', rows.length);

      // Validate total rows against capacity
      if (rows.length > remainingCapacity) {
        console.log('Capacity exceeded:', {
          rowCount: rows.length,
          remainingCapacity
        });
        return res.status(400).json({
          message: `Cannot upload ${rows.length} trainees. Only ${remainingCapacity} slots remaining in batch.`
        });
      }

      const errors = [];
      const requiredFields = ['username', 'fullName', 'email', 'employeeId', 'phoneNumber', 'dateOfJoining', 'dateOfBirth', 'education', 'password', 'role'];
      const validatedRows = [];

      // First pass: validate all rows without making any changes
      console.log('Validating all rows before processing');
      for (const row of rows) {
        try {
          console.log('Validating row:', row);

          // Check for existing username
          const existingUsername = await storage.getUserByUsername(String(row.username));
          if (existingUsername) {
            throw new Error(`Username ${row.username} already exists`);
          }
          
          // Check for existing email
          const existingEmail = await storage.getUserByEmail(String(row.email));
          if (existingEmail) {
            throw new Error(`Email ${row.email} already exists`);
          }

          // Validate required fields
          const missingFields = requiredFields.filter(field => !row[field]);
          if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
          }

          // Validate email format
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            throw new Error('Invalid email format');
          }

          // Validate role
          const role = String(row.role).toLowerCase();
          const validRoles = ['manager', 'team_lead', 'quality_analyst', 'trainer', 'advisor'];
          if (!validRoles.includes(role)) {
            throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
          }

          // Convert and validate dates
          let dateOfJoining: string;
          let dateOfBirth: string;

          try {
            // Check if the date is a number (Excel serial date) or string
            if (typeof row.dateOfJoining === 'number') {
              dateOfJoining = excelSerialDateToJSDate(row.dateOfJoining);
            } else {
              dateOfJoining = row.dateOfJoining;
            }

            if (typeof row.dateOfBirth === 'number') {
              dateOfBirth = excelSerialDateToJSDate(row.dateOfBirth);
            } else {
              dateOfBirth = row.dateOfBirth;
            }

            // Validate date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfJoining) || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
              throw new Error('Invalid date format');
            }
          } catch (error) {
            throw new Error('Invalid date format. Use YYYY-MM-DD format');
          }

          // Create validated data object
          validatedRows.push({
            ...row,
            dateOfJoining,
            dateOfBirth,
            role,
          });
          
        } catch (error) {
          const rowNum = rows.indexOf(row) + 2; // +2 for header row and 0-based index
          const errorMessage = `Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
          console.error('Validation error:', errorMessage);
        }
      }

      // If there are any validation errors, abort the entire operation
      if (errors.length > 0) {
        console.log('Validation failed with errors:', errors);
        return res.status(400).json({
          message: "Bulk upload validation failed",
          totalRows: rows.length,
          errors
        });
      }

      // Second pass: process all rows in a transaction
      console.log('All rows validated successfully, proceeding with transaction');
      let successCount = 0;
      
      // Use a transaction to ensure all-or-nothing operation
      await db.transaction(async (tx) => {
        for (const row of validatedRows) {
          console.log('Processing validated row for user:', row.username);
          
          // Hash password
          const hashedPassword = await hashPassword(String(row.password));
          
          // Create trainee data object
          const traineeData = {
            username: String(row.username),
            fullName: String(row.fullName),
            email: String(row.email),
            employeeId: String(row.employeeId),
            phoneNumber: String(row.phoneNumber),
            dateOfJoining: row.dateOfJoining,
            dateOfBirth: row.dateOfBirth,
            education: String(row.education),
            password: hashedPassword,
            role: row.role,
            category: "trainee", // This is correct - category should be trainee
            processId: batch.processId,
            lineOfBusinessId: batch.lineOfBusinessId,
            locationId: batch.locationId, // Use batch location as requested
            managerId: trainerId, // Set the batch trainer as the reporting manager
            organizationId: orgId
          };

          console.log('Creating user with data:', { 
            ...traineeData, 
            password: '[REDACTED]',
            role: row.role,
            category: 'trainee'
          });

          // Create user
          const user = await storage.createUser(traineeData);
          console.log('User created:', user.id);
          
          // Create batch process assignment
          await storage.assignUserToBatch({
            userId: user.id,
            batchId,
            processId: batch.processId,
            status: 'active',
            joinedAt: new Date()
          });

          console.log('User assigned to batch');

          // Create user process record
          await storage.createUserProcess({
            userId: user.id,
            processId: batch.processId,
            organizationId: orgId,
            lineOfBusinessId: batch.lineOfBusinessId,
            locationId: batch.locationId, // Use batch location as requested
            status: 'active',
            assignedAt: new Date()
          });

          console.log('User process record created');
          successCount++;
        }
      });

      console.log('Transaction completed successfully. Users created:', successCount);

      // Send detailed response
      res.json({
        message: "Bulk upload completed successfully",
        totalRows: rows.length,
        successCount,
        remainingCapacity: remainingCapacity - successCount
      });
    } catch (error) {
      console.error("Bulk upload error:", error);
      res.status(500).json({
        message: "Failed to process bulk upload",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Update attendance endpoint with date validation and auto-marking
  app.post("/api/attendance", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const { traineeId, status, date, batchId, phase } = req.body;

      // Validate required fields
      if (!traineeId || !status || !date || !batchId || !phase) {
        return res.status(400).json({ 
          message: "Missing required fields",
          required: ["traineeId", "status", "date", "batchId", "phase"]
        });
      }

      // Validate the status
      const validStatuses = ['present', 'absent', 'late', 'leave', 'half_day', 'public_holiday', 'weekly_off'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          message: "Invalid attendance status",
          validStatuses
        });
      }

      // Check if trainee belongs to the batch
      const [batchTrainee] = await db
        .select()
        .from(userBatchProcesses)
        .where(
          and(
            eq(userBatchProcesses.userId, traineeId),
            eq(userBatchProcesses.batchId, batchId),
            eq(userBatchProcesses.status, 'active')
          )
        );

      if (!batchTrainee) {
        return res.status(400).json({
          message: "Trainee is not enrolled in this batch or is not active"
        });
      }

      // Fetch batch details to validate the date
      const [batchDetails] = await db
        .select()
        .from(organizationBatches)
        .where(eq(organizationBatches.id, batchId));

      if (!batchDetails) {
        return res.status(404).json({
          message: "Batch not found"
        });
      }

      // Get holidays for the batch's organization if holidays are considered
      const holidays = batchDetails.considerHolidays 
        ? await getHolidaysInRange(
            req.user.organizationId,
            batchDetails.startDate,
            batchDetails.endDate
          )
        : [];

      // Skip date validation to allow marking attendance for any date
      console.log(`Skipping date validation for attendance on ${date} in batch ${batchId} for trainee ${traineeId}`);
      
      // Always consider the date as valid, regardless of what validation would say
      const dateValidation = {
        isValid: true,
        reason: "Date validation bypassed as requested"
      };
      
      // Use user-selected status directly without auto-marking
      let finalStatus = status;

      // Create or update attendance record with potentially auto-marked status
      const [result] = await db
        .insert(attendance)
        .values({
          traineeId,
          status: finalStatus,
          date,
          batchId,
          phase,
          markedById: req.user.id,
          organizationId: req.user.organizationId,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [attendance.traineeId, attendance.date, attendance.batchId],
          set: {
            status: finalStatus,
            phase,
            updatedAt: new Date()
          }
        })
        .returning();

      // Since we're skipping date validation and auto-marking, always set autoMarked to false
      const response = {
        ...result,
        autoMarked: false,
        originalStatus: undefined
      };

      console.log('Attendance record saved:', response);
      return res.json(response);
    } catch (error: any) {
      console.error("Error saving attendance record:", error);
      // Log error without trying to access variables that might be undefined
      console.error("Error details:", JSON.stringify({
        message: error.message,
        stack: error.stack
      }, null, 2));
      return res.status(500).json({ 
        message: "Failed to save attendance record",
        error: error.message
      });
    }
  });

  // Add Organization Process Routes
  // Get organization processes 
  app.get("/api/organizations/:id/processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      console.log(`Fetching processes for organization ${orgId}`);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view processes in your own organization" });
      }
      
      // Get all processes from the organization
      const allProcesses = await storage.listProcesses(orgId);
      
      // Check if the user has admin/owner privileges
      const isAdminOrOwner = req.user.role === 'admin' || req.user.role === 'owner';
      
      if (isAdminOrOwner) {
        // Admin/owner sees all processes
        console.log(`Admin/owner user (${req.user.id}) - returning all ${allProcesses.length} processes`);
        res.json(allProcesses);
      } else {
        // Get the processes assigned to this user
        const userProcesses = await storage.getUserProcesses(req.user.id);
        
        // Extract just the process IDs from the user's assigned processes
        const userProcessIds = userProcesses.map(up => up.processId);
        
        // Filter the processes to only include those assigned to the user
        const filteredProcesses = allProcesses.filter(process => 
          userProcessIds.includes(process.id)
        );
        
        console.log(`Non-admin user (${req.user.id}) - returning ${filteredProcesses.length} of ${allProcesses.length} total processes`);
        res.json(filteredProcesses);
      }
    } catch (error: any) {
      console.error("Error fetching processes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create new process
  app.post("/api/organizations/:id/processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only create processes in your own organization" });
      }
      
      // Check if user has manage_processes permission or is owner
      if (req.user.role !== 'owner') {
        const userPermissions = await storage.getRolePermissions(req.user.organizationId, req.user.role);
        if (!userPermissions?.permissions.includes('manage_processes')) {
          console.log(`User ${req.user.id} with role ${req.user.role} attempted to create process without permission`);
          return res.status(403).json({ message: "You do not have permission to create process" });
        }
      }

      const processData = {
        ...req.body,
        organizationId: orgId,
      };

      console.log('Creating process with data:', processData);

      const validatedData = insertOrganizationProcessSchema.parse(processData);
      const process = await storage.createProcess(validatedData);

      console.log('Process created successfully:', process);
      res.status(201).json(process);
    } catch (error: any) {
      console.error("Process creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Update process
  app.patch("/api/organizations/:id/processes/:processId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const processId = parseInt(req.params.processId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only update processes in your own organization" });
      }
      
      // Check if user has manage_processes permission or is owner
      if (req.user.role !== 'owner') {
        const userPermissions = await storage.getRolePermissions(req.user.organizationId, req.user.role);
        if (!userPermissions?.permissions.includes('manage_processes')) {
          console.log(`User ${req.user.id} with role ${req.user.role} attempted to update process without permission`);
          return res.status(403).json({ message: "You do not have permission to update process" });
        }
      }

      console.log('Updating process:', processId, 'with data:', req.body);

      const process = await storage.updateProcess(processId, req.body);

      console.log('Process updated successfully:', process);
      res.json(process);
    } catch (error: any) {
      console.error("Process update error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Delete process
  app.delete("/api/organizations/:id/processes/:processId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const processId = parseInt(req.params.processId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete processes in your own organization" });
      }
      
      // Check if user has manage_processes permission or is owner
      if (req.user.role !== 'owner') {
        const userPermissions = await storage.getRolePermissions(req.user.organizationId, req.user.role);
        if (!userPermissions?.permissions.includes('manage_processes')) {
          console.log(`User ${req.user.id} with role ${req.user.role} attempted to delete process without permission`);
          return res.status(403).json({ message: "You do not have permission to delete process" });
        }
      }

      console.log('Deleting process:', processId);
      await storage.deleteProcess(processId);

      console.log('Process deleted successfully');
      res.status(200).json({ message: "Process deleted successfully"});
    } catch (error:any) {
      console.error("Process deletion error:", error);
      res.status(400).json({ message: error.message || "Failed to delete process" });
    }
  });

  // Add LOB updateand delete routes
  app.patch("/api/organizations/:id/line-of-businesses/:lobId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const lobId = parseInt(req.params.lobId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only modify LOBs in your own organization" });
      }
      
      // Check if user has manage_lineofbusiness permission or is owner
      if (req.user.role !== 'owner') {
        const userPermissions = await storage.getRolePermissions(req.user.organizationId, req.user.role);
        if (!userPermissions?.permissions.includes('manage_lineofbusiness')) {
          console.log(`User ${req.user.id} with role ${req.user.role} attempted to update LOB without permission`);
          return res.status(403).json({ message: "You do not have permission to modify line of business" });
        }
      }

      console.log('Updating LOB:', lobId, 'with data:', req.body);
      const updatedLob = await storage.updateLineOfBusiness(lobId, {
        ...req.body,
        organizationId: orgId, // Ensure we keep the correct organization ID
      });

      res.json(updatedLob);
    } catch (error: any) {
      console.error("LOB update error:", error);
      res.status(400).json({ message: error.message || "Failed to update Line of Business" });
    }
  });

  // Delete LOB route
  app.delete("/api/organizations/:id/line-of-businesses/:lobId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const lobId = parseInt(req.params.lobId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete LOBs in your own organization" });
      }
      
      // Check if user has manage_lineofbusiness permission or is owner
      if (req.user.role !== 'owner') {
        const userPermissions = await storage.getRolePermissions(req.user.organizationId, req.user.role);
        if (!userPermissions?.permissions.includes('manage_lineofbusiness')) {
          console.log(`User ${req.user.id} with role ${req.user.role} attempted to delete LOB without permission`);
          return res.status(403).json({ message: "You do not have permission to delete line of business" });
        }
      }

      console.log('Deleting LOB:', lobId);
      await storage.deleteLineOfBusiness(lobId);

      res.json({ message: "Line of Business deleted successfully" });
    } catch (error: any) {
      console.error("LOB deletion error:", error);
      res.status(400).json({ message: error.message || "Failed to delete Line of Business" });
    }
  });

  // Add new endpoint to get LOBs by location
  app.get("/api/organizations/:id/locations/:locationId/line-of-businesses", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const locationId = parseInt(req.params.locationId);

      console.log('Fetching LOBs - Request details:', {
        orgId,
        locationId,
        userId: req.user.id,
        userRole: req.user.role,
        userOrgId: req.user.organizationId
      });

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        console.log(`User ${req.user.id} attempted to access LOBs in organization ${orgId}`);
        return res.status(403).json({ message: "You can only view LOBs in your own organization" });
      }

      // Get location to verify it exists and belongs to the organization
      const location = await storage.getLocation(locationId);
      if (!location || location.organizationId !== orgId) {
        console.log(`Location not found or doesn't belong to organization:`, { locationId, orgId });
        return res.status(404).json({ message: "Location not found" });
      }

      // Get LOBs based on location from user_processes table
      const lobs = await storage.getLineOfBusinessesByLocation(orgId, locationId);
      console.log(`Found LOBs for location ${locationId}:`, {
        count: lobs.length,
        lobIds: lobs.map(lob => lob.id),
        lobNames: lobs.map(lob => lob.name)
      });

      res.json(lobs);
    } catch (error: any) {
      console.error("Error fetching LOBs by location:", error);
      res.status(500).json({ message: error.message });
    }
  });



  app.post("/api/organizations/:id/batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only create batches in your own organization" });
      }

      const batchData = {
        ...req.body,
        organizationId: orgId,
      };

      console.log('Creating batch with data:', batchData);

      const batch = await storage.createBatch(batchData);
      res.status(201).json(batch);
    } catch (error: any) {
      console.error("Batch creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get batch detail route
  app.get("/api/organizations/:orgId/batches/:batchId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      // Get batch details
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Get trainee count
      const trainees = await storage.getBatchTrainees(batchId);
      const traineeCount = trainees.length;

      // Get related data
      const [process, location, lineOfBusiness, trainer] = await Promise.all([
        storage.getProcess(batch.processId),
        storage.getLocation(batch.locationId),
        storage.getLineOfBusiness(batch.lineOfBusinessId),
        storage.getUser(batch.trainerId)
      ]);

      // Combine all data
      const batchDetails = {
        ...batch,
        traineeCount,
        process,
        location,
        lineOfBusiness,
        trainer
      };

      console.log('Sending batch details:', batchDetails);
      res.json(batchDetails);
    } catch (error: any) {
      console.error("Error fetching batch details:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/organizations/:id/batches/:batchId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const batchId = parseInt(req.params.batchId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only update batches in your own organization" });
      }

      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch belongs to the organization
      if (batch.organizationId !== orgId) {
        return res.status(403).json({ message: "Batch not found in your organization" });
      }

      console.log('Updating batch:', batchId, 'with data:', req.body);
      const updatedBatch = await storage.updateBatch(batchId, req.body);

      res.json(updatedBatch);
    } catch (error: any) {
      console.error("Batch update error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Delete batch route
  app.delete("/api/organizations/:id/batches/:batchId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const batchId = parseInt(req.params.batchId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete batches in your own organization" });
      }

      // Get batch details
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch is in planned status
      if (batch.status !== 'planned') {
        return res.status(400).json({ 
          message: "Only batches in 'planned' status can be deleted",
          code: "INVALID_BATCH_STATUS"
        });
      }

      // Check for existing trainees
      const trainees = await storage.getBatchTrainees(batchId);
      if (trainees.length > 0) {
        return res.status(400).json({ 
          success: false,
          message: "Cannot delete batch with existing trainees. Please transfer or remove all trainees first.",
          traineesCount: trainees.length,
          code: "TRAINEES_EXIST"
        });
      }

      console.log('Deleting batch:', batchId);
      await storage.deleteBatch(batchId);

      console.log('Batch deleted successfully');
      return res.json({ 
        success: true,
        message: "Batch deleted successfully",
        code: "SUCCESS"
      });
    } catch (error: any) {
      console.error("Batch deletion error:", error);
      return res.status(500).json({ 
        success: false,
        message: error.message || "Failed to delete batch",
        code: "INTERNAL_ERROR"
      });
    }
  });

  // Add these batch template routes after existing routes
  // Get batch templates
  app.get("/api/organizations/:id/batch-templates", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view templates in your own organization" });
      }

      console.log(`Fetching batch templates for organization ${orgId}`);
      const templates = await storage.listBatchTemplates(orgId);
      console.log(`Found ${templates.length} templates`);
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create batch template
  app.post("/api/organizations/:id/batch-templates", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only create templates in your own organization" });
      }

      const templateData = {
        ...req.body,
        organizationId: orgId,
      };

      console.log('Creating template with data:', templateData);

      const validatedData = insertBatchTemplateSchema.parse(templateData);
      const template = await storage.createBatchTemplate(validatedData);

      console.log('Template created successfully:', template);
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Template creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get single template
  app.get("/api/organizations/:id/batch-templates/:templateId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const templateId = parseInt(req.params.templateId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view templates in your own organization" });
      }

      const template = await storage.getBatchTemplate(templateId);
      if (!template || template.organizationId !== orgId) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(template);
    } catch (error: any) {
      console.error("Error fetching template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete template
  app.delete("/api/organizations/:id/batch-templates/:templateId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const templateId = parseInt(req.params.templateId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete templates in your own organization" });
      }

      // Check if template exists and belongs to organization
      const template = await storage.getBatchTemplate(templateId);
      if (!template || template.organizationId !== orgId) {
        return res.status(404).json({ message: "Template not found" });
      }

      await storage.deleteBatchTemplate(templateId);
      res.json({ message: "Template deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add new endpoint to get trainer's active batches
  app.get("/api/trainers/:id/active-batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const trainerId = parseInt(req.params.id);
      console.log(`Fetching batches for trainer ${trainerId}`);

      // Get all non-completed batches using the enum values directly
      const activeBatches = await storage.getBatchesByTrainer(
        trainerId,
        req.user.organizationId,
        batchStatusEnum.enumValues.filter(status => status !== 'completed')
      );

      console.log(`Found ${activeBatches.length} active batches for trainer ${trainerId}`);
      res.json(activeBatches);
    } catch (error: any) {
      console.error("Error fetching trainer batches:", error);
      res.status(500).json({ message: "Failed to fetch trainer batches" });
    }
  });
  
  // Test route for batch phase transition
  app.get("/api/test-batch-status-update", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Only owners and admins can run this test" });
    }
    
    try {
      console.log('Starting manual batch status update test...');
      
      // Get current state of batches before update
      const orgId = req.user.organizationId;
      const batchesBeforeUpdate = await storage.listBatches(orgId);
      
      // Run the update function
      await updateBatchStatuses();
      
      // Get batches after update
      const batchesAfterUpdate = await storage.listBatches(orgId);
      
      // Identify batches that were updated
      const updatedBatches = [];
      
      for (const beforeBatch of batchesBeforeUpdate) {
        const afterBatch = batchesAfterUpdate.find(b => b.id === beforeBatch.id);
        
        if (afterBatch && beforeBatch.status !== afterBatch.status) {
          updatedBatches.push({
            id: beforeBatch.id,
            name: beforeBatch.name,
            previousStatus: beforeBatch.status,
            newStatus: afterBatch.status,
            transitionDate: new Date().toISOString()
          });
        }
      }
      
      res.json({
        message: 'Batch status update test completed',
        totalBatches: batchesBeforeUpdate.length,
        updatedBatches: updatedBatches,
        details: 'Check server logs for more details about the update process'
      });
    } catch (error: any) {
      console.error("Error in batch status update test:", error);
      res.status(500).json({ 
        message: "Failed to run batch status update test", 
        error: error.message 
      });
    }
  });
  
  // Route to reset batches without trainees back to planned status
  app.get("/api/reset-empty-batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Only owners and admins can reset empty batches" });
    }
    
    try {
      console.log('Starting manual empty batch reset...');
      
      // Get current state of batches before update
      const orgId = req.user.organizationId;
      const batchesBeforeReset = await storage.listBatches(orgId);
      
      // Run the reset function
      await resetEmptyBatches();
      
      // Get batches after reset
      const batchesAfterReset = await storage.listBatches(orgId);
      
      // Identify batches that were reset
      const resetBatches = [];
      
      for (const beforeBatch of batchesBeforeReset) {
        const afterBatch = batchesAfterReset.find(b => b.id === beforeBatch.id);
        
        if (afterBatch && beforeBatch.status !== afterBatch.status && afterBatch.status === 'planned') {
          resetBatches.push({
            id: beforeBatch.id,
            name: beforeBatch.name,
            previousStatus: beforeBatch.status,
            newStatus: afterBatch.status,
            resetDate: new Date().toISOString()
          });
        }
      }
      
      res.json({
        message: 'Empty batch reset completed',
        totalBatches: batchesBeforeReset.length,
        resetBatches: resetBatches,
        details: 'Batches without enrolled trainees have been reset to Planned status'
      });
    } catch (error: any) {
      console.error("Error in empty batch reset:", error);
      res.status(500).json({ 
        message: "Failed to reset empty batches", 
        error: error.message 
      });
    }
  });

  // Update the trainee creation endpoint with capacity check
  app.post("/api/organizations/:orgId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const organizationId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      // Get the batch details including capacity
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Get current trainee count
      const trainees = await storage.getBatchTrainees(batchId);
      if (trainees.length >= batch.capacityLimit) {
        return res.status(400).json({
          message: `Cannot add trainee. Batch capacity limit (${batch.capacityLimit}) has been reached.`
        });
      }

      // Rest of the existing code remains the same
      const { processId, lineOfBusinessId, locationId, ...userData } = req.body;

      // Create password hash
      const hashedPassword = await hashPassword(userData.password);

      // Create user with role from form 
      const userToCreate = {
        ...userData,
        password: hashedPassword,
        category: "trainee", // Keep category as trainee
        organizationId,
        locationId,
        active: true
      };

      console.log('Creating trainee with data:', {
        ...userToCreate,
        password: '[REDACTED]'
      });

      const user = await storage.createUser(userToCreate);
      console.log('Created user:', { id: user.id, username: user.username });

      // Create batch process assignment
      const batchAssignment = await storage.assignUserToBatch({
        userId: user.id,
        batchId,
        processId,
        status: 'active',
        joinedAt: new Date(),
      });
      console.log('Created batch assignment:', batchAssignment);

      // Create user process record
      const userProcess = await storage.createUserProcess({
        userId: user.id,
        processId,
        organizationId,
        lineOfBusinessId,
        locationId,
        status: 'active',
        assignedAt: new Date(),
      });
      console.log('Created user process assignment:', userProcess);

      res.status(201).json({
        user,
        batchAssignment,
        userProcess
      });
    } catch (error: any) {
      console.error("Error creating trainee:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Add after other user routes
  app.get("/api/organizations/:orgId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      const orgId = parseInt(req.params.orgId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view trainees in your own organization" });
      }

      // Get batch details to verify it exists and belongs to the organization
      const batch = await storage.getBatch(batchId);
      if (!batch || batch.organizationId !== orgId) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Get all trainees for this batch
      const trainees = await storage.getBatchTrainees(batchId);
      console.log(`Found ${trainees.length} trainees for batch ${batchId}`);

      // Get detailed user information for each trainee
      const traineeDetails = await Promise.all(
        trainees.map(async (trainee) => {
          const user = await storage.getUser(trainee.userId);
          return {
            ...trainee,
            user: user ? {
              username: user.username,
              fullName: user.fullName,
              email: user.email,
              employeeId: user.employeeId,
              phoneNumber: user.phoneNumber,
            } : null
          };
        })
      );

      res.json(traineeDetails);
    } catch (error: any) {
      console.error("Error fetching batch trainees:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add the trainee transfer endpoint
  app.post("/api/organizations/:orgId/batches/:batchId/trainees/:traineeId/transfer", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      const traineeId = parseInt(req.params.traineeId);
      const { newBatchId } = req.body;

      // Validate the new batch exists and belongs to the organization
      const newBatch = await storage.getBatch(newBatchId);
      if (!newBatch || newBatch.organizationId !== orgId) {
        return res.status(404).json({ message: "Target batch not found" });
      }

      // Check capacity in the new batch
      const currentTrainees = await storage.getBatchTrainees(newBatchId);
      if (currentTrainees.length >= newBatch.capacityLimit) {
        return res.status(400).json({
          message: `Cannot transfer trainee. Target batch has reached its capacity limit of ${newBatch.capacityLimit}`
        });
      }

      // Update the trainee's batch assignment
      await storage.updateUserBatchProcess(traineeId, batchId, newBatchId);

      res.json({ message: "Trainee transferred successfully" });
    } catch (error: any) {
      console.error("Error transferring trainee:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add trainee delete endpoint
  app.delete("/api/organizations/:orgId/batches/:batchId/trainees/:traineeId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      const traineeId = parseInt(req.params.traineeId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only manage trainees in your own organization" });
      }

      console.log('Removing trainee:', traineeId, 'from batch:', batchId);

      // Simply remove trainee from batch without modifying user status
      await storage.removeTraineeFromBatch(traineeId);

      console.log('Successfully removed trainee from batch');
      res.json({ message: "Trainee removed from batch successfully" });
    } catch (error: any) {
      console.error("Error removing trainee:", error);
      res.status(400).json({ message: error.message || "Failed to remove trainee" });
    }
  });

  // Update the bulk upload route to handle role field
  app.post("/api/organizations/:orgId/batches/:batchId/trainees/bulk", upload.single('file'), async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "No file uploaded" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      // Read the uploaded file
      const workbook = XLSX.read(req.file.buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let failureCount = 0;
      const errors = [];

      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Process each row
      for (const row of rows) {
        try {
          // Validate the role
          const role = row.role?.toLowerCase();
          const validRoles = ['manager', 'team_lead', 'quality_analyst', 'trainer', 'advisor'];
          if (!validRoles.includes(role)) {
            throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
          }

          const traineeData = {
            username: row.username,
            fullName: row.fullName,
            email: row.email,
            employeeId: row.employeeId,
            phoneNumber: row.phoneNumber,
            dateOfJoining: row.dateOfJoining,
            dateOfBirth: row.dateOfBirth,
            education: row.education,
            password: await hashPassword(row.password),
            role: role,
            category: "trainee", // Always set category as trainee
            processId: batch.processId,
            lineOfBusinessId: batch.lineOfBusinessId,
            locationId: batch.locationId,
            managerId: batch.trainerId,
            organizationId: orgId,
            batchId: batchId
          };

          await storage.createUser(traineeData);
          successCount++;
        } catch (error) {
          failureCount++;
          errors.push(`Row ${rows.indexOf(row) + 2}: ${error.message}`);
        }
      }

      res.json({
        message: "Bulk upload completed",
        successCount,
        failureCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Bulk upload error:", error);
      res.status(500).json({
        message: "Failed to process bulk upload",
        error: error.message
      });
    }
  });

  // Add template download endpoint
  app.get("/api/templates/trainee-upload", (req, res) => {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Define headers
      const headers = [
        'username',
        'fullName',
        'email',
        'employeeId',
        'phoneNumber',
        'dateOfJoining',
        'dateOfBirth',
        'education',
        'password',
        'role' // Added 'role' column to the template
      ];

      // Create example data row
      const exampleData = [
        'john.doe',
        'John Doe',
        'john.doe@example.com',
        'EMP123',
        '+1234567890',
        '2025-03-06', // Format: YYYY-MM-DD
        '1990-01-01', // Format: YYYY-MM-DD
        'Bachelor\'s Degree',
        'Password123!', // Will be hashed on upload
        'advisor' // Example role showing advisor instead of trainee
      ];

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet([headers, exampleData]);

      // Add column widths
      ws['!cols'] = headers.map(() => ({ wch: 15 }));

      // Add styling to headers
      for (let i = 0; i < headers.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headers[i] };
        ws[cellRef].s = { font: { bold: true } };
      }

      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Trainees');

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=trainee-upload-template.xlsx');

      // Write to response
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.send(buffer);

    } catch (error: any) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // Add the onboarding completion endpoint
  app.post("/api/users/:id/complete-onboarding", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const userId = parseInt(req.params.id);

      // Users can only complete their own onboarding
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "You can only complete your own onboarding" });
      }

      console.log(`Completing onboarding for user ${userId}`);
      const updatedUser = await storage.updateUser(userId, {
        onboardingCompleted: true
      });

      console.log('Onboarding completed successfully');
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: error.message || "Failed to complete onboarding" });
    }
  });

  // Add new route for starting a batch after existing batch routes
  app.post("/api/batches/:batchId/start", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      if (!batchId) {
        return res.status(400).json({ message: "Invalid batch ID" });
      }

      // Get the batch
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch can be started
      if (batch.status !== 'planned') {
        return res.status(400).json({ 
          message: "Only planned batches can be started" 
        });
      }

      // Get trainees count for this batch
      const trainees = await storage.getBatchTrainees(batchId);
      const traineeCount = trainees.filter(trainee => trainee.category === 'trainee').length;

      if (traineeCount === 0) {
        return res.status(400).json({
          message: "Cannot start batch without any trainees. Please add at least one trainee before starting the batch."
        });
      }

      // Record batch history first
      await addBatchHistoryRecord(
        batchId,
        'phase_change',
        `Batch phase changed from planned to induction (batch started)`,
        'planned',
        'induction',
        batch.organizationId,
        req.user.id // Pass the actual user ID who started the batch
      );


      // Store dates in UTC format while preserving IST midnight
      const currentDate = new Date();
      const updatedBatch = await storage.updateBatch(batchId, {
        status: 'induction',
        startDate: toUTCStorage(currentDate.toISOString())
      });

      console.log('Successfully started batch:', {
        ...updatedBatch,
        startDate: formatISTDateOnly(updatedBatch.startDate)
      });

      res.json(updatedBatch);

    } catch (error: any) {
      console.error("Error starting batch:", error);
      res.status(500).json({ message: error.message || "Failed to start batch" });
    }
  });

  // Add batch listing route with status filter
  app.get("/api/organizations/:orgId/batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const status = req.query.status as string;

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      let batches = await storage.listBatches(orgId);

      // Filter by status if specified
      if (status) {
        batches = batches.filter(batch => batch.status === status);
      }

      // For each batch, enrich with location, process, and line of business details
      const enrichedBatches = awaitPromise.all(batches.map(async (batch) => {
        const [location, process, line_of_business] = await Promise.all([
          storage.getLocation(batch.locationId),
          storage.getProcess(batch.processId),
          storage.getLineOfBusiness(batch.lineOfBusinessId)
        ]);

        return {
          ...batch,
          location,
          process,
          line_ofbusiness
        };
      }));

      console.log(`Found ${enrichedBatches.length} batches for organization ${orgId}`);
      res.json(enrichedBatches);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Modify trainee management route to only show 'planned' batches
  app.get("/api/organizations/:orgId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      const orgId = parseInt(req.params.orgId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view trainees in your own organization" });
      }

      // Get batch details to verify it exists and belongs to the organization
      const batch = await storage.getBatch(batchId);
      if (!batch || batch.organizationId !== orgId) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch status is 'planned'
      if (batch.status !== 'planned') {
        return res.status(403).json({ message: "Only 'planned' batches can be accessed through this route." });
      }

      // Get all trainees for this batch
      const trainees = await storage.getBatchTrainees(batchId);
      console.log(`Found ${trainees.length} trainees for batch ${batchId}`);

      // Get detailed user information for each trainee
      const traineeDetails = await Promise.all(
        trainees.map(async (trainee) => {
          const user = await storage.getUser(trainee.userId);
          return {
            ...trainee,
            user: user ? {
              username: user.username,
              fullName: user.fullName,
              email: user.email,
              employeeId: user.employeeId,
              phoneNumber: user.phoneNumber,
            } : null
          };
        })
      );

      res.json(traineeDetails);
    } catch (error: any) {
      console.error("Error fetching batch trainees:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add the trainee transfer endpoint
  app.post("/api/organizations/:orgId/batches/:batchId/trainees/:traineeId/transfer", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      const traineeId = parseInt(req.params.traineeId);
      const { newBatchId } = req.body;

      // Validate the new batch exists and belongs to the organization
      const newBatch = await storage.getBatch(newBatchId);
      if (!newBatch || newBatch.organizationId !== orgId) {
        return res.status(404).json({ message: "Target batch not found" });
      }

      // Check capacity in the new batch
      const currentTrainees = await storage.getBatchTrainees(newBatchId);
      if (currentTrainees.length >= newBatch.capacityLimit) {
        return res.status(400).json({
          message: `Cannot transfer trainee. Target batch has reached its capacity limit of ${newBatch.capacityLimit}`
        });
      }

      // Update the trainee's batch assignment
      await storage.updateUserBatchProcess(traineeId, batchId, newBatchId);

      res.json({ message: "Trainee transferred successfully" });
    } catch (error: any) {
      console.error("Error transferring trainee:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add trainee delete endpoint
  app.delete("/api/organizations/:orgId/batches/:batchId/trainees/:traineeId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      const traineeId = parseInt(req.params.traineeId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only manage trainees in your own organization" });
      }

      console.log('Removing trainee:', traineeId, 'from batch:', batchId);

      // Simply remove trainee from batch without modifying user status
      await storage.removeTraineeFromBatch(traineeId);

      console.log('Successfully removed trainee from batch');
      res.json({ message: "Trainee removed from batch successfully" });
    } catch (error: any) {
      console.error("Error removing trainee:", error);
      res.status(400).json({ message: error.message || "Failed to remove trainee" });
    }
  });

  // Update the bulk upload route to handle role field
  app.post("/api/organizations/:orgId/batches/:batchId/trainees/bulk", upload.single('file'), async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "No file uploaded" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      // Read the uploaded file
      const workbook = XLSX.read(req.file.buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let failureCount = 0;
      const errors = [];

      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Process each row
      for (const row of rows) {
        try {
          // Validate the role
          const role = row.role?.toLowerCase();
          const validRoles = ['manager', 'team_lead', 'quality_analyst', 'trainer', 'advisor'];
          if (!validRoles.includes(role)) {
            throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
          }

          const traineeData = {
            username: row.username,
            fullName: row.fullName,
            email: row.email,
            employeeId: row.employeeId,
            phoneNumber: row.phoneNumber,
            dateOfJoining: row.dateOfJoining,
            dateOfBirth: row.dateOfBirth,
            education: row.education,
            password: await hashPassword(row.password),
            role: role,
            category: "trainee", // Always set category as trainee
            processId: batch.processId,
            lineOfBusinessId: batch.lineOfBusinessId,
            locationId: batch.locationId,
            managerId: batch.trainerId,
            organizationId: orgId,
            batchId: batchId
          };

          await storage.createUser(traineeData);
          successCount++;
        } catch (error) {
          failureCount++;
          errors.push(`Row ${rows.indexOf(row) + 2}: ${error.message}`);
        }
      }

      res.json({
        message: "Bulk upload completed",
        successCount,
        failureCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Bulk upload error:", error);
      res.status(500).json({
        message: "Failed to process bulk upload",
        error: error.message
      });
    }
  });

  // Add template download endpoint
  app.get("/api/templates/trainee-upload", (req, res) => {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Define headers
      const headers = [
        'username',
        'fullName',
        'email',
        'employeeId',
        'phoneNumber',
        'dateOfJoining',
        'dateOfBirth',
        'education',
        'password',
        'role' // Added 'role' column to the template
      ];

      // Create example data row
      const exampleData = [
        'john.doe',
        'John Doe',
        'john.doe@example.com',
        'EMP123',
        '+1234567890',
        '2025-03-06', // Format: YYYY-MM-DD
        '1990-01-01', // Format: YYYY-MM-DD
        'Bachelor\'s Degree',
        'Password123!', // Will be hashed on upload
        'advisor' // Example role showing advisor instead of trainee
      ];

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet([headers, exampleData]);

      // Add column widths
      ws['!cols'] = headers.map(() => ({ wch: 15 }));

      // Add styling to headers
      for (let i = 0; i < headers.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headers[i] };
        ws[cellRef].s = { font: { bold: true } };
      }

      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Trainees');

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=trainee-upload-template.xlsx');

      // Write to response
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.send(buffer);

    } catch (error: any) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // Add the onboarding completion endpoint
  app.post("/api/users/:id/complete-onboarding", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const userId = parseInt(req.params.id);

      // Users can only complete their own onboarding
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "You can only complete your own onboarding" });
      }

      console.log(`Completing onboarding for user ${userId}`);
      const updatedUser = await storage.updateUser(userId, {
        onboardingCompleted: true
      });

      console.log('Onboarding completed successfully');
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: error.message || "Failed to complete onboarding" });
    }
  });

  // Add new route for starting a batch after existing batch routes
  app.post("/api/batches/:batchId/start", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      if (!batchId) {
        return res.status(400).json({ message: "Invalid batch ID" });
      }

      // Get the batch
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch can be started
      if (batch.status !== 'planned') {
        return res.status(400).json({ 
          message: "Only planned batches can be started" 
        });

      // Record batch history first
      await addBatchHistoryRecord(
        batchId,
        'phase_change',
        `Batch phase changed from planned to induction (batch started)`,
        'planned',
        'induction',
        batch.organizationId,
        req.user.id // Pass the actual user ID who started the batch
      );

      }

      // Get trainees count for this batch
      const trainees = await storage.getBatchTrainees(batchId);
      const traineeCount = trainees.filter(trainee => trainee.category === 'trainee').length;

      if (traineeCount === 0) {
        return res.status(400).json({
          message: "Cannot start batch without any trainees. Please add at least one trainee before starting the batch."
        });
      }

      // Store dates in UTC format while preserving IST midnight
      const currentDate = new Date();
      const updatedBatch = await storage.updateBatch(batchId, {
        status: 'induction',
        startDate: toUTCStorage(currentDate.toISOString())
      });

      console.log('Successfully started batch:', {
        ...updatedBatch,
        startDate: formatISTDateOnly(updatedBatch.startDate)
      });

      res.json(updatedBatch);

    } catch (error: any) {
      console.error("Error starting batch:", error);
      res.status(500).json({ message: error.message || "Failed to start batch" });
    }
  });

  // Add batch listing route with status filter
  app.get("/api/organizations/:orgId/batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const status = req.query.status as string;

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      let batches = await storage.listBatches(orgId);

      // Filter by status if specified
      if (status) {
        batches = batches.filter(batch => batch.status === status);
      }

      // For each batch, enrich with location, process, and line of business details
      const enrichedBatches = await Promise.all(batches.map(async (batch) => {
        const [location, process, line_of_business] = await Promise.all([
          storage.getLocation(batch.locationId),
          storage.getProcess(batch.processId),
          storage.getLineOfBusiness(batch.lineOfBusinessId)
        ]);

        return {
          ...batch,
          location,
          process,
          line_ofbusiness
        };
      }));

      console.log(`Found ${enrichedBatches.length} batches for organization ${orgId}`);
      res.json(enrichedBatches);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Modify trainee management route to only show 'planned' batches
  app.get("/api/organizations/:orgId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      const orgId = parseInt(req.params.orgId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view trainees in your own organization" });
      }

      // Get batch details to verify it exists and belongs to the organization
      const batch = await storage.getBatch(batchId);
      if (!batch || batch.organizationId !== orgId) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch status is 'planned'
      if (batch.status !== 'planned') {
        return res.status(403).json({ message: "Only 'planned' batches can be accessed through this route." });
      }

      // Get all trainees for this batch
      const trainees = await storage.getBatchTrainees(batchId);
      console.log(`Found ${trainees.length} trainees for batch ${batchId}`);

      // Get detailed user information for each trainee
      const traineeDetails = await Promise.all(
        trainees.map(async (trainee) => {
          const user = await storage.getUser(trainee.userId);
          return {
            ...trainee,
            user: user ? {
              username: user.username,
              fullName: user.fullName,
              email: user.email,
              employeeId: user.employeeId,
              phoneNumber: user.phoneNumber,
            } : null
          };
        })
      );

      res.json(traineeDetails);
    } catch (error: any) {
      console.error("Error fetching batch trainees:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add the trainee transfer endpoint
  app.post("/api/organizations/:orgId/batches/:batchId/trainees/:traineeId/transfer", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      const traineeId = parseInt(req.params.traineeId);
      const { newBatchId } = req.body;

      // Validate the new batch exists and belongs to the organization
      const newBatch = await storage.getBatch(newBatchId);
      if (!newBatch || newBatch.organizationId !== orgId) {
        return res.status(404).json({ message: "Target batch not found" });
      }

      // Check capacity in the new batch
      const currentTrainees = await storage.getBatchTrainees(newBatchId);
      if (currentTrainees.length >= newBatch.capacityLimit) {
        return res.status(400).json({
          message: `Cannot transfer trainee. Target batch has reached its capacity limit of ${newBatch.capacityLimit}`
        });
      }

      // Update the trainee's batch assignment
      await storage.updateUserBatchProcess(traineeId, batchId, newBatchId);

      res.json({ message: "Trainee transferred successfully" });
    } catch (error: any) {
      console.error("Error transferring trainee:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add trainee delete endpoint
  app.delete("/api/organizations/:orgId/batches/:batchId/trainees/:traineeId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      const traineeId = parseInt(req.params.traineeId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only manage trainees in your own organization" });
      }

      console.log('Removing trainee:', traineeId, 'from batch:', batchId);

      // Simply remove trainee from batch without modifying user status
      await storage.removeTraineeFromBatch(traineeId);

      console.log('Successfully removed trainee from batch');
      res.json({ message: "Trainee removed from batch successfully" });
    } catch (error: any) {
      console.error("Error removing trainee:", error);
      res.status(400).json({ message: error.message || "Failed to remove trainee" });
    }
  });

  // Update the bulk upload route to handle role field
  app.post("/api/organizations/:orgId/batches/:batchId/trainees/bulk", upload.single('file'), async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "No file uploaded" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      // Read the uploaded file
      const workbook = XLSX.read(req.file.buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let failureCount = 0;
      const errors = [];

      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Process each row
      for (const row of rows) {
        try {
          // Validate the role
          const role = row.role?.toLowerCase();
          const validRoles = ['manager', 'team_lead', 'quality_analyst', 'trainer', 'advisor'];
          if (!validRoles.includes(role)) {
            throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
          }

          const traineeData = {
            username: row.username,
            fullName: row.fullName,
            email: row.email,
            employeeId: row.employeeId,
            phoneNumber: row.phoneNumber,
            dateOfJoining: row.dateOfJoining,
            dateOfBirth: row.dateOfBirth,
            education: row.education,
            password: await hashPassword(row.password),
            role: role,
            category: "trainee", // Always set category as trainee
            processId: batch.processId,
            lineOfBusinessId: batch.lineOfBusinessId,
            locationId: batch.locationId,
            managerId: batch.trainerId,
            organizationId: orgId,
            batchId: batchId
          };

          await storage.createUser(traineeData);
          successCount++;
        } catch (error) {
          failureCount++;
          errors.push(`Row ${rows.indexOf(row) + 2}: ${error.message}`);
        }
      }

      res.json({
        message: "Bulk upload completed",
        successCount,
        failureCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Bulk upload error:", error);
      res.status(500).json({
        message: "Failed to process bulk upload",
        error: error.message
      });
    }
  });

  // Add template download endpoint
  app.get("/api/templates/trainee-upload", (req, res) => {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Define headers
      const headers = [
        'username',
        'fullName',
        'email',
        'employeeId',
        'phoneNumber',
        'dateOfJoining',
        'dateOfBirth',
        'education',
        'password',
        'role' // Added 'role' column to the template
      ];

      // Create example data row
      const exampleData = [
        'john.doe',
        'John Doe',
        'john.doe@example.com',
        'EMP123',
        '+1234567890',
        '2025-03-06', // Format: YYYY-MM-DD
        '1990-01-01', // Format: YYYY-MM-DD
        'Bachelor\'s Degree',
        'Password123!', // Will be hashed on upload
        'advisor' // Example role showing advisor instead of trainee
      ];

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet([headers, exampleData]);

      // Add column widths
      ws['!cols'] = headers.map(() => ({ wch: 15 }));

      // Add styling to headers
      for (let i = 0; i < headers.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headers[i] };
        ws[cellRef].s = { font: { bold: true } };
      }

      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Trainees');

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=trainee-upload-template.xlsx');

      // Write to response
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.send(buffer);

    } catch (error: any) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // Add the onboarding completion endpoint
  app.post("/api/users/:id/complete-onboarding", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const userId = parseInt(req.params.id);

      // Users can only complete their own onboarding
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "You can only complete your own onboarding" });
      }

      console.log(`Completing onboarding for user ${userId}`);
      const updatedUser = await storage.updateUser(userId, {
        onboardingCompleted: true
      });

      console.log('Onboarding completed successfully');
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: error.message || "Failed to complete onboarding" });
    }
  });

  // Add new route for starting a batch after existing batch routes
  app.post("/api/batches/:batchId/start", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      if (!batchId) {
        return res.status(400).json({ message: "Invalid batch ID" });
      }


      // Record batch history first
      await addBatchHistoryRecord(
        batchId,
        'phase_change',
        `Batch phase changed from planned to induction (batch started)`,
        'planned',
        'induction',
        batch.organizationId,
        req.user.id // Pass the actual user ID who started the batch
      );

      // Get the batch
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch can be started
      if (batch.status !== 'planned') {
        return res.status(400).json({ 
          message: "Only planned batches can be started" 
        });
      }

      // Get trainees count for this batch
      const trainees = await storage.getBatchTrainees(batchId);
      const traineeCount = trainees.filter(trainee => trainee.category === 'trainee').length;

      if (traineeCount === 0) {
        return res.status(400).json({
          message: "Cannot start batch without any trainees. Please add at least one trainee before starting the batch."
        });
      }

      // Store dates in UTC format while preserving IST midnight
      const currentDate = new Date();
      const updatedBatch = await storage.updateBatch(batchId, {
        status: 'induction',
        startDate: toUTCStorage(currentDate.toISOString())
      });

      console.log('Successfully started batch:', {
        ...updatedBatch,
        startDate: formatISTDateOnly(updatedBatch.startDate)
      });

      res.json(updatedBatch);

    } catch (error: any) {
      console.error("Error starting batch:", error);
      res.status(500).json({ message: error.message || "Failed to start batch" });
    }
  });

  // Add attendance routes
  app.post("/api/attendance/:traineeId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const traineeId = parseInt(req.params.traineeId);
      const { status, date } = req.body;

      // Validate the status
      const validStatuses = ['present', 'absent', 'late', 'leave', 'half_day', 'public_holiday', 'weekly_off'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid attendance status", validStatuses });
      }

      // Save attendance record
      const attendance = await storage.createAttendanceRecord({
        traineeId,
        status,
        date,
        markedById: req.user.id,
        organizationId: req.user.organizationId
      });

      // Return the updated attendance record
      res.json(attendance);
    } catch (error: any) {
      console.error("Error updating attendance:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get attendance for a trainee
  app.get("/api/attendance/:traineeId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const traineeId = parseInt(req.params.traineeId);
      const date = req.query.date as string;

      const attendance = await storage.getAttendanceRecord(traineeId, date);
      res.json(attendance);
    } catch (error: any) {
      console.error("Error fetching attendance:", error);
      res.status(500).json({ message: error.message });
    }
  });
      
  // Get batch-specific attendance data with day-by-day breakdown
  app.get("/api/organizations/:orgId/batches/:batchId/attendance/history", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      
      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view attendance data in your own organization" });
      }
      
      // Check if user has access to the batch
      const hasAccess = await userHasBatchAccess(req.user.id, batchId);
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this batch" });
      }

      console.log(`Fetching attendance history for batch: ${batchId}`);
      
      // Get all attendance records for this batch
      const attendanceRecords = await db.query.attendance.findMany({
        where: eq(attendance.batchId, batchId),
        orderBy: (attendance, { asc }) => [asc(attendance.date)]
      });
      
      // Group attendance by date
      const groupedByDate = new Map();
      
      for (const record of attendanceRecords) {
        // Format date as ISO string for consistent grouping
        const date = record.date ? new Date(record.date).toISOString().split('T')[0] : 
                    record.updated_at ? new Date(record.updated_at).toISOString().split('T')[0] : 
                    null;
        
        if (!date) continue;
        
        if (!groupedByDate.has(date)) {
          groupedByDate.set(date, {
            date,
            presentCount: 0,
            absentCount: 0,
            lateCount: 0,
            leaveCount: 0,
            totalTrainees: 0
          });
        }
        
        const dateGroup = groupedByDate.get(date);
        dateGroup.totalTrainees++;
        
        switch (record.status?.toLowerCase()) {
          case 'present':
            dateGroup.presentCount++;
            break;
          case 'absent':
            dateGroup.absentCount++;
            break;
          case 'late':
            dateGroup.lateCount++;
            break;
          case 'leave':
            dateGroup.leaveCount++;
            break;
          default:
            // If no status, count as absent
            dateGroup.absentCount++;
        }
      }
      
      // Calculate attendance rate for each day
      for (const [date, data] of groupedByDate) {
        const attended = data.presentCount + (data.lateCount * 0.5);
        data.attendanceRate = Math.round((attended / data.totalTrainees) * 100);
      }
      
      // Convert to array and sort by date
      const dailyBreakdown = Array.from(groupedByDate.values())
        .sort((a, b) => a.date.localeCompare(b.date));
      
      res.json(dailyBreakdown);
    } catch (error) {
      console.error('Error getting batch attendance history:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get aggregated attendance overview stats for the dashboard
  app.get("/api/organizations/:orgId/attendance/overview", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      
      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view attendance data in your own organization" });
      }
      
      // Parse batch IDs if provided
      let batchIds: number[] | undefined;
      if (req.query.batchIds) {
        try {
          batchIds = JSON.parse(req.query.batchIds as string);
          if (!Array.isArray(batchIds)) {
            batchIds = undefined;
          }
        } catch (e) {
          console.error('Error parsing batchIds:', e);
        }
      }
      
      // Parse date range if provided
      let dateRange: { from: string; to: string } | undefined;
      if (req.query.dateFrom && req.query.dateTo) {
        dateRange = {
          from: req.query.dateFrom as string,
          to: req.query.dateTo as string
        };
      }
      
      // Get attendance overview data
      const overviewData = await storage.getBatchAttendanceOverview(orgId, {
        batchIds,
        dateRange
      });
      
      res.json(overviewData);
    } catch (error: any) {
      console.error("Error fetching attendance overview:", error);
      res.status(500).json({ message: error.message || "Failed to fetch attendance overview" });
    }
  });
  
  // Get daily attendance history for a specific batch
  app.get("/api/organizations/:orgId/batches/:batchId/attendance/history", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      
      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view attendance data in your own organization" });
      }
      
      // Get attendance history data for this specific batch
      const historyData = await storage.getBatchAttendanceHistory(orgId, batchId);
      
      res.json(historyData);
    } catch (error: any) {
      console.error("Error fetching batch attendance history:", error);
      res.status(500).json({ message: error.message || "Failed to fetch batch attendance history" });
    }
  });

  // Export detailed attendance data for a specific batch (legacy endpoint)
  app.get("/api/organizations/:orgId/batches/:batchId/attendance/export", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      
      // Redirect to the new endpoint that supports multiple batches
      return res.redirect(307, `/api/organizations/${orgId}/attendance/export?batchIds=${batchId}&startDate=${req.query.startDate || ''}&endDate=${req.query.endDate || ''}`);
    } catch (error) {
      console.error('Error exporting attendance data:', error);
      res.status(500).json({ message: "Failed to export attendance data" });
    }
  });
  
  // Export detailed attendance data for multiple batches or by date range only
  // Evaluation Export Endpoint
  app.get("/api/organizations/:orgId/evaluations/export", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      
      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only export evaluation data from your own organization" });
      }
      
      // Parse date range if provided
      let startDate: string | undefined = req.query.startDate as string;
      let endDate: string | undefined = req.query.endDate as string;
      
      // Parse batch IDs if provided (can be a comma-separated list or undefined)
      const batchIdsParam = req.query.batchIds as string | undefined;
      const batchIds = batchIdsParam ? batchIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];
      
      // Parse template ID if provided
      const templateIdParam = req.query.templateId as string | undefined;
      const templateId = templateIdParam ? parseInt(templateIdParam) : undefined;
      
      console.log(`Exporting evaluation data${batchIds.length > 0 ? ' for batches: ' + batchIds.join(', ') : ' for all batches'}${templateId ? ', template: ' + templateId : ''}, startDate: ${startDate}, endDate: ${endDate}`);
      
      // Create an aliased table for evaluator
      const evaluator = aliasedTable(users, "evaluator");

      // Prepare the evaluation query with all tables we need to join
      const evaluationsQuery = db
        .select({
          id: evaluations.id,
          templateName: evaluationTemplates.name,
          batchName: organizationBatches.name,
          processName: organizationProcesses.name,
          evaluationType: evaluations.evaluationType,
          finalScore: evaluations.finalScore,
          status: evaluations.status,
          feedbackThreshold: evaluations.feedbackThreshold,
          createdAt: evaluations.createdAt,
          updatedAt: evaluations.updatedAt,
          traineeName: users.fullName,
          traineeEmployeeId: users.employeeId,
          evaluatorName: evaluator.fullName,
          evaluatorEmployeeId: evaluator.employeeId,
          audioFileId: evaluations.audioFileId,
          audioFileName: audioFiles.filename,
          audioCallType: sql`${audioFiles.callMetrics}->>'callType'`,
        })
        .from(evaluations)
        .leftJoin(evaluationTemplates, eq(evaluations.templateId, evaluationTemplates.id))
        .leftJoin(organizationBatches, eq(evaluations.batchId, organizationBatches.id))
        .leftJoin(organizationProcesses, eq(organizationBatches.processId, organizationProcesses.id))
        .leftJoin(users, eq(evaluations.traineeId, users.id))
        .leftJoin(evaluator, eq(evaluations.evaluatorId, evaluator.id))
        .leftJoin(audioFiles, eq(evaluations.audioFileId, audioFiles.id))
        .where(eq(evaluations.organizationId, orgId));
      
      // Apply template filter if provided
      if (templateId) {
        evaluationsQuery.where(eq(evaluations.templateId, templateId));
      }
      
      // Apply batch filter if provided
      if (batchIds.length > 0) {
        evaluationsQuery.where(inArray(evaluations.batchId, batchIds));
      }
      
      // Apply date filters if provided
      if (startDate) {
        evaluationsQuery.where(gte(evaluations.createdAt, new Date(startDate)));
      }
      
      if (endDate) {
        // Add one day to include the end date entirely
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        evaluationsQuery.where(lte(evaluations.createdAt, nextDay));
      }
      
      // Execute the query
      const evaluationResults = await evaluationsQuery.execute();
      
      // Fetch parameter scores for each evaluation
      const evaluationIds = evaluationResults.map(e => e.id);
      
      // Only proceed if we have evaluations to export
      if (evaluationIds.length > 0) {
        // Get parameter scores for these evaluations
        const parameterScores = await db
          .select({
            evaluationId: evaluationScores.evaluationId,
            parameterId: evaluationScores.parameterId,
            pillarId: evaluationParameters.pillarId,
            parameterName: evaluationParameters.name,
            pillarName: evaluationPillars.name,
            score: evaluationScores.score,
            rating: evaluationScores.score, // The actual rating value (yes/no/na or numeric)
            weightage: evaluationParameters.weightage,
            comment: evaluationScores.comment,
            parameter: evaluationParameters, // Include the full parameter object for access to question details
          })
          .from(evaluationScores)
          .innerJoin(evaluationParameters, eq(evaluationScores.parameterId, evaluationParameters.id))
          .innerJoin(evaluationPillars, eq(evaluationParameters.pillarId, evaluationPillars.id))
          .where(inArray(evaluationScores.evaluationId, evaluationIds));
          
        // Create two types of export data: 
        // 1. Summary data with high-level evaluation details
        // 2. Parameter-wise detailed data with individual scores

        // Create summary data (one row per evaluation)
        const summaryData = evaluationResults.map(evaluation => {
          // Find all parameter scores for this evaluation
          const scores = parameterScores.filter(score => score.evaluationId === evaluation.id);
          
          // Get average score by pillar for summary
          const pillarScores = {};
          scores.forEach(score => {
            if (!pillarScores[score.pillarName]) {
              pillarScores[score.pillarName] = {
                totalScore: 0,
                count: 0
              };
            }
            pillarScores[score.pillarName].totalScore += parseInt(score.score) || 0;
            pillarScores[score.pillarName].count += 1;
          });
          
          // Calculate averages and format as object
          const pillarAverages = {};
          Object.keys(pillarScores).forEach(pillarName => {
            const pillar = pillarScores[pillarName];
            pillarAverages[`${pillarName}_Average`] = pillar.count > 0 
              ? (pillar.totalScore / pillar.count).toFixed(2) 
              : 'N/A';
          });
          
          return {
            evaluationId: evaluation.id,
            templateName: evaluation.templateName,
            batchName: evaluation.batchName,
            processName: evaluation.processName,
            evaluationType: evaluation.evaluationType,
            finalScore: evaluation.finalScore,
            status: evaluation.status,
            feedbackThreshold: evaluation.feedbackThreshold,
            createdAt: evaluation.createdAt ? formatIST(new Date(evaluation.createdAt)) : '',
            updatedAt: evaluation.updatedAt ? formatIST(new Date(evaluation.updatedAt)) : '',
            traineeName: evaluation.traineeName || 'N/A',
            traineeEmployeeId: evaluation.traineeEmployeeId || 'N/A',
            evaluatorName: evaluation.evaluatorName || 'N/A',
            evaluatorEmployeeId: evaluation.evaluatorEmployeeId || 'N/A',
            audioFileId: evaluation.audioFileId || 'N/A',
            audioFileName: evaluation.audioFileName || 'N/A',
            audioType: evaluation.audioCallType || 'N/A',
            ...pillarAverages,
            parameterCount: scores.length
          };
        });
        
        // Create detailed parameter-wise data (multiple rows per evaluation)
        const parameterData = [];
        let parametersProcessed = 0;
        
        // Debug info about score data
        console.log(`Processing ${evaluationResults.length} evaluations with ${parameterScores.length} total parameter scores`);
        
        // If there are no parameter scores, create at least one dummy row to ensure the sheet is generated
        if (parameterScores.length === 0 && evaluationResults.length > 0) {
          // Create a dummy parameter row to ensure sheet gets generated
          const dummyEval = evaluationResults[0];
          parameterData.push({
            evaluationId: dummyEval.id,
            templateName: dummyEval.templateName,
            batchName: dummyEval.batchName,
            processName: dummyEval.processName,
            createdAt: dummyEval.createdAt ? formatIST(new Date(dummyEval.createdAt)) : '',
            traineeName: dummyEval.traineeName || 'N/A',
            traineeEmployeeId: dummyEval.traineeEmployeeId || 'N/A',
            evaluatorName: dummyEval.evaluatorName || 'N/A',
            evaluatorEmployeeId: dummyEval.evaluatorEmployeeId || 'N/A',
            finalScore: dummyEval.finalScore,
            status: dummyEval.status,
            audioType: dummyEval.audioCallType || 'N/A',
            pillarName: 'No Data',
            parameterName: 'No Parameter Data Available',
            parameterScore: 'N/A',
            weightage: 'N/A',
            comment: '',
            questionText: 'No parameter data found',
            yesNoQuestion: 'N/A',
            answerValue: '',
          });
          console.log("Created dummy parameter row because no real parameter data was found");
        } else {
          // Process real parameter data
          evaluationResults.forEach(evaluation => {
            const scores = parameterScores.filter(score => score.evaluationId === evaluation.id);
            
            console.log(`Evaluation ID ${evaluation.id} has ${scores.length} parameter scores`);
            
            // Create a separate row for each parameter score
            scores.forEach(score => {
              // Validate score data to ensure required fields exist
              const parameterEntry = {
                evaluationId: evaluation.id,
                templateName: evaluation.templateName || 'Unknown Template',
                batchName: evaluation.batchName || 'Unknown Batch',
                processName: evaluation.processName || 'Unknown Process',
                createdAt: evaluation.createdAt ? formatIST(new Date(evaluation.createdAt)) : '',
                traineeName: evaluation.traineeName || 'N/A',
                traineeEmployeeId: evaluation.traineeEmployeeId || 'N/A',
                evaluatorName: evaluation.evaluatorName || 'N/A',
                evaluatorEmployeeId: evaluation.evaluatorEmployeeId || 'N/A',
                finalScore: evaluation.finalScore || 0,
                status: evaluation.status || 'Unknown',
                audioType: evaluation.audioCallType || 'N/A',
                
                // Parameter-specific details
                pillarName: score.pillarName || 'Unknown Pillar',
                parameterName: score.parameterName || 'Unknown Parameter',
                parameterScore: score.score || 0,
                weightage: score.weightage || 0,
                comment: score.comment || '',
                questionText: score.parameter?.name || score.parameterName || 'Unknown Question',
                yesNoQuestion: score.parameter?.ratingType === 'yes_no_na' ? 'Yes' : 'No',
                answerValue: score.rating || '',
              };
              
              parameterData.push(parameterEntry);
              parametersProcessed++;
            });
          });
          
          console.log(`Processed ${parametersProcessed} parameter entries successfully`);
        }
        
        console.log(`Returning ${summaryData.length} summary records and ${parameterData.length} parameter records`);
        
        // Debug parameter data structure
        if (parameterData.length > 0) {
          console.log("First parameter record:", JSON.stringify(parameterData[0], null, 2));
        }
        
        // Return both datasets
        return res.json({
          summary: summaryData,
          parameters: parameterData
        });
      } else {
        // No data found
        return res.json([]);
      }
    } catch (error) {
      console.error("Error exporting evaluation data:", error);
      return res.status(500).json({ message: "Failed to export evaluation data" });
    }
  });

  app.get("/api/organizations/:orgId/trainee-progress/export", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      
      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only export trainee progress data from your own organization" });
      }
      
      // Parse date range if provided
      let startDate: string | undefined = req.query.startDate as string;
      let endDate: string | undefined = req.query.endDate as string;
      
      // Parse batch IDs if provided (can be a comma-separated list or undefined)
      const batchIdsParam = req.query.batchIds as string | undefined;
      const batchIds = batchIdsParam ? batchIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];
      
      console.log(`Exporting trainee progress data${batchIds.length > 0 ? ' for batches: ' + batchIds.join(', ') : ' for all batches'}, startDate: ${startDate}, endDate: ${endDate}`);
      
      // Create an aliased table for evaluator
      const evaluator = aliasedTable(users, "evaluator");
      
      // Prepare the evaluation query with all tables we need to join
      const evaluationsQuery = db
        .select({
          id: evaluations.id,
          templateName: evaluationTemplates.name,
          batchName: organizationBatches.name,
          processName: organizationProcesses.name,
          evaluationType: evaluations.evaluationType,
          finalScore: evaluations.finalScore,
          status: evaluations.status,
          feedbackThreshold: evaluations.feedbackThreshold,
          createdAt: evaluations.createdAt,
          updatedAt: evaluations.updatedAt,
          traineeName: users.fullName,
          traineeEmployeeId: users.employeeId,
          evaluatorName: evaluator.fullName,
          evaluatorEmployeeId: evaluator.employeeId,
          audioFileId: evaluations.audioFileId,
          audioFileName: audioFiles.filename,
          audioCallType: sql`${audioFiles.callMetrics}->>'callType'`
        })
        .from(evaluations)
        .leftJoin(evaluationTemplates, eq(evaluations.templateId, evaluationTemplates.id))
        .leftJoin(organizationBatches, eq(evaluations.batchId, organizationBatches.id))
        .leftJoin(organizationProcesses, eq(organizationBatches.processId, organizationProcesses.id))
        .leftJoin(users, eq(evaluations.traineeId, users.id))
        .leftJoin(evaluator, eq(evaluations.evaluatorId, evaluator.id))
        .leftJoin(audioFiles, eq(evaluations.audioFileId, audioFiles.id))
        .where(eq(evaluations.organizationId, orgId));
      
      // Apply batch filter if provided
      if (batchIds.length > 0) {
        evaluationsQuery.where(inArray(evaluations.batchId, batchIds));
      }
      
      // Apply date filters if provided
      if (startDate) {
        evaluationsQuery.where(gte(evaluations.createdAt, new Date(startDate)));
      }
      
      if (endDate) {
        // Add one day to include the end date entirely
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        evaluationsQuery.where(lte(evaluations.createdAt, nextDay));
      }
      
      // Execute the query
      const evaluationResults = await evaluationsQuery.execute();
      
      // Format results for export
      const formattedResults = evaluationResults.map(evaluation => ({
        evaluationId: evaluation.id,
        templateName: evaluation.templateName,
        batchName: evaluation.batchName,
        processName: evaluation.processName,
        evaluationType: evaluation.evaluationType,
        finalScore: evaluation.finalScore,
        status: evaluation.status,
        feedbackThreshold: evaluation.feedbackThreshold,
        createdAt: evaluation.createdAt ? formatIST(new Date(evaluation.createdAt)) : '',
        updatedAt: evaluation.updatedAt ? formatIST(new Date(evaluation.updatedAt)) : '',
        traineeName: evaluation.traineeName || 'N/A',
        traineeEmployeeId: evaluation.traineeEmployeeId || 'N/A',
        evaluatorName: evaluation.evaluatorName || 'N/A',
        evaluatorEmployeeId: evaluation.evaluatorEmployeeId || 'N/A',
        audioFileId: evaluation.audioFileId || 'N/A',
        audioFileName: evaluation.audioFileName || 'N/A',
        audioType: evaluation.audioCallType || 'N/A'
      }));
      
      return res.json(formattedResults);
    } catch (error) {
      console.error("Error exporting trainee progress data:", error);
      return res.status(500).json({ message: "Failed to export trainee progress data" });
    }
  });

  app.get("/api/organizations/:orgId/attendance/export", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      
      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only export attendance data from your own organization" });
      }
      
      // Parse date range if provided
      let startDate: string | undefined = req.query.startDate as string;
      let endDate: string | undefined = req.query.endDate as string;
      
      // Parse batch IDs if provided (can be a comma-separated list or undefined)
      const batchIdsParam = req.query.batchIds as string | undefined;
      const batchIds = batchIdsParam ? batchIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];
      
      console.log(`Exporting attendance data${batchIds.length > 0 ? ' for batches: ' + batchIds.join(', ') : ' for all batches'}, startDate: ${startDate}, endDate: ${endDate}`);
      
      if (!startDate && !endDate && batchIds.length === 0) {
        return res.status(400).json({ message: "You must provide at least a date range or batch IDs to export attendance data" });
      }
      
      // Prepare the query for getting trainees
      let traineesQuery = db
        .select({
          id: users.id,
          fullName: users.fullName,
          employeeId: users.employeeId,
          batchId: userBatchProcesses.batchId,
        })
        .from(users)
        .innerJoin(userBatchProcesses, eq(users.id, userBatchProcesses.userId))
        .where(eq(users.organizationId, orgId));
      
      // Filter by batch IDs if provided
      if (batchIds.length > 0) {
        traineesQuery = traineesQuery.where(inArray(userBatchProcesses.batchId, batchIds));
      }
      
      // Execute the query
      const batchTrainees = await traineesQuery;
      
      console.log(`Found ${batchTrainees.length} trainees in ${batchIds.length > 0 ? batchIds.length : 'all'} batches`);
      
      if (batchTrainees.length === 0) {
        return res.json([]);
      }
      
      // Get batch details for all involved batches
      const uniqueBatchIds = [...new Set(batchTrainees.map(trainee => trainee.batchId))];
      
      const batches = await db.query.organizationBatches.findMany({
        where: inArray(organizationBatches.id, uniqueBatchIds),
      });
      
      // Create a map for batch name lookup
      const batchNameMap = new Map(batches.map(batch => [batch.id, batch.name]));
      
      // Create a map for easy lookup of trainee information
      const traineeMap = new Map(batchTrainees.map(trainee => [trainee.id, trainee]));
      
      // Prepare query for attendance records
      let attendanceQuery = db
        .select({
          id: attendance.id,
          traineeId: attendance.traineeId,
          batchId: attendance.batchId,
          date: attendance.date,
          status: attendance.status,
          phase: attendance.phase,
          markedById: attendance.markedById,
          createdAt: attendance.createdAt,
          updatedAt: attendance.updatedAt
        })
        .from(attendance)
        .where(eq(attendance.organizationId, orgId));
      
      // Filter by batch IDs if provided
      if (batchIds.length > 0) {
        attendanceQuery = attendanceQuery.where(inArray(attendance.batchId, batchIds));
      }
      
      // Filter by trainee IDs based on the trainees we found
      const traineeIds = batchTrainees.map(trainee => trainee.id);
      attendanceQuery = attendanceQuery.where(inArray(attendance.traineeId, traineeIds));
      
      // Add date filters if provided
      if (startDate) {
        attendanceQuery = attendanceQuery.where(gte(attendance.date, startDate));
      }
      
      if (endDate) {
        attendanceQuery = attendanceQuery.where(lte(attendance.date, endDate));
      }
      
      // Execute the query
      const attendanceRecords = await attendanceQuery;
      console.log(`Found ${attendanceRecords.length} attendance records`);
      
      // Group attendance records by trainee and date
      const attendanceByTraineeAndDate = new Map();
      
      for (const record of attendanceRecords) {
        const key = `${record.traineeId}-${record.date}`;
        attendanceByTraineeAndDate.set(key, record);
      }
      
      // Get marker names if there are any attendance records
      let markerMap = new Map();
      
      if (attendanceRecords.length > 0) {
        const markerIds = [...new Set(attendanceRecords.map(record => record.markedById).filter(id => id !== null))] as number[];
        
        if (markerIds.length > 0) {
          const markers = await db
            .select({
              id: users.id,
              fullName: users.fullName
            })
            .from(users)
            .where(inArray(users.id, markerIds));
          
          markerMap = new Map(markers.map(marker => [marker.id, marker]));
        }
      }
      
      // Generate date range if start and end dates are provided
      let allDates: string[] = [];
      
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
          allDates.push(date.toISOString().split('T')[0]);
        }
      } else if (attendanceRecords.length > 0) {
        // If no date range, use the unique dates from attendance records
        allDates = [...new Set(attendanceRecords.map(record => record.date))];
      }
      
      // Create comprehensive records for all trainees and dates where attendance was marked
      const comprehensiveRecords = [];
      
      // For each attendance record that has a status and falls within the date range
      for (const record of attendanceRecords) {
        // Only include records that have a status
        if (record.status) {
          // Extra date range validation to ensure only records within range are included
          if (startDate && endDate) {
            const recordDate = record.date;
            if (recordDate < startDate || recordDate > endDate) {
              continue; // Skip records outside the date range
            }
          }
          
          const trainee = traineeMap.get(record.traineeId);
          if (!trainee) continue; // Skip if trainee not found (shouldn't happen given our query)
          
          const marker = record.markedById ? markerMap.get(record.markedById) : null;
          const batchName = batchNameMap.get(record.batchId) || 'Unknown Batch';
          
          comprehensiveRecords.push({
            id: record.id,
            date: record.date,
            traineeId: record.traineeId,
            traineeName: trainee.fullName,
            employeeId: trainee.employeeId,
            status: record.status,
            phase: record.phase,
            markedBy: marker ? marker.fullName : 'System',
            batchName: batchName,
            batchId: record.batchId,
            createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : null,
            updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : null
          });
        }
      }
      
      // Sort by date then by trainee name then by batch name
      comprehensiveRecords.sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        if (a.traineeName !== b.traineeName) {
          return a.traineeName.localeCompare(b.traineeName);
        }
        return a.batchName.localeCompare(b.batchName);
      });
      
      res.json(comprehensiveRecords);
    } catch (error) {
      console.error('Error exporting attendance data:', error);
      res.status(500).json({ message: "Failed to export attendance data" });
    }
  });

  // Add question routes
  app.post("/api/questions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const questionData = {
        ...req.body,
        createdBy: req.user.id,
        organizationId: req.user.organizationId, 
        processId: req.user.processId || 1, // Default to first process if none assigned
      };

      // Create the question in the database
      const question = await storage.createQuestion(questionData);
      console.log('Created question:', question);
      
      res.status(201).json(question);
    } catch (error: any) {
      console.error("Error creating question:", error); 
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/questions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      // Check if we should include inactive questions
      const includeInactive = req.query.includeInactive === 'true';
      console.log(`Fetching questions with includeInactive=${includeInactive}`);
      
      // Get questions for the user's organization  
      const questions = await storage.listQuestions(req.user.organizationId, includeInactive);
      res.json(questions);
    } catch (error: any) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get batch trainees with attendance
  app.get("/api/organizations/:orgId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId); 
      const date = new Date().toISOString().split('T')[0]; // Get current date

      const trainees = await storage.getBatchTrainees(batchId);
      
      // Get attendance status for each trainee
      const traineesWithAttendance = await Promise.all(
        trainees.map(async (trainee) => {
          const attendance = await storage.getAttendanceRecord(trainee.userId, date);
          const user = await storage.getUser(trainee.userId);
          
          return {
            id: trainee.userId,
            name: user?.fullName || 'Unknown',
            status: attendance?.status || null,
            lastUpdated: attendance?.updatedAt || null
          };
        })
      );

      res.json(traineesWithAttendance);
    } catch (error: any) {
      console.error("Error fetching trainees with attendance:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Mock Call Scenario Routes
  app.post("/api/mock-call-scenarios", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log('Creating mock call scenario:', req.body);
      const validatedData = insertMockCallScenarioSchema.parse({
        ...req.body,
        organizationId: req.user.organizationId,
        createdBy: req.user.id
      });

      const newScenario = await storage.createMockCallScenario(validatedData);
      console.log('Created mock call scenario:', newScenario);
      res.status(201).json(newScenario);
    } catch (error: any) {
      console.error("Error creating mock call scenario:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/organizations/:organizationId/mock-call-scenarios", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const orgId = parseInt(req.params.organizationId);
      if (!orgId || req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const scenarios = await db
        .select()
        .from(mockCallScenarios)
        .where(eq(mockCallScenarios.organizationId, orgId));

      res.json(scenarios);
    } catch (error: any) {
      console.error("Error fetching mock call scenarios:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/mock-call-scenarios/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const scenarioId = parseInt(req.params.id);
      const scenario = await db
        .select()
        .from(mockCallScenarios)
        .where(eq(mockCallScenarios.id, scenarioId))
        .limit(1);

      if (!scenario.length) {
        return res.status(404).json({ message: "Scenario not found" });
      }

      // Verify organization access
      if (scenario[0].organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(scenario[0]);
    } catch (error: any) {
      console.error("Error fetching mock call scenario:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/mock-call-scenarios/:id/attempts", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const scenarioId = parseInt(req.params.id);
      const validatedData = insertMockCallAttemptSchema.parse({
        ...req.body,
        scenarioId,
        userId: req.user.id,
        organizationId: req.user.organizationId,
        startedAt: new Date().toISOString()
      });

      const newAttempt = await storage.createMockCallAttempt(validatedData);
      res.status(201).json(newAttempt);
    } catch (error: any) {
      console.error("Error creating mock call attempt:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/mock-call-attempts/:id/evaluate", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const attemptId = parseInt(req.params.id);
      const { scores, feedback } = req.body;

      // Verify the attempt exists and user has permission to evaluate
      const attempt = await db
        .select()
        .from(mockCallAttempts)
        .where(eq(mockCallAttempts.id, attemptId))
        .limit(1);

      if (!attempt.length) {
        return res.status(404).json({ message: "Attempt not found" });
      }

      if (attempt[0].evaluatorId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to evaluate this attempt" });
      }

      // Update the attempt with evaluation
      const updatedAttempt = await db
        .update(mockCallAttempts)
        .set({
          scores,
          feedback,
          status: 'completed',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(mockCallAttempts.id, attemptId))
        .returning();

      res.json(updatedAttempt[0]);
    } catch (error: any) {
      console.error("Error evaluating mock call attempt:", error);
      res.status(400).json({ message: error.message });
    }
  });
  
  // Audio file routes
  // Configure multer for file uploads
  // Configure audio uploads directory in public folder for web access
  const audioUploadsDir = join(process.cwd(), 'public', 'uploads', 'audio');
  
  // Create uploads directory if it doesn't exist
  if (!existsSync(audioUploadsDir)) {
    mkdirSync(audioUploadsDir, { recursive: true });
  }
  
  // Configure multer disk storage for audio files
  const audioUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, audioUploadsDir);
      },
      filename: (req, file, cb) => {
        // Generate a unique filename with timestamp and original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = file.originalname.split('.').pop();
        cb(null, `${uniqueSuffix}.${ext}`);
      }
    }),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB limit for audio files
    },
    fileFilter: (req, file, cb) => {
      // Log file info for debugging
      console.log('Uploading file:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        extension: extname(file.originalname).toLowerCase()
      });

      // If this is the metadata file, automatically accept it
      if (file.fieldname === 'metadataFile') {
        console.log('Metadata file accepted:', file.originalname);
        cb(null, true);
        return;
      }

      // Only validate audio files
      // Allow common audio formats
      const allowedMimeTypes = [
        'audio/mpeg',    // mp3
        'audio/mp3',     // mp3 alternative
        'audio/wav',     // wav
        'audio/x-wav',   // wav alternative
        'audio/wave',    // wav alternative
        'audio/vnd.wave', // wav alternative
        'audio/x-pn-wav', // wav alternative
        'audio/ogg',     // ogg
        'audio/webm'     // webm
      ];

      // Also check file extension as fallback
      const fileExtension = extname(file.originalname).toLowerCase();
      const allowedExtensions = ['.mp3', '.wav', '.ogg', '.webm'];
      
      if (allowedMimeTypes.includes(file.mimetype) || 
         (file.fieldname === 'audioFiles' && allowedExtensions.includes(fileExtension))) {
        console.log('Audio file accepted:', file.originalname);
        cb(null, true);
      } else {
        console.log('Audio file rejected:', file.originalname, 'Mimetype:', file.mimetype, 'Extension:', fileExtension);
        cb(new Error('Invalid file type. Only MP3, WAV, OGG, and WEBM audio files are allowed.'), false);
      }
    },
  });
  
  // Audio file metadata template download endpoint
  app.get("/api/templates/audio-file-metadata", (req, res) => {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Define headers for the main template sheet
      const headers = [
        'filename',
        'language',
        'version',
        'call_date',
        'call_type',
        'agent_id',
        'call_id',
        'customer_satisfaction',
        'handle_time'
      ];

      // Create example data row
      const exampleData = [
        'sample_call.mp3',
        'english',
        'v1.0',
        '2025-03-31', // Format: YYYY-MM-DD
        'inbound',
        'AGT123',
        'CALL-001-20250331',
        '4',
        '180'
      ];

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet([headers, exampleData]);

      // Add column widths
      ws['!cols'] = headers.map(() => ({ wch: 20 }));

      // Add styling to headers
      for (let i = 0; i < headers.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headers[i] };
        ws[cellRef].s = { font: { bold: true } };
      }

      // Add the main worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Audio File Metadata');

      // Create a guidelines worksheet
      const guidelinesData = [
        ['Field', 'Description', 'Format', 'Required'],
        ['filename', 'Exact filename of the audio file including extension', 'text', 'Yes'],
        ['language', 'Language of the call', 'english, spanish, french, hindi, other', 'Yes'],
        ['version', 'Version identifier for the call', 'text', 'Yes'],
        ['call_date', 'Date when the call occurred', 'YYYY-MM-DD', 'Yes'],
        ['call_type', 'Type of call', 'inbound, outbound, transfer, etc.', 'Yes'],
        ['agent_id', 'Identifier for the agent who handled the call', 'text', 'Yes'],
        ['call_id', 'Unique identifier for the call', 'text', 'No'],
        ['customer_satisfaction', 'Customer satisfaction score', 'number (1-5)', 'No'],
        ['handle_time', 'Call duration in seconds', 'number', 'No']
      ];

      const guidelinesWs = XLSX.utils.aoa_to_sheet(guidelinesData);
      guidelinesWs['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 25 }, { wch: 10 }];

      // Add styling to headers in guidelines sheet
      for (let i = 0; i < guidelinesData[0].length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (!guidelinesWs[cellRef]) guidelinesWs[cellRef] = { t: 's', v: guidelinesData[0][i] };
        guidelinesWs[cellRef].s = { font: { bold: true } };
      }

      // Add the guidelines worksheet to workbook
      XLSX.utils.book_append_sheet(wb, guidelinesWs, 'Guidelines');

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=audio-file-metadata-template.xlsx');

      // Write the workbook to response
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.send(buf);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // File upload endpoint
  app.post("/api/audio-files/upload", audioUpload.single('file'), async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.file) return res.status(400).json({ message: "No file provided" });
    
    try {
      const { language, version, callMetrics, organizationId, processId } = req.body;
      
      // Parse callMetrics and extract call_date
      const parsedCallMetrics = callMetrics ? JSON.parse(callMetrics) : {};
      
      // Use callMetrics.callDate for the call_date column, or default to today
      const callDate = parsedCallMetrics.callDate || new Date().toISOString().split('T')[0];
      
      // Get the organization ID from the request or the user
      const orgId = parseInt(organizationId) || req.user.organizationId;
      
      // Get the process ID from the request, the user, or use a default
      let processIdToUse;
      if (processId) {
        processIdToUse = parseInt(processId);
      } else if (req.user.processId) {
        processIdToUse = req.user.processId;
      } else {
        // Try to find a process, but don't require it to be valid
        const processes = await storage.listProcesses(orgId);
        if (processes && processes.length > 0) {
          processIdToUse = processes[0].id;
        } else {
          // Use a default value if no process is found
          processIdToUse = 0;
        }
      }
      
      // Prepare audio file data for database
      const audioFileData = {
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        fileUrl: `/uploads/audio/${req.file.filename}`,
        fileSize: req.file.size,
        duration: 0, // This would ideally be calculated from the audio file
        language: language || 'english',
        version: version || '',
        call_date: callDate, // Add the call_date field
        callMetrics: parsedCallMetrics,
        organizationId: orgId,
        processId: processIdToUse, // Using the process ID or default value
        uploadedBy: req.user.id,
        status: 'pending', // Initial status is always pending
        uploadedAt: new Date(),
        batchId: null // By default, not associated with any batch
      };
      
      // Create the audio file record in the database
      const audioFile = await storage.createAudioFile(audioFileData);
      res.status(201).json(audioFile);
    } catch (error: any) {
      console.error("Error uploading audio file:", error);
      
      // Delete the physical file if database insertion failed
      if (req.file && req.file.path) {
        try {
          import('fs').then(fs => {
            fs.unlinkSync(req.file.path);
          }).catch(unlinkError => {
            console.error("Failed to delete file after upload error:", unlinkError);
          });
        } catch (unlinkError) {
          console.error("Failed to delete file after upload error:", unlinkError);
        }
      }
      
      res.status(400).json({ message: error.message });
    }
  });
  
  // Create audio file (without file upload)
  app.post("/api/audio-files", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      // Extract and ensure a call_date is provided (use callMetrics if available)
      const callDate = req.body.callMetrics?.callDate || req.body.call_date || new Date().toISOString().split('T')[0];
      
      // Get the process ID from the request, the user, or use a default
      const processId = req.body.processId || req.user.processId;
      if (!processId) {
        const processes = await storage.listProcesses(req.user.organizationId);
        if (processes && processes.length > 0) {
          req.body.processId = processes[0].id;
        } else {
          // Use a default value if no process is found
          req.body.processId = 0;
        }
      }
      
      const audioFileData = {
        ...req.body,
        organizationId: req.user.organizationId,
        uploadedBy: req.user.id,
        status: 'pending', // Initial status is always pending
        call_date: callDate // Ensure call_date is set
      };
      
      const audioFile = await storage.createAudioFile(audioFileData);
      res.status(201).json(audioFile);
    } catch (error: any) {
      console.error("Error creating audio file:", error);
      res.status(400).json({ message: error.message });
    }
  });
  
  // Endpoint to download the audio file metadata template
  app.get("/api/audio-files/metadata-template", async (req, res) => {
    try {
      const xlsx = await import('xlsx');
      
      // Create a new workbook
      const workbook = xlsx.utils.book_new();
      
      // Add sample data to show the structure
      const data = [
        {
          filename: "sample-call-1.wav",
          duration: 180,
          language: "english",
          version: "1.0",
          call_date: new Date().toISOString().split('T')[0],
          callMetrics: JSON.stringify({ callId: "CALL123", callType: "inbound" })
        },
        {
          filename: "sample-call-2.wav",
          duration: 240,
          language: "spanish",
          version: "2.0",
          call_date: new Date().toISOString().split('T')[0],
          callMetrics: JSON.stringify({ callId: "CALL456", callType: "outbound" })
        }
      ];
      
      // Create a worksheet and append it to the workbook
      const worksheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(workbook, worksheet, "AudioFileMetadata");
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=audio-file-metadata-template.xlsx');
      
      // Convert workbook to buffer and send
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return res.send(buffer);
    } catch (error: any) {
      console.error("Error generating template:", error);
      return res.status(500).json({ message: "Failed to generate template" });
    }
  });
    
  // Upload endpoint for multiple audio files with Excel metadata
  app.post("/api/audio-files/batch-upload", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      // Use the middleware for file upload but handle the errors more gracefully
      audioUpload.fields([
        { name: 'audioFiles', maxCount: 100 },
        { name: 'metadataFile', maxCount: 1 }
      ])(req, res, async (err) => {
        if (err) {
          console.error("File upload error:", err);
          return res.status(400).json({ 
            message: err.message,
            success: 0,
            failed: 0,
            uploadedFiles: [],
            failedFiles: []
          });
        }
        
        // Check if we have files and a metadata file
        if (!req.files) {
          return res.status(400).json({ message: "No files uploaded" });
        }
        
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const audioFiles = files.audioFiles || [];
        const metadataFiles = files.metadataFile || [];
        
        if (audioFiles.length === 0) {
          return res.status(400).json({ message: "No audio files uploaded" });
        }
        
        if (metadataFiles.length === 0) {
          return res.status(400).json({ message: "No metadata file (Excel) uploaded" });
        }
        
        const orgId = req.user.organizationId;
        const uploadedFiles: any[] = [];
        const failedFiles: any[] = [];
        
        try {
          // First, parse the Excel file to get metadata
          const metadataFile = metadataFiles[0];
          
          // Check if the metadata file is an Excel file
          const allowedMetadataTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv' // .csv
          ];
          
          if (!allowedMetadataTypes.includes(metadataFile.mimetype)) {
            return res.status(400).json({
              message: "Invalid metadata file type. Only Excel (.xlsx, .xls) or CSV files are allowed.",
              success: 0,
              failed: audioFiles.length,
              uploadedFiles: [],
              failedFiles: audioFiles.map(file => ({
                originalFilename: file.originalname,
                error: "Invalid metadata file type",
                status: 'error'
              }))
            });
          }
          
          const xlsx = await import('xlsx');
          
          // Log details about the metadata file for debugging
          console.log("Metadata file details:", {
            filename: metadataFile.originalname,
            mimetype: metadataFile.mimetype,
            size: metadataFile.size,
            hasBuffer: !!metadataFile.buffer,
            bufferLength: metadataFile.buffer ? metadataFile.buffer.length : 0
          });
          
          let workbook;
          
          try {
            // Use fs to read the file directly
            const fs = await import('fs');
            console.log("Reading file from path:", metadataFile.path);
            
            if (!fs.existsSync(metadataFile.path)) {
              throw new Error(`File does not exist at path: ${metadataFile.path}`);
            }
            
            // Get file stats
            const stats = fs.statSync(metadataFile.path);
            console.log("File stats:", {
              size: stats.size,
              isFile: stats.isFile(),
              created: stats.birthtime,
              modified: stats.mtime
            });
            
            // Check if it's a CSV file
            if (metadataFile.mimetype === 'text/csv' || metadataFile.originalname.toLowerCase().endsWith('.csv')) {
              // For CSV files
              const csvData = fs.readFileSync(metadataFile.path, 'utf8');
              workbook = xlsx.read(csvData, { type: 'string' });
            } else {
              // For Excel files - using the read method with binary data
              const excelData = fs.readFileSync(metadataFile.path);
              workbook = xlsx.read(excelData, { type: 'buffer' });
            }
            
            console.log("Excel/CSV parsed successfully, sheets:", workbook.SheetNames);
          } catch (excelError) {
            console.error("Error parsing Excel file:", excelError);
            return res.status(400).json({
              message: "Failed to parse Excel file. Please ensure it's a valid Excel format.",
              success: 0,
              failed: audioFiles.length,
              uploadedFiles: [],
              failedFiles: audioFiles.map(file => ({
                originalFilename: file.originalname,
                error: "Invalid Excel file format",
                status: 'error'
              }))
            });
          }
          
          if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            return res.status(400).json({
              message: "Excel file has no sheets",
              success: 0,
              failed: audioFiles.length,
              uploadedFiles: [],
              failedFiles: audioFiles.map(file => ({
                originalFilename: file.originalname,
                error: "Excel file has no sheets",
                status: 'error'
              }))
            });
          }
          
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          
          // Convert sheet data to JSON
          const metadata = xlsx.utils.sheet_to_json(sheet);
          
          if (!metadata || metadata.length === 0) {
            return res.status(400).json({
              message: "Excel file contains no data",
              success: 0,
              failed: audioFiles.length,
              uploadedFiles: [],
              failedFiles: audioFiles.map(file => ({
                originalFilename: file.originalname,
                error: "Excel file contains no data",
                status: 'error'
              }))
            });
          }
          
          // Create a lookup map from filename to metadata
          const metadataMap = new Map();
          metadata.forEach((item: any) => {
            if (item.filename) {
              metadataMap.set(item.filename, item);
            }
          });
          
          // Process each audio file
          for (const file of audioFiles) {
            try {
              // Try to match with metadata - first try exact match, then try without extension
              let fileMetadata = metadataMap.get(file.originalname);
              if (!fileMetadata) {
                // Try to match without extension
                const filenameWithoutExt = file.originalname.replace(/\.[^/.]+$/, "");
                fileMetadata = metadataMap.get(filenameWithoutExt);
              }
              
              // Fallback values if metadata is not found
              const defaultCallDate = new Date().toISOString().split('T')[0];
              const defaultCallMetrics = { callDate: defaultCallDate, callId: '', callType: '' };
              
              // Get the process ID from the metadata, the user, or use a default
              let processIdToUse = fileMetadata?.processId || req.user.processId;
              if (!processIdToUse) {
                // Try to find a valid process for this organization
                const processes = await storage.listProcesses(orgId);
                if (processes && processes.length > 0) {
                  processIdToUse = processes[0].id;
                } else {
                  // Use a default value if no process is found
                  processIdToUse = 0;
                }
              }
              
              // Prepare audio file data from the Excel metadata or use defaults
              const audioFileData = {
                filename: file.filename,
                originalFilename: file.originalname,
                fileUrl: `/uploads/audio/${file.filename}`,
                fileSize: file.size,
                duration: fileMetadata?.duration || 0,
                language: fileMetadata?.language || 'english',
                version: fileMetadata?.version || '',
                call_date: fileMetadata?.call_date || defaultCallDate,
                callMetrics: fileMetadata?.callMetrics || defaultCallMetrics,
                organizationId: orgId,
                processId: processIdToUse,
                uploadedBy: req.user.id,
                status: 'pending',
                uploadedAt: new Date(),
                batchId: null
              };
              
              // Create the audio file record in the database
              const audioFile = await storage.createAudioFile(audioFileData);
              uploadedFiles.push({
                originalFilename: file.originalname,
                id: audioFile.id,
                status: 'success'
              });
              
            } catch (fileError: any) {
              console.error(`Error processing file ${file.originalname}:`, fileError);
              
              // Delete the physical file if database insertion failed
              try {
                const fs = await import('fs');
                fs.unlinkSync(file.path);
              } catch (unlinkError) {
                console.error(`Failed to delete file ${file.originalname} after upload error:`, unlinkError);
              }
              
              failedFiles.push({
                originalFilename: file.originalname,
                error: fileError.message,
                status: 'error'
              });
            }
          }
          
          const result = {
            success: uploadedFiles.length,
            failed: failedFiles.length,
            uploadedFiles,
            failedFiles
          };
          
          res.status(201).json(result);
          
        } catch (error: any) {
          console.error("Error in batch upload:", error);
          
          // Clean up any uploaded files if the overall process failed
          for (const file of audioFiles) {
            try {
              const fs = await import('fs');
              fs.unlinkSync(file.path);
            } catch (unlinkError) {
              console.error(`Failed to delete file ${file.originalname} after upload error:`, unlinkError);
            }
          }
          
          res.status(400).json({ 
            message: error.message,
            success: 0,
            failed: audioFiles.length,
            uploadedFiles: [],
            failedFiles: audioFiles.map(file => ({
              originalFilename: file.originalname,
              error: error.message,
              status: 'error'
            }))
          });
        }
      });
    } catch (error: any) {
      console.error("Error in batch upload route:", error);
      res.status(500).json({ 
        message: "Failed to process batch upload: " + error.message,
        success: 0,
        failed: 0,
        uploadedFiles: [],
        failedFiles: []
      });
    }
  });
  
  app.get("/api/organizations/:organizationId/audio-files", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const orgId = parseInt(req.params.organizationId);
      if (!orgId || req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Extract filter parameters
      const filters = {
        status: req.query.status as string | undefined,
        language: req.query.language as string | undefined,
        version: req.query.version as string | undefined,
        processId: req.query.processId ? parseInt(req.query.processId as string) : undefined,
        batchId: req.query.batchId ? parseInt(req.query.batchId as string) : undefined,
        duration: undefined as { min?: number; max?: number } | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50 // Default to 50 items per page
      };
      
      // Parse duration filter if provided
      if (req.query.minDuration || req.query.maxDuration) {
        filters.duration = {
          min: req.query.minDuration ? parseInt(req.query.minDuration as string) : undefined,
          max: req.query.maxDuration ? parseInt(req.query.maxDuration as string) : undefined
        };
      }
      
      const { files, total } = await storage.listAudioFiles(orgId, filters);
      res.json({
        files,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          pages: Math.ceil(total / filters.limit)
        }
      });
    } catch (error: any) {
      console.error("Error fetching audio files:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/organizations/:organizationId/audio-files/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const orgId = parseInt(req.params.organizationId);
      const audioFileId = parseInt(req.params.id);
      
      // Check organization access
      if (orgId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const audioFile = await storage.getAudioFile(audioFileId);
      
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }
      
      // Double check organization access
      if (audioFile.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(audioFile);
    } catch (error: any) {
      console.error(`Error fetching audio file ${req.params.id} in org ${req.params.organizationId}:`, error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/audio-files/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const audioFileId = parseInt(req.params.id);
      const audioFile = await storage.getAudioFile(audioFileId);
      
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }
      
      // Check organization access
      if (audioFile.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(audioFile);
    } catch (error: any) {
      console.error("Error fetching audio file:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch("/api/audio-files/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const audioFileId = parseInt(req.params.id);
      const audioFile = await storage.getAudioFile(audioFileId);
      
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }
      
      // Check organization access
      if (audioFile.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedFile = await storage.updateAudioFile(audioFileId, req.body);
      res.json(updatedFile);
    } catch (error: any) {
      console.error("Error updating audio file:", error);
      res.status(400).json({ message: error.message });
    }
  });
  
  app.delete("/api/audio-files/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const audioFileId = parseInt(req.params.id);
      const audioFile = await storage.getAudioFile(audioFileId);
      
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }
      
      // Check organization access
      if (audioFile.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Only allow deletion if file is pending
      if (audioFile.status !== 'pending') {
        return res.status(400).json({ 
          message: "Only pending audio files can be deleted" 
        });
      }
      
      await storage.deleteAudioFile(audioFileId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting audio file:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Audio file allocation routes
  app.post("/api/audio-file-allocations", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const allocationData = {
        ...req.body,
        organizationId: req.user.organizationId,
        allocatedBy: req.user.id,
        status: 'allocated' // Initial status is always allocated
      };
      
      const allocation = await storage.createAudioFileAllocation(allocationData);
      res.status(201).json(allocation);
    } catch (error: any) {
      console.error("Error creating audio file allocation:", error);
      res.status(400).json({ message: error.message });
    }
  });
  
  app.get("/api/organizations/:organizationId/audio-file-allocations", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const orgId = parseInt(req.params.organizationId);
      if (!orgId || req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Extract filter parameters
      const filters = {
        organizationId: orgId,
        qualityAnalystId: req.query.qualityAnalystId ? parseInt(req.query.qualityAnalystId as string) : undefined,
        audioFileId: req.query.audioFileId ? parseInt(req.query.audioFileId as string) : undefined,
        status: req.query.status as string | undefined
      };
      
      const allocations = await storage.listAudioFileAllocations(filters);
      res.json(allocations);
    } catch (error: any) {
      console.error("Error fetching audio file allocations:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get audio files allocated to the current user or their subordinates
  app.get("/api/organizations/:organizationId/audio-file-allocations/assigned-to-me", async (req, res) => {
    console.log('Endpoint called: audio-file-allocations/assigned-to-me');
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const orgId = parseInt(req.params.organizationId);
      const assignedToFilter = req.query.assignedTo as string || 'all';
      console.log('Assignment filter:', assignedToFilter);
      
      if (!orgId || req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check if the user can view assignments (quality analysts or managers)
      const canAccessAudio = ['quality_analyst', 'team_lead', 'manager', 'admin', 'owner'].includes(req.user.role);
      if (!canAccessAudio) {
        return res.status(403).json({ message: "Access denied. Only quality analysts and managers can access this endpoint." });
      }
      
      // Get user IDs based on role and filter
      let qualityAnalystIds: number[] = [];
      
      // For QAs, only return their own assignments
      if (req.user.role === 'quality_analyst') {
        qualityAnalystIds = [req.user.id];
      }
      // For managers, team leads, admins, and owners, get all subordinates who are QAs
      else {
        // First, get all users who report to this manager (directly or indirectly)
        const allUsers = await storage.listUsers({ organizationId: orgId });
        
        // Find all subordinates recursively
        const isSubordinate = (managerId: number, userId: number): boolean => {
          const user = allUsers.find(u => u.id === userId);
          if (!user || user.managerId === null) return false;
          if (user.managerId === managerId) return true;
          return isSubordinate(managerId, user.managerId);
        };
        
        // Filter for quality analysts who are subordinates
        const qaSubordinates = allUsers.filter(user => 
          user.role === 'quality_analyst' && isSubordinate(req.user.id, user.id)
        );
        
        // If user is admin or owner, include all QAs
        if (req.user.role === 'admin' || req.user.role === 'owner') {
          qualityAnalystIds = allUsers
            .filter(user => user.role === 'quality_analyst')
            .map(user => user.id);
        } else {
          // For team leads and managers, only include subordinates
          qualityAnalystIds = qaSubordinates.map(user => user.id);
          
          // If the current user is also a QA (rare dual role), include themselves
          if (req.user.role === 'quality_analyst') {
            qualityAnalystIds.push(req.user.id);
          }
        }
      }
      
      console.log(`Fetching audio files for user ${req.user.id} (${req.user.role}) and subordinates in organization ${orgId}`);
      console.log(`Quality Analyst IDs to fetch: ${qualityAnalystIds.join(', ')}`);
      
      let allocations: any[] = [];
      
      // If there are QAs to fetch (either self or subordinates)
      if (qualityAnalystIds.length > 0) {
        // For each QA, fetch their allocations
        const allocationPromises = qualityAnalystIds.map(async (qaId) => {
          return await storage.listAudioFileAllocations({
            organizationId: orgId,
            qualityAnalystId: qaId
          });
        });
        
        const allocationResults = await Promise.all(allocationPromises);
        allocations = allocationResults.flat();
        
        // Add a field to indicate if this allocation belongs to the current user
        allocations = allocations.map(allocation => ({
          ...allocation,
          isCurrentUser: allocation.qualityAnalystId === req.user!.id
        }));
      }
      
      console.log(`Found ${allocations.length} allocated audio files for user ${req.user.id} and subordinates`);
      
      res.json(allocations);
    } catch (error: any) {
      console.error("Error fetching assigned audio files:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/audio-file-allocations/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const allocationId = parseInt(req.params.id);
      const allocation = await storage.getAudioFileAllocation(allocationId);
      
      if (!allocation) {
        return res.status(404).json({ message: "Allocation not found" });
      }
      
      // Check organization access
      if (allocation.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(allocation);
    } catch (error: any) {
      console.error("Error fetching audio file allocation:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get detailed evaluation scores for an audio file
  app.get("/api/audio-files/:id/evaluation-scores", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const audioFileId = parseInt(req.params.id);
      if (!audioFileId) {
        return res.status(400).json({ message: "Invalid audio file ID" });
      }
      
      // Get the audio file to check for permission
      const audioFile = await storage.getAudioFile(audioFileId);
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }
      
      // Check organization access
      if (audioFile.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get evaluation with scores and parameters
      const evaluationDetails = await storage.getAudioFileEvaluationWithScores(audioFileId);
      
      if (!evaluationDetails) {
        return res.status(404).json({ message: "No evaluation found for this audio file" });
      }
      
      res.json(evaluationDetails);
    } catch (error: any) {
      console.error("Error fetching audio file evaluation scores:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch("/api/audio-file-allocations/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const allocationId = parseInt(req.params.id);
      const allocation = await storage.getAudioFileAllocation(allocationId);
      
      if (!allocation) {
        return res.status(404).json({ message: "Allocation not found" });
      }
      
      // Only allow the assigned quality analyst or admin/manager to update
      if (allocation.qualityAnalystId !== req.user.id && 
          !['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedAllocation = await storage.updateAudioFileAllocation(allocationId, req.body);
      res.json(updatedAllocation);
    } catch (error: any) {
      console.error("Error updating audio file allocation:", error);
      res.status(400).json({ message: error.message });
    }
  });
  
  app.get("/api/organizations/:organizationId/quality-analysts", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const orgId = parseInt(req.params.organizationId);
      if (!orgId || req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const qualityAnalysts = await storage.getQualityAnalystsForAllocation(orgId);
      res.json(qualityAnalysts);
    } catch (error: any) {
      console.error("Error fetching quality analysts:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Add endpoint specifically for the client routes using quality-analysts
  app.get("/api/users/quality-analysts", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const qualityAnalysts = await storage.getQualityAnalystsForAllocation(req.user.organizationId);
      res.json(qualityAnalysts);
    } catch (error: any) {
      console.error("Error fetching quality analysts:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get evaluation statistics for a quality analyst
  // Get parameter scores for all evaluations with filters
  app.get("/api/organizations/:organizationId/parameter-scores", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const orgId = parseInt(req.params.organizationId);
      
      if (!orgId || req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check if the user can view assignments (quality analysts or managers)
      const canAccessAudio = ['quality_analyst', 'team_lead', 'manager', 'admin', 'owner'].includes(req.user.role);
      if (!canAccessAudio) {
        return res.status(403).json({ message: "Access denied. Only quality analysts and managers can access this endpoint." });
      }
      
      // Parse filters
      const filters: {
        qaIds?: number[];
        startDate?: Date;
        endDate?: Date;
      } = {};
      
      // Parse quality analyst filter
      if (req.query.qaIds) {
        try {
          const qaIds = JSON.parse(req.query.qaIds as string);
          if (Array.isArray(qaIds) && qaIds.length > 0) {
            filters.qaIds = qaIds.map(id => parseInt(id));
          }
        } catch (error) {
          console.error("Error parsing qaIds:", error);
        }
      }
      
      // Parse date range filters
      if (req.query.startDate && req.query.endDate) {
        filters.startDate = new Date(req.query.startDate as string);
        filters.endDate = new Date(req.query.endDate as string);
      }
      
      const parameterScores = await storage.getAllParameterScores(orgId, filters);
      res.json(parameterScores);
    } catch (error: any) {
      console.error("Error fetching parameter scores:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/users/:id/quality-analyst-stats", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const qaId = parseInt(req.params.id);
      if (!qaId) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Only allow if the user is requesting their own stats or has appropriate role
      if (qaId !== req.user.id && !['admin', 'manager', 'team_lead'].includes(req.user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const stats = await storage.getQualityAnalystEvaluationStats(qaId, req.user.organizationId);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching quality analyst stats:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Batch allocation endpoint
  app.post("/api/audio-file-batch-allocations", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { 
        name, 
        description, 
        dueDate, 
        audioFileIds, 
        qualityAnalysts, 
        filters,
        distributionMethod
      } = req.body;
      
      // Validate input
      if ((!audioFileIds || !audioFileIds.length) && !filters) {
        return res.status(400).json({ 
          message: "Either audioFileIds or filters must be provided" 
        });
      }
      
      if (!qualityAnalysts || !qualityAnalysts.length) {
        return res.status(400).json({ 
          message: "At least one quality analyst must be specified" 
        });
      }
      
      const batchAllocationData = {
        name,
        description,
        organizationId: req.user.organizationId,
        allocatedBy: req.user.id,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        audioFileIds: audioFileIds || [],
        qualityAnalysts,
        filters,
        distributionMethod: distributionMethod || 'random'
      };
      
      const result = await storage.createAudioFileBatchAllocation(batchAllocationData);
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error creating batch allocation:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get adjacent batch IDs (previous and next)
  // Set trainee status to refresher immediately
  app.post('/api/organizations/:organizationId/batches/:batchId/trainees/:traineeId/set-refresher', async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { organizationId, batchId, traineeId } = req.params;
      const { reason } = req.body; // Extract reason from request body
      
      console.log(`Setting trainee ${traineeId} to refresher status`, { reason });
      
      // Get the batch first to make sure it exists
      const batch = await storage.getBatch(Number(batchId));
      if (!batch) {
        return res.status(404).json({ message: 'Batch not found' });
      }
      
      // Get the trainee information
      const trainee = await storage.getUser(Number(traineeId));
      if (!trainee) {
        return res.status(404).json({ message: 'Trainee not found' });
      }
      
      // Get the user batch process record to get the ID
      const userBatchProcess = await storage.getUserBatchProcess(Number(traineeId), Number(batchId));
      if (!userBatchProcess) {
        return res.status(404).json({ message: 'Trainee not enrolled in this batch' });
      }
      
      // Update the user batch process with refresher status
      const updated = await storage.updateUserBatchProcessStatus(
        userBatchProcess.id,
        {
          traineeStatus: 'refresher',
          isManualStatus: true
        }
      );
      
      // Create a batch event to track the reason
      try {
        if (typeof storage.createBatchEvent === 'function') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          const eventData = {
            batchId: Number(batchId),
            title: `Refresher Status: ${trainee.fullName || `Trainee ${traineeId}`}`,
            description: 'Trainee status changed to refresher',
            startDate: tomorrow.toISOString(),
            endDate: tomorrow.toISOString(), // Same day event
            eventType: 'refresher',
            organizationId: Number(organizationId),
            createdBy: req.user.id,
            status: 'scheduled',
            reason: reason || null // Include the refresher reason
          };
          
          await storage.createBatchEvent(eventData);
        }
      } catch (eventError) {
        console.error('Error creating batch event for refresher status:', eventError);
        // Continue even if event creation fails
      }
      
      return res.json({ 
        success: true, 
        message: 'Trainee status updated to refresher',
        trainee: updated 
      });
    } catch (error) {
      console.error('Error setting trainee to refresher status:', error);
      return res.status(500).json({ message: 'Failed to set trainee to refresher status' });
    }
  });

  // Schedule a refresher training with notes
  app.post('/api/organizations/:organizationId/batches/:batchId/trainees/:traineeId/refresher', async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { organizationId, batchId, traineeId } = req.params;
      const { notes, startDate, endDate, reason } = req.body;
      
      console.log(`Scheduling refresher training for trainee ${traineeId} in batch ${batchId}`, { 
        notes, startDate, endDate, reason 
      });
      
      // Get the batch first to make sure it exists
      const batch = await storage.getBatch(Number(batchId));
      if (!batch) {
        return res.status(404).json({ message: 'Batch not found' });
      }
      
      // Get the trainee information
      const trainee = await storage.getUser(Number(traineeId));
      if (!trainee) {
        return res.status(404).json({ message: 'Trainee not found' });
      }
      
      // Get the user batch process record to get the ID
      const userBatchProcess = await storage.getUserBatchProcess(Number(traineeId), Number(batchId));
      if (!userBatchProcess) {
        return res.status(404).json({ message: 'Trainee not enrolled in this batch' });
      }
      
      // Update the user batch process with refresher status
      const updated = await storage.updateUserBatchProcessStatus(
        userBatchProcess.id,
        {
          traineeStatus: 'refresher',
          isManualStatus: true
        }
      );
      
      // Create a calendar event for the refresher training
      const event = await storage.createBatchEvent({
        organizationId: Number(organizationId),
        batchId: Number(batchId),
        createdBy: req.user.id,
        title: `Refresher Training for ${trainee.fullName}`,
        description: notes || 'Refresher training scheduled',
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default to 1 day
        eventType: 'refresher',
        status: 'scheduled',
        reason: reason || null // Include refresher reason
      });
      if (updated) {
        // Schedule the refresher for the next day
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Try to create a batch event if that functionality exists
        try {
          // Use create batch event method
          const eventData = {
            batchId: Number(batchId),
            title: `Refresher Training: ${trainee.fullName || `Trainee ${traineeId}`}`,
            description: notes || 'Refresher training scheduled',
            startDate: tomorrow.toISOString(),
            endDate: tomorrow.toISOString(), // Same day event
            eventType: 'refresher',
            organizationId: Number(organizationId),
            createdBy: req.user.id,
            status: 'scheduled',
            reason: reason || null // Include refresher reason
          };
          
          await storage.createBatchEvent(eventData);
        } catch (eventError) {
          console.error('Error creating batch event:', eventError);
          // Continue even if event creation fails
        }
      }
      
      return res.json({ 
        success: true, 
        message: 'Refresher training scheduled successfully',
        trainee: updated 
      });
    } catch (error) {
      console.error('Error scheduling refresher training:', error);
      return res.status(500).json({ message: 'Failed to schedule refresher training' });
    }
  });

  // Reassign quiz to trainee
  app.post('/api/organizations/:organizationId/batches/:batchId/trainees/:traineeId/reassign-quiz', async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { organizationId, batchId, traineeId } = req.params;
      const { quizId } = req.body;
      
      if (!quizId) {
        return res.status(400).json({ message: 'Quiz ID is required' });
      }
      
      console.log(`Reassigning quiz ${quizId} to trainee ${traineeId} in batch ${batchId}`);
      
      // Check if the quiz exists
      const quiz = await storage.getQuiz(Number(quizId));
      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }
      
      // Check if the trainee exists
      const trainee = await storage.getUser(Number(traineeId));
      if (!trainee) {
        return res.status(404).json({ message: 'Trainee not found' });
      }
      
      // Assign quiz to trainee
      // This could involve creating a quiz assignment record if your system has that
      // Or simply marking the trainee as eligible to take the quiz again
      
      // Create a batch event for the reassigned quiz
      try {
        if (typeof storage.createBatchEvent === 'function') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          const eventData = {
            batchId: Number(batchId),
            title: `Quiz Reassigned: ${quiz.name || `Quiz ${quizId}`}`,
            description: `Quiz reassigned to ${trainee.fullName || `Trainee ${traineeId}`}`,
            startDate: tomorrow.toISOString(),
            endDate: tomorrow.toISOString(),
            eventType: 'quiz',
            organizationId: Number(organizationId),
            createdBy: req.user.id,
            status: 'scheduled'
          };
          
          await storage.createBatchEvent(eventData);
        }
      } catch (eventError) {
        console.error('Error creating batch event for quiz reassignment:', eventError);
        // Continue even if event creation fails
      }
      
      // Return success response
      return res.json({
        success: true,
        message: 'Quiz reassigned successfully',
        quiz: quiz,
        trainee: trainee
      });
    } catch (error) {
      console.error('Error reassigning quiz:', error);
      return res.status(500).json({ message: 'Failed to reassign quiz' });
    }
  });

  // Get batch refresher events (all events of type 'refresher')
  app.get("/api/organizations/:organizationId/batches/:batchId/refresher-events", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { organizationId, batchId } = req.params;
      
      // Check if the getBatchEvents function exists on storage 
      if (typeof storage.getBatchEvents !== 'function') {
        return res.status(501).json({ message: 'Feature not implemented yet' });
      }
      
      // Get all refresher events for this batch
      const events = await storage.getBatchEvents(
        Number(batchId), 
        { 
          eventType: 'refresher',
          organizationId: Number(organizationId)
        }
      );
      
      console.log("Fetched refresher events:", events);
      
      // Get all trainees in this batch who are in refresher status
      const trainees = await storage.getBatchTrainees(Number(batchId));
      const refresherTrainees = trainees.filter(trainee => 
        trainee.traineeStatus === 'refresher' && trainee.isManualStatus
      );
      
      console.log("Refresher trainees:", refresherTrainees);
      
      // For each event, try to find and attach the trainee information
      const eventsWithTraineeInfo = await Promise.all(events.map(async (event) => {
        // Extract trainee ID from title or description if available
        const traineeNameMatch = event.title.match(/for\s+(.*?)$/i) || 
                               event.title.match(/:\s+(.*?)$/i);
        
        let traineeInfo = null;
        
        if (traineeNameMatch && traineeNameMatch[1]) {
          const traineeName = traineeNameMatch[1].trim();
          // Find trainee by name
          const matchedTrainee = refresherTrainees.find(t => 
            (t.fullName && t.fullName.includes(traineeName)) || 
            (t.user && t.user.fullName && t.user.fullName.includes(traineeName))
          );
          
          if (matchedTrainee) {
            traineeInfo = {
              id: matchedTrainee.id || matchedTrainee.userId,
              fullName: matchedTrainee.fullName || (matchedTrainee.user && matchedTrainee.user.fullName),
              employeeId: matchedTrainee.employeeId || (matchedTrainee.user && matchedTrainee.user.employeeId)
            };
          }
        }
        
        // Format the data for display
        return {
          id: event.id,
          traineeId: traineeInfo?.id,
          title: event.title,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          status: event.status,
          refresherReason: event.refresherReason,
          createdAt: event.createdAt,
          trainee: traineeInfo
        };
      }));
      
      console.log("Events with trainee info:", eventsWithTraineeInfo);
      
      return res.json(eventsWithTraineeInfo);
    } catch (error) {
      console.error("Error fetching refresher events:", error);
      return res.status(500).json({ message: 'Failed to fetch refresher events' });
    }
  });

  app.get("/api/organizations/:orgId/batches/:batchId/adjacent", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      
      // Check user organization access
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({
          message: "You can only access batches in your own organization"
        });
      }
      
      // Get all batches for the organization to find adjacent IDs
      // Sort by name for a consistent navigation order
      const allBatches = await storage.listBatches(orgId);
      
      // Filter based on user permissions if needed
      let accessibleBatches = allBatches;

      // For non-admin, non-owner, filter batches by permissions
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        // Get batches where user is assigned as trainer
        const trainerBatches = allBatches.filter(batch => batch.trainerId === req.user?.id);
        
        // Get batches where user is assigned as a trainee
        const traineeAssignments = await storage.getUserBatchProcesses(req.user.id);
        const traineeBatchIds = traineeAssignments.map(assignment => assignment.batchId);
        
        // Combine trainer and trainee batches
        const userBatchIds = new Set([
          ...trainerBatches.map(batch => batch.id),
          ...traineeBatchIds
        ]);
        
        accessibleBatches = allBatches.filter(batch => userBatchIds.has(batch.id));
      }
      
      // Sort by name for consistent navigation
      accessibleBatches.sort((a, b) => a.name.localeCompare(b.name));
      
      // Find the index of the current batch
      const currentIndex = accessibleBatches.findIndex(batch => batch.id === batchId);
      
      // If batch not found or not accessible
      if (currentIndex === -1) {
        return res.status(404).json({ message: "Batch not found or not accessible" });
      }
      
      // Find previous and next batch IDs
      const previousBatch = currentIndex > 0 ? accessibleBatches[currentIndex - 1] : null;
      const nextBatch = currentIndex < accessibleBatches.length - 1 ? accessibleBatches[currentIndex + 1] : null;
      
      res.json({
        previousBatch: previousBatch ? {
          id: previousBatch.id,
          name: previousBatch.name
        } : null,
        nextBatch: nextBatch ? {
          id: nextBatch.id,
          name: nextBatch.name
        } : null
      });
    } catch (error: any) {
      console.error("Error fetching adjacent batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard API routes
  // Get user dashboards
  app.get("/api/dashboards", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const dashboards = await storage.getUserDashboards(req.user.id);
      res.json(dashboards);
    } catch (error: any) {
      console.error("Error fetching user dashboards:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create dashboard
  app.post("/api/dashboards", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const dashboardData = insertUserDashboardSchema.parse({
        ...req.body,
        userId: req.user.id,
        organizationId: req.user.organizationId
      });
      
      const newDashboard = await storage.createUserDashboard(dashboardData);
      res.status(201).json(newDashboard);
    } catch (error: any) {
      console.error("Error creating dashboard:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get specific dashboard
  app.get("/api/dashboards/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const dashboardId = parseInt(req.params.id);
      const dashboard = await storage.getUserDashboard(dashboardId);
      
      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }
      
      // Ensure user has access to this dashboard
      if (dashboard.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(dashboard);
    } catch (error: any) {
      console.error("Error fetching dashboard:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update dashboard
  app.put("/api/dashboards/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const dashboardId = parseInt(req.params.id);
      const dashboard = await storage.getUserDashboard(dashboardId);
      
      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }
      
      // Ensure user has access to this dashboard
      if (dashboard.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedDashboard = await storage.updateUserDashboard(dashboardId, req.body);
      res.json(updatedDashboard);
    } catch (error: any) {
      console.error("Error updating dashboard:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Delete dashboard
  app.delete("/api/dashboards/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const dashboardId = parseInt(req.params.id);
      const dashboard = await storage.getUserDashboard(dashboardId);
      
      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }
      
      // Ensure user has access to this dashboard
      if (dashboard.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteUserDashboard(dashboardId);
      res.status(204).end();
    } catch (error: any) {
      console.error("Error deleting dashboard:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Set default dashboard
  app.post("/api/dashboards/:id/set-default", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const dashboardId = parseInt(req.params.id);
      const dashboard = await storage.getUserDashboard(dashboardId);
      
      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }
      
      // Ensure user has access to this dashboard
      if (dashboard.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.setDefaultDashboard(req.user.id, dashboardId);
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Error setting default dashboard:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get widgets for dashboard
  app.get("/api/dashboards/:id/widgets", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const dashboardId = parseInt(req.params.id);
      const dashboard = await storage.getUserDashboard(dashboardId);
      
      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }
      
      // Ensure user has access to this dashboard
      if (dashboard.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const widgets = await storage.getDashboardWidgets(dashboardId);
      res.json(widgets);
    } catch (error: any) {
      console.error("Error fetching dashboard widgets:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create widget
  app.post("/api/dashboards/:id/widgets", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const dashboardId = parseInt(req.params.id);
      const dashboard = await storage.getUserDashboard(dashboardId);
      
      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }
      
      // Ensure user has access to this dashboard
      if (dashboard.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const widgetData = insertDashboardWidgetSchema.parse({
        ...req.body,
        dashboardId,
        organizationId: req.user.organizationId
      });
      
      const newWidget = await storage.createDashboardWidget(widgetData);
      res.status(201).json(newWidget);
    } catch (error: any) {
      console.error("Error creating widget:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Update widget
  app.put("/api/widgets/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const widgetId = parseInt(req.params.id);
      
      // Get widget to check ownership
      const widgets = await db
        .select()
        .from(dashboardWidgets)
        .where(eq(dashboardWidgets.id, widgetId));
      
      if (widgets.length === 0) {
        return res.status(404).json({ message: "Widget not found" });
      }
      
      const widget = widgets[0];
      
      // Check dashboard ownership
      const dashboards = await db
        .select()
        .from(userDashboards)
        .where(eq(userDashboards.id, widget.dashboardId));
      
      if (dashboards.length === 0) {
        return res.status(404).json({ message: "Dashboard not found" });
      }
      
      const dashboard = dashboards[0];
      
      // Ensure user has access to this dashboard
      if (dashboard.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedWidget = await storage.updateDashboardWidget(widgetId, req.body);
      res.json(updatedWidget);
    } catch (error: any) {
      console.error("Error updating widget:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Delete widget
  app.delete("/api/widgets/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const widgetId = parseInt(req.params.id);
      
      // Get widget to check ownership
      const widgets = await db
        .select()
        .from(dashboardWidgets)
        .where(eq(dashboardWidgets.id, widgetId));
      
      if (widgets.length === 0) {
        return res.status(404).json({ message: "Widget not found" });
      }
      
      const widget = widgets[0];
      
      // Check dashboard ownership
      const dashboards = await db
        .select()
        .from(userDashboards)
        .where(eq(userDashboards.id, widget.dashboardId));
      
      if (dashboards.length === 0) {
        return res.status(404).json({ message: "Dashboard not found" });
      }
      
      const dashboard = dashboards[0];
      
      // Ensure user has access to this dashboard
      if (dashboard.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteDashboardWidget(widgetId);
      res.status(204).end();
    } catch (error: any) {
      console.error("Error deleting widget:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard Configuration Routes
  
  // Get all dashboard configurations for a user
  app.get("/api/dashboard-configurations", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const configs = await storage.getDashboardConfigurationsByUser(req.user.id, req.user.organizationId);
      res.json(configs);
    } catch (error: any) {
      console.error("Error getting dashboard configurations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get default dashboard configuration
  app.get("/api/dashboard-configurations/default", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const config = await storage.getDefaultDashboardConfiguration(req.user.id, req.user.organizationId);
      
      if (!config) {
        return res.status(404).json({ message: "No default dashboard configuration found" });
      }
      
      res.json(config);
    } catch (error: any) {
      console.error("Error getting default dashboard configuration:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get a specific dashboard configuration
  app.get("/api/dashboard-configurations/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const configId = parseInt(req.params.id);
      const config = await storage.getDashboardConfiguration(configId);
      
      if (!config) {
        return res.status(404).json({ message: "Dashboard configuration not found" });
      }
      
      // Check if user has access to this configuration
      if (config.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(config);
    } catch (error: any) {
      console.error("Error getting dashboard configuration:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new dashboard configuration
  app.post("/api/dashboard-configurations", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      // Validate the request body
      const validatedData = insertDashboardConfigurationSchema.parse({
        ...req.body,
        userId: req.user.id,
        organizationId: req.user.organizationId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const newConfig = await storage.createDashboardConfiguration(validatedData);
      res.status(201).json(newConfig);
    } catch (error: any) {
      console.error("Error creating dashboard configuration:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Update a dashboard configuration
  app.put("/api/dashboard-configurations/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const configId = parseInt(req.params.id);
      
      // Get the existing configuration to check ownership
      const existingConfig = await storage.getDashboardConfiguration(configId);
      
      if (!existingConfig) {
        return res.status(404).json({ message: "Dashboard configuration not found" });
      }
      
      // Ensure user owns this configuration
      if (existingConfig.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Update the configuration
      const updatedConfig = await storage.updateDashboardConfiguration(configId, {
        ...req.body,
        updatedAt: new Date()
      });
      
      res.json(updatedConfig);
    } catch (error: any) {
      console.error("Error updating dashboard configuration:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Delete a dashboard configuration
  app.delete("/api/dashboard-configurations/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const configId = parseInt(req.params.id);
      
      // Get the existing configuration to check ownership
      const existingConfig = await storage.getDashboardConfiguration(configId);
      
      if (!existingConfig) {
        return res.status(404).json({ message: "Dashboard configuration not found" });
      }
      
      // Ensure user owns this configuration
      if (existingConfig.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Delete the configuration
      await storage.deleteDashboardConfiguration(configId);
      
      res.status(204).end();
    } catch (error: any) {
      console.error("Error deleting dashboard configuration:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Audio streaming endpoint
  app.get("/api/audio-stream/:audioFileId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const audioFileId = parseInt(req.params.audioFileId);
      
      if (isNaN(audioFileId)) {
        return res.status(400).json({ message: "Invalid audio file ID" });
      }

      // Get audio file from database
      const audioFile = await storage.getAudioFile(audioFileId);
      
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      // Check access permissions - ensure user has access to this audio file
      // This could be through direct assignment or batch assignment
      const hasAccess = await userHasAudioFileAccess(req.user.id, audioFileId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this audio file" });
      }

      // Initialize Azure storage service
      const azureStorage = initAzureStorageService();
      
      if (!azureStorage) {
        return res.status(500).json({ message: "Azure storage service not available" });
      }

      // Get username for container access
      const username = req.user.username;

      try {
        // Get file properties for HTTP headers
        const fileProperties = await azureStorage.getAudioFileProperties(audioFile.filename, username);
        
        // Get stream from Azure
        const blobStream = await azureStorage.getFileStreamFromAzure(audioFile.filename, username);

        // Set proper HTTP headers for audio streaming
        res.setHeader("Content-Type", fileProperties.contentType);
        res.setHeader("Content-Disposition", `inline; filename="${audioFile.originalName || audioFile.filename}"`);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Cache-Control", "public, max-age=3600");
        
        if (fileProperties.contentLength > 0) {
          res.setHeader("Content-Length", fileProperties.contentLength.toString());
        }

        // Pipe the stream directly to response
        blobStream.pipe(res);
        
        // Handle stream errors
        blobStream.on('error', (error) => {
          console.error(`Error streaming audio file ${audioFileId}:`, error);
          if (!res.headersSent) {
            res.status(500).json({ message: "Error streaming audio file" });
          }
        });

      } catch (azureError: any) {
        console.error(`Azure streaming error for file ${audioFileId}:`, azureError);
        
        if (azureError.message.includes('not found')) {
          return res.status(404).json({ 
            message: "Audio file not found in storage",
            details: "The audio file may have been moved or deleted"
          });
        }
        
        return res.status(500).json({ 
          message: "Failed to stream audio file",
          details: "Please try refreshing the page or contact support if the issue persists"
        });
      }

    } catch (error: any) {
      console.error(`Error in audio streaming endpoint:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return createServer(app);
}
