import { eq, inArray, sql, desc, and, or, isNotNull, count, gt, gte, lte, between } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import { batchStatusEnum, attendance } from "@shared/schema";
import {
  users,
  organizations,
  organizationProcesses,
  organizationBatches,
  organizationLineOfBusinesses,
  organizationLocations,
  rolePermissions,
  userProcesses,
  batchPhaseChangeRequests,
  quizResponses,
  userBatchProcesses,
  organizationSettings,
  organizationHolidays,
  audioFiles,
  audioFileAllocations,
  audioFileBatchAllocations,
  type QuizResponse,
  type InsertQuizResponse,
  type User,
  type InsertUser,
  type Organization,
  type InsertOrganization,
  type OrganizationProcess,
  type InsertOrganizationProcess,
  type OrganizationBatch,
  type InsertOrganizationBatch,
  type UserBatchProcess,
  type InsertUserBatchProcess,
  type RolePermission,
  type OrganizationLineOfBusiness,
  type InsertOrganizationLineOfBusiness,
  type UserProcess,
  type InsertUserProcess,
  type OrganizationLocation,
  type InsertOrganizationLocation,
  type BatchPhaseChangeRequest,
  type InsertBatchPhaseChangeRequest,
  type BatchTemplate,
  type InsertBatchTemplate,
  type AudioFile,
  type InsertAudioFile,
  type AudioFileAllocation,
  type InsertAudioFileAllocation,
  type AudioFileBatchAllocation,
  type InsertAudioFileBatchAllocation,
  batchHistory,
  type BatchHistory,
  type InsertBatchHistory,
  questions,
  type Question,
  type InsertQuestion,
  quizTemplates,
  type QuizTemplate,
  type InsertQuizTemplate,
  quizzes,
  type Quiz,
  type OrganizationSettings,
  type InsertOrganizationSettings,
  type OrganizationHoliday,
  type InsertOrganizationHoliday,
  type InsertQuiz,
  quizAttempts,
  type QuizAttempt,
  type InsertQuizAttempt,
  type MockCallScenario,
  type InsertMockCallScenario,
  type MockCallAttempt,
  type InsertMockCallAttempt,
  mockCallScenarios,
  mockCallAttempts,
  evaluationTemplates,
  evaluationPillars,
  evaluationParameters,
  type EvaluationTemplate,
  type InsertEvaluationTemplate,
  type EvaluationPillar,
  type InsertEvaluationPillar,
  type EvaluationParameter,
  type InsertEvaluationParameter,
  evaluations,
  evaluationScores,
  type Evaluation,
  type InsertEvaluation,
  type EvaluationScore,
  type InsertEvaluationScore
} from "@shared/schema";

// Add to IStorage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  updateUserPassword(email: string, hashedPassword: string): Promise<void>;
  deleteUser(id: number): Promise<void>;
  listUsers(organizationId: number): Promise<User[]>;
  
  // Audio file operations
  createAudioFile(file: InsertAudioFile): Promise<AudioFile>;
  getAudioFile(id: number): Promise<AudioFile | undefined>;
  listAudioFiles(organizationId: number, filters?: {
    status?: string;
    language?: string;
    version?: string;
    processId?: number;
    batchId?: number;
    duration?: { min?: number; max?: number };
  }): Promise<AudioFile[]>;
  updateAudioFile(id: number, file: Partial<InsertAudioFile>): Promise<AudioFile>;
  deleteAudioFile(id: number): Promise<void>;
  
  // Audio file allocation operations
  createAudioFileAllocation(allocation: InsertAudioFileAllocation): Promise<AudioFileAllocation>;
  getAudioFileAllocation(id: number): Promise<AudioFileAllocation | undefined>;
  listAudioFileAllocations(filters: {
    organizationId: number;
    qualityAnalystId?: number;
    audioFileId?: number;
    status?: string;
  }): Promise<AudioFileAllocation[]>;
  updateAudioFileAllocation(id: number, allocation: Partial<InsertAudioFileAllocation>): Promise<AudioFileAllocation>;
  getQualityAnalystsForAllocation(organizationId: number): Promise<User[]>;
  
  // Audio file batch allocation operations
  createAudioFileBatchAllocation(batchAllocation: {
    name: string;
    description?: string;
    organizationId: number;
    allocatedBy: number;
    dueDate?: Date;
    audioFileIds: number[];
    qualityAnalysts: { id: number; count: number }[];
    filters?: {
      language?: string[];
      version?: string[];
      processId?: number[];
      duration?: { min?: number; max?: number };
    };
  }): Promise<{
    batchAllocation: AudioFileBatchAllocation;
    allocations: AudioFileAllocation[];
  }>;

  // Quiz template operations
  createQuizTemplate(template: InsertQuizTemplate): Promise<QuizTemplate>;
  listQuizTemplates(organizationId: number, processId?: number): Promise<QuizTemplate[]>;
  deleteQuizTemplate(id: number): Promise<void>;
  getQuizTemplate(id: number): Promise<QuizTemplate | undefined>;
  updateQuizTemplate(id: number, template: Partial<InsertQuizTemplate>): Promise<QuizTemplate>;

  // User Process operations
  assignProcessesToUser(processes: InsertUserProcess[]): Promise<UserProcess[]>;
  getUserProcesses(userId: number): Promise<UserProcess[]>;
  removeUserProcess(userId: number, processId: number): Promise<void>;

  // Organization operations
  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganizationByName(name: string): Promise<Organization | undefined>;
  updateOrganization(id: number, org: Partial<Organization>): Promise<Organization>;
  hasOrganizationOwner(organizationId: number): Promise<boolean>;

  // Organization settings operations
  createProcess(process: InsertOrganizationProcess): Promise<OrganizationProcess>;
  listProcesses(organizationId: number, name?: string): Promise<OrganizationProcess[]>;

  // Role Permissions operations
  listRolePermissions(organizationId: number): Promise<RolePermission[]>;
  getRolePermissions(organizationId: number, role: string): Promise<RolePermission | undefined>;
  updateRolePermissions(organizationId: number, role: string, permissions: string[]): Promise<RolePermission>;

  // Process operations
  getProcess(id: number): Promise<OrganizationProcess | undefined>;
  updateProcess(id: number, process: Partial<InsertOrganizationProcess>): Promise<OrganizationProcess>;
  deleteProcess(id: number): Promise<void>;

  // Line of Business operations
  createLineOfBusiness(lob: InsertOrganizationLineOfBusiness): Promise<OrganizationLineOfBusiness>;
  getLineOfBusiness(id: number): Promise<OrganizationLineOfBusiness | undefined>;
  listLineOfBusinesses(organizationId: number): Promise<OrganizationLineOfBusiness[]>;
  updateLineOfBusiness(id: number, lob: Partial<InsertOrganizationLineOfBusiness>): Promise<OrganizationLineOfBusiness>;
  deleteLineOfBusiness(id: number): Promise<void>;

  // Add new method for creating user with processes
  createUserWithProcesses(
    user: InsertUser,
    processIds: number[],
    organizationId: number,
    lineOfBusinessId: number | null
  ): Promise<{ user: User; processes: UserProcess[] }>;

  // Add new method for getting processes by line of business
  getProcessesByLineOfBusiness(organizationId: number, lobId: number): Promise<OrganizationProcess[]>;

  // Location operations
  listLocations(organizationId: number): Promise<OrganizationLocation[]>;
  updateLocation(id: number, location: Partial<InsertOrganizationLocation>): Promise<OrganizationLocation>;
  deleteLocation(id: number): Promise<void>;
  createLocation(location: InsertOrganizationLocation): Promise<OrganizationLocation>;
  getLocation(id: number): Promise<OrganizationLocation | undefined>;
  getLocationByName(name: string): Promise<{ id: number } | null>;
  getProcessByName(name: string): Promise<{ id: number } | null>;
  getLineOfBusinessByName(name: string): Promise<{ id: number } | null>;
  assignProcessToUser(userId: number, processId: number, lineOfBusinessId?: number): Promise<void>;

  // Batch operations
  createBatch(batch: InsertOrganizationBatch): Promise<OrganizationBatch>;
  getBatch(id: number): Promise<OrganizationBatch | undefined>;
  listBatches(organizationId: number): Promise<(OrganizationBatch & { userCount: number })[]>;
  updateBatch(id: number, batch: Partial<InsertOrganizationBatch>): Promise<OrganizationBatch>;
  deleteBatch(id: number): Promise<void>;
  getLineOfBusinessesByLocation(organizationId: number, locationId: number): Promise<OrganizationLineOfBusiness[]>;

  // Batch Template operations
  createBatchTemplate(template: InsertBatchTemplate): Promise<BatchTemplate>;
  listBatchTemplates(organizationId: number): Promise<BatchTemplate[]>;
  getBatchTemplate(id: number): Promise<BatchTemplate | undefined>;
  deleteBatchTemplate(id: number): Promise<void>;

  // Add new method for getting trainer's batches
  getBatchesByTrainer(
    trainerId: number,
    organizationId: number,
    statuses: typeof batchStatusEnum.enumValues[number][]
  ): Promise<OrganizationBatch[]>;

  // User Batch Process operations
  assignUserToBatch(userBatchProcess: InsertUserBatchProcess): Promise<UserBatchProcess>;
  getUserBatchProcesses(userId: number): Promise<UserBatchProcess[]>;
  getBatchTrainees(batchId: number): Promise<UserBatchProcess[]>;
  getBatchTrainee(batchId: number, userId: number): Promise<UserBatchProcess | null>;
  updateUserBatchStatus(
    userId: number,
    batchId: number,
    status: string
  ): Promise<UserBatchProcess>;

  // Add new method for creating user process
  createUserProcess(process: InsertUserProcess): Promise<UserProcess>;

  // Add new methods for trainee management
  updateUserBatchProcess(userId: number, oldBatchId: number, newBatchId: number): Promise<void>;
  removeUserFromBatch(userId: number, batchId: number): Promise<void>;
  removeTraineeFromBatch(userBatchProcessId: number): Promise<void>;

  // Phase change request operations
  createPhaseChangeRequest(request: InsertBatchPhaseChangeRequest): Promise<BatchPhaseChangeRequest>;
  getPhaseChangeRequest(id: number): Promise<BatchPhaseChangeRequest | undefined>;
  listPhaseChangeRequests(organizationId: number, status?: string): Promise<BatchPhaseChangeRequest[]>;
  updatePhaseChangeRequest(
    id: number,
    update: {
      status: string;
      managerComments?: string;
    }
  ): Promise<BatchPhaseChangeRequest>;
  listTrainerPhaseChangeRequests(trainerId: number): Promise<BatchPhaseChangeRequest[]>;
  listManagerPhaseChangeRequests(managerId: number): Promise<BatchPhaseChangeRequest[]>;

  // Add new method for getting reporting trainers
  getReportingTrainers(managerId: number): Promise<User[]>;

  // Add new methods for batch filtering
  listBatchesForTrainer(trainerId: number): Promise<OrganizationBatch[]>;
  listBatchesForTrainers(trainerIds: number[]): Promise<OrganizationBatch[]>;

  // Add batch history methods
  listBatchHistory(batchId: number): Promise<BatchHistory[]>;
  createBatchHistoryEvent(event: InsertBatchHistory): Promise<BatchHistory>;

  // Helper methods for bulk upload
  getLocationByName(name: string): Promise<{ id: number } | null>;
  getProcessByName(name: string): Promise<{ id: number } | null>;
  assignProcessToUser(userId: number, processId: number): Promise<void>;

  // Question operations
  createQuestion(question: InsertQuestion): Promise<Question>;
  listQuestions(organizationId: number): Promise<Question[]>;
  getRandomQuestions(
    organizationId: number,
    options: {
      count: number;
      categoryDistribution?: Record<string, number>;
      difficultyDistribution?: Record<string, number>;
      processId?: number;
    }
  ): Promise<Question[]>;
  listQuestionsByProcess(organizationId: number, processId: number): Promise<Question[]>;
  updateQuestion(id: number, question: Partial<Question>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;
  getQuestionById(id: number): Promise<Question | undefined>;

  // Quiz operations
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  getQuizWithQuestions(id: number): Promise<Quiz | undefined>;
  createQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt>;
  getQuizAttempt(id: number): Promise<QuizAttempt | undefined>;
  getBatchQuizAttempts(batchId: number): Promise<QuizAttempt[]>;

  // Add new methods for quiz responses
  createQuizResponse(response: InsertQuizResponse): Promise<QuizResponse>;
  getQuizResponses(quizAttemptId: number): Promise<QuizResponse[]>;

  getQuiz(id: number): Promise<Quiz | undefined>;
  getQuizzesByTemplateId(templateId: number): Promise<Quiz[]>;

  // Add new method for deleting quizzes by template ID
  deleteQuizzesByTemplateId(templateId: number): Promise<void>;

  // Mock Call Scenario operations
  createMockCallScenario(scenario: InsertMockCallScenario): Promise<MockCallScenario>;
  getMockCallScenario(id: number): Promise<MockCallScenario | undefined>;
  listMockCallScenarios(organizationId: number): Promise<MockCallScenario[]>;
  createMockCallAttempt(attempt: InsertMockCallAttempt): Promise<MockCallAttempt>;

  // Evaluation Template operations
  createEvaluationTemplate(template: InsertEvaluationTemplate): Promise<EvaluationTemplate>;
  getEvaluationTemplate(id: number): Promise<EvaluationTemplate | undefined>;
  getEvaluationTemplateWithDetails(id: number): Promise<EvaluationTemplate & {
    pillars: (EvaluationPillar & {
      parameters: EvaluationParameter[];
    })[];
  } | undefined>;
  listEvaluationTemplates(organizationId: number): Promise<EvaluationTemplate[]>;
  createEvaluationPillar(pillar: InsertEvaluationPillar): Promise<EvaluationPillar>;
  getEvaluationPillar(id: number): Promise<EvaluationPillar | undefined>;
  createEvaluationParameter(parameter: InsertEvaluationParameter): Promise<EvaluationParameter>;
  getEvaluationParameter(id: number): Promise<EvaluationParameter | undefined>;
  updateEvaluationPillar(id: number, pillar: Partial<InsertEvaluationPillar>): Promise<EvaluationPillar>;
  deleteEvaluationPillar(id: number): Promise<void>;
  updateEvaluationParameter(id: number, parameter: Partial<InsertEvaluationParameter>): Promise<EvaluationParameter>;
  deleteEvaluationParameter(id: number): Promise<void>;
  deleteEvaluationTemplate(id: number): Promise<void>;
  updateEvaluationTemplate(id: number, template: Partial<InsertEvaluationTemplate>): Promise<EvaluationTemplate>;

  // Evaluation operations
  createEvaluation(evaluation: InsertEvaluation & { scores: Array<{ parameterId: number; score: string; comment?: string; noReason?: string; }> }): Promise<Evaluation>;

  // Organization Settings operations
  getOrganizationSettings(organizationId: number): Promise<OrganizationSettings | undefined>;
  createOrganizationSettings(settings: InsertOrganizationSettings): Promise<OrganizationSettings>;
  updateOrganizationSettings(organizationId: number, settings: Partial<InsertOrganizationSettings>): Promise<OrganizationSettings>;
  
  // Organization Holidays operations
  listOrganizationHolidays(organizationId: number, locationId?: number): Promise<OrganizationHoliday[]>;
  createOrganizationHoliday(holiday: InsertOrganizationHoliday): Promise<OrganizationHoliday>;
  updateOrganizationHoliday(id: number, holiday: Partial<InsertOrganizationHoliday>): Promise<OrganizationHoliday>;
  deleteOrganizationHoliday(id: number): Promise<void>;
  
  // Attendance operations
  createAttendanceRecord(attendanceData: { 
    traineeId: number;
    status: string;
    date: string;
    markedById: number;
    organizationId: number;
    batchId?: number;
    phase?: string;
  }): Promise<any>;
  getAttendanceRecord(traineeId: number, date: string): Promise<any>;
  getBatchAttendanceOverview(organizationId: number, options?: { 
    batchIds?: number[];
    dateRange?: { from: string; to: string };
  }): Promise<{ 
    presentCount: number;
    absentCount: number;
    lateCount: number;
    leaveCount: number;
    attendanceRate: number;
  }>;
  
  // Audio File operations
  createAudioFile(file: InsertAudioFile): Promise<AudioFile>;
  getAudioFile(id: number): Promise<AudioFile | undefined>;
  listAudioFiles(organizationId: number, filters?: {
    status?: string;
    language?: string;
    version?: string;
    processId?: number;
    batchId?: number;
    duration?: { min?: number; max?: number };
  }): Promise<AudioFile[]>;
  updateAudioFile(id: number, file: Partial<InsertAudioFile>): Promise<AudioFile>;
  deleteAudioFile(id: number): Promise<void>;
  
  // Audio File Allocation operations
  createAudioFileAllocation(allocation: InsertAudioFileAllocation): Promise<AudioFileAllocation>;
  getAudioFileAllocation(id: number): Promise<AudioFileAllocation | undefined>;
  listAudioFileAllocations(filters: {
    organizationId: number;
    qualityAnalystId?: number;
    audioFileId?: number;
    status?: string;
  }): Promise<AudioFileAllocation[]>;
  updateAudioFileAllocation(id: number, allocation: Partial<InsertAudioFileAllocation>): Promise<AudioFileAllocation>;
  getQualityAnalystsForAllocation(organizationId: number): Promise<User[]>;
  createAudioFileBatchAllocation(batchAllocation: {
    name: string;
    description?: string;
    organizationId: number;
    allocatedBy: number;
    dueDate?: Date;
    audioFileIds: number[];
    qualityAnalysts: { id: number; count: number }[];
    filters?: {
      language?: string[];
      version?: string[];
      processId?: number[];
      duration?: { min?: number; max?: number };
    };
  }): Promise<{
    batchAllocation: AudioFileBatchAllocation;
    allocations: AudioFileAllocation[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // Audio File operations
  async createAudioFile(file: InsertAudioFile): Promise<AudioFile> {
    try {
      // Verify process ID exists
      if (file.processId) {
        const [process] = await db
          .select()
          .from(organizationProcesses)
          .where(eq(organizationProcesses.id, file.processId))
          .where(eq(organizationProcesses.organizationId, file.organizationId));
          
        if (!process) {
          throw new Error(`Process with ID ${file.processId} does not exist in organization ${file.organizationId}`);
        }
      }
      
      const [newFile] = await db
        .insert(audioFiles)
        .values(file)
        .returning() as AudioFile[];
      return newFile;
    } catch (error) {
      console.error('Error creating audio file:', error);
      throw error;
    }
  }

  async getAudioFile(id: number): Promise<AudioFile | undefined> {
    try {
      const [audioFile] = await db
        .select()
        .from(audioFiles)
        .where(eq(audioFiles.id, id)) as AudioFile[];
      return audioFile;
    } catch (error) {
      console.error('Error getting audio file:', error);
      throw error;
    }
  }

  async listAudioFiles(organizationId: number, filters?: {
    status?: string;
    language?: string;
    version?: string;
    processId?: number;
    batchId?: number;
    duration?: { min?: number; max?: number };
  }): Promise<AudioFile[]> {
    try {
      let query = db
        .select()
        .from(audioFiles)
        .where(eq(audioFiles.organizationId, organizationId));

      // Apply filters if provided
      if (filters) {
        if (filters.status) {
          query = query.where(eq(audioFiles.status, filters.status as any));
        }
        if (filters.language) {
          query = query.where(eq(audioFiles.language, filters.language as any));
        }
        if (filters.version) {
          query = query.where(eq(audioFiles.version, filters.version));
        }
        if (filters.processId) {
          query = query.where(eq(audioFiles.processId, filters.processId));
        }
        if (filters.batchId) {
          query = query.where(eq(audioFiles.batchId, filters.batchId));
        }
        if (filters.duration) {
          if (filters.duration.min !== undefined) {
            query = query.where(gte(audioFiles.duration, filters.duration.min));
          }
          if (filters.duration.max !== undefined) {
            query = query.where(lte(audioFiles.duration, filters.duration.max));
          }
        }
      }

      const files = await query as AudioFile[];
      return files;
    } catch (error) {
      console.error('Error listing audio files:', error);
      throw error;
    }
  }

  async updateAudioFile(id: number, file: Partial<InsertAudioFile>): Promise<AudioFile> {
    try {
      // Get the original audio file to get the organizationId
      const [audioFile] = await db
        .select()
        .from(audioFiles)
        .where(eq(audioFiles.id, id)) as AudioFile[];
        
      if (!audioFile) {
        throw new Error('Audio file not found');
      }
      
      // Verify process ID exists if it's being updated
      if (file.processId) {
        const [process] = await db
          .select()
          .from(organizationProcesses)
          .where(eq(organizationProcesses.id, file.processId))
          .where(eq(organizationProcesses.organizationId, audioFile.organizationId));
          
        if (!process) {
          throw new Error(`Process with ID ${file.processId} does not exist in organization ${audioFile.organizationId}`);
        }
      }
      
      const [updatedFile] = await db
        .update(audioFiles)
        .set({
          ...file,
          updatedAt: new Date()
        })
        .where(eq(audioFiles.id, id))
        .returning() as AudioFile[];
      
      if (!updatedFile) {
        throw new Error('Audio file not found');
      }
      
      return updatedFile;
    } catch (error) {
      console.error('Error updating audio file:', error);
      throw error;
    }
  }

  async deleteAudioFile(id: number): Promise<void> {
    try {
      await db
        .delete(audioFiles)
        .where(eq(audioFiles.id, id));
    } catch (error) {
      console.error('Error deleting audio file:', error);
      throw error;
    }
  }

  // Audio File Allocation operations
  async createAudioFileAllocation(allocation: InsertAudioFileAllocation): Promise<AudioFileAllocation> {
    try {
      const [newAllocation] = await db
        .insert(audioFileAllocations)
        .values(allocation)
        .returning() as AudioFileAllocation[];

      // Update the audio file status to 'allocated'
      await db
        .update(audioFiles)
        .set({
          status: 'allocated',
          updatedAt: new Date()
        })
        .where(eq(audioFiles.id, allocation.audioFileId));

      return newAllocation;
    } catch (error) {
      console.error('Error creating audio file allocation:', error);
      throw error;
    }
  }

  async getAudioFileAllocation(id: number): Promise<AudioFileAllocation | undefined> {
    try {
      const [allocation] = await db
        .select()
        .from(audioFileAllocations)
        .where(eq(audioFileAllocations.id, id)) as AudioFileAllocation[];
      return allocation;
    } catch (error) {
      console.error('Error getting audio file allocation:', error);
      throw error;
    }
  }

  async listAudioFileAllocations(filters: {
    organizationId: number;
    qualityAnalystId?: number;
    audioFileId?: number;
    status?: string;
  }): Promise<AudioFileAllocation[]> {
    try {
      let query = db
        .select()
        .from(audioFileAllocations)
        .where(eq(audioFileAllocations.organizationId, filters.organizationId));

      if (filters.qualityAnalystId) {
        query = query.where(eq(audioFileAllocations.qualityAnalystId, filters.qualityAnalystId));
      }
      if (filters.audioFileId) {
        query = query.where(eq(audioFileAllocations.audioFileId, filters.audioFileId));
      }
      if (filters.status) {
        query = query.where(eq(audioFileAllocations.status, filters.status as any));
      }

      const allocations = await query as AudioFileAllocation[];
      return allocations;
    } catch (error) {
      console.error('Error listing audio file allocations:', error);
      throw error;
    }
  }

  async updateAudioFileAllocation(id: number, allocation: Partial<InsertAudioFileAllocation>): Promise<AudioFileAllocation> {
    try {
      const [updatedAllocation] = await db
        .update(audioFileAllocations)
        .set({
          ...allocation,
          updatedAt: new Date()
        })
        .where(eq(audioFileAllocations.id, id))
        .returning() as AudioFileAllocation[];

      if (!updatedAllocation) {
        throw new Error('Audio file allocation not found');
      }

      // If status is changed to 'evaluated', update the audio file status too
      if (allocation.status === 'evaluated') {
        await db
          .update(audioFiles)
          .set({
            status: 'evaluated',
            updatedAt: new Date()
          })
          .where(eq(audioFiles.id, updatedAllocation.audioFileId));
      }

      return updatedAllocation;
    } catch (error) {
      console.error('Error updating audio file allocation:', error);
      throw error;
    }
  }

  async getQualityAnalystsForAllocation(organizationId: number): Promise<User[]> {
    try {
      const qualityAnalysts = await db
        .select()
        .from(users)
        .where(and(
          eq(users.organizationId, organizationId),
          eq(users.role, 'quality_analyst'),
          eq(users.active, true)
        )) as User[];
      
      return qualityAnalysts;
    } catch (error) {
      console.error('Error getting quality analysts:', error);
      throw error;
    }
  }

  async createAudioFileBatchAllocation(batchAllocation: {
    name: string;
    description?: string;
    organizationId: number;
    allocatedBy: number;
    dueDate?: Date;
    audioFileIds: number[];
    qualityAnalysts: { id: number; count: number }[];
    filters?: {
      language?: string[];
      version?: string[];
      processId?: number[];
      duration?: { min?: number; max?: number };
    };
  }): Promise<{
    batchAllocation: AudioFileBatchAllocation;
    allocations: AudioFileAllocation[];
  }> {
    try {
      // Start transaction
      return await db.transaction(async (tx) => {
        // Create batch allocation record
        const [newBatchAllocation] = await tx
          .insert(audioFileBatchAllocations)
          .values({
            name: batchAllocation.name,
            description: batchAllocation.description,
            organizationId: batchAllocation.organizationId,
            allocatedBy: batchAllocation.allocatedBy,
            dueDate: batchAllocation.dueDate,
            status: 'allocated',
          })
          .returning() as AudioFileBatchAllocation[];

        let audioFilesToAllocate: AudioFile[] = [];

        // If specific file IDs are provided
        if (batchAllocation.audioFileIds && batchAllocation.audioFileIds.length > 0) {
          audioFilesToAllocate = await tx
            .select()
            .from(audioFiles)
            .where(and(
              eq(audioFiles.organizationId, batchAllocation.organizationId),
              eq(audioFiles.status, 'pending'),
              inArray(audioFiles.id, batchAllocation.audioFileIds)
            )) as AudioFile[];
        } 
        // Otherwise, apply filters to find files
        else if (batchAllocation.filters) {
          let query = tx
            .select()
            .from(audioFiles)
            .where(and(
              eq(audioFiles.organizationId, batchAllocation.organizationId),
              eq(audioFiles.status, 'pending')
            ));

          const filters = batchAllocation.filters;
          
          if (filters.language && filters.language.length > 0) {
            query = query.where(inArray(audioFiles.language, filters.language as any[]));
          }
          
          if (filters.version && filters.version.length > 0) {
            query = query.where(inArray(audioFiles.version, filters.version));
          }
          
          if (filters.processId && filters.processId.length > 0) {
            query = query.where(inArray(audioFiles.processId, filters.processId));
          }
          
          if (filters.duration) {
            if (filters.duration.min !== undefined) {
              query = query.where(gte(audioFiles.duration, filters.duration.min));
            }
            if (filters.duration.max !== undefined) {
              query = query.where(lte(audioFiles.duration, filters.duration.max));
            }
          }
          
          audioFilesToAllocate = await query as AudioFile[];
        }

        if (audioFilesToAllocate.length === 0) {
          throw new Error('No audio files available for allocation based on criteria');
        }

        // Prepare allocation
        const qualityAnalysts = batchAllocation.qualityAnalysts;
        const totalQACount = qualityAnalysts.reduce((sum, qa) => sum + qa.count, 0);

        // Sort QAs by count (descending) to prioritize those who should receive more files
        qualityAnalysts.sort((a, b) => b.count - a.count);

        // Calculate how many files each QA should get
        const qaAllocationMap = new Map<number, number>();
        let remainingFiles = audioFilesToAllocate.length;
        
        // First pass: assign minimum files based on proportions
        for (const qa of qualityAnalysts) {
          const proportion = qa.count / totalQACount;
          const filesForQA = Math.floor(audioFilesToAllocate.length * proportion);
          qaAllocationMap.set(qa.id, filesForQA);
          remainingFiles -= filesForQA;
        }
        
        // Second pass: distribute remaining files to QAs who should get more
        let qaIndex = 0;
        while (remainingFiles > 0) {
          const qaId = qualityAnalysts[qaIndex].id;
          qaAllocationMap.set(qaId, (qaAllocationMap.get(qaId) || 0) + 1);
          remainingFiles--;
          qaIndex = (qaIndex + 1) % qualityAnalysts.length;
        }

        // Create allocation records
        const allocations: AudioFileAllocation[] = [];
        let currentQAIndex = 0;
        let currentFileIndex = 0;
        
        for (const [qaId, fileCount] of qaAllocationMap.entries()) {
          for (let i = 0; i < fileCount; i++) {
            if (currentFileIndex >= audioFilesToAllocate.length) break;
            
            const audioFile = audioFilesToAllocate[currentFileIndex++];
            
            const [allocation] = await tx
              .insert(audioFileAllocations)
              .values({
                audioFileId: audioFile.id,
                qualityAnalystId: qaId,
                dueDate: batchAllocation.dueDate,
                status: 'allocated',
                allocatedBy: batchAllocation.allocatedBy,
                organizationId: batchAllocation.organizationId,
              })
              .returning() as AudioFileAllocation[];
            
            allocations.push(allocation);
            
            // Update audio file status
            await tx
              .update(audioFiles)
              .set({
                status: 'allocated',
                updatedAt: new Date()
              })
              .where(eq(audioFiles.id, audioFile.id));
          }
        }

        return {
          batchAllocation: newBatchAllocation,
          allocations
        };
      });
    } catch (error) {
      console.error('Error creating audio file batch allocation:', error);
      throw error;
    }
  }

  // Organization Settings operations
  async getOrganizationSettings(organizationId: number): Promise<OrganizationSettings | undefined> {
    try {
      const [settings] = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, organizationId)) as OrganizationSettings[];
      return settings;
    } catch (error) {
      console.error('Error fetching organization settings:', error);
      throw error;
    }
  }

  async createOrganizationSettings(settings: InsertOrganizationSettings): Promise<OrganizationSettings> {
    try {
      const [newSettings] = await db
        .insert(organizationSettings)
        .values(settings)
        .returning() as OrganizationSettings[];
      return newSettings;
    } catch (error) {
      console.error('Error creating organization settings:', error);
      throw error;
    }
  }

  async updateOrganizationSettings(organizationId: number, settings: Partial<InsertOrganizationSettings>): Promise<OrganizationSettings> {
    try {
      const [updatedSettings] = await db
        .update(organizationSettings)
        .set({
          ...settings,
          updatedAt: new Date()
        })
        .where(eq(organizationSettings.organizationId, organizationId))
        .returning() as OrganizationSettings[];

      if (!updatedSettings) {
        throw new Error('Organization settings not found');
      }

      return updatedSettings;
    } catch (error) {
      console.error('Error updating organization settings:', error);
      throw error;
    }
  }

  // Organization Holidays operations
  async listOrganizationHolidays(organizationId: number, locationId?: number): Promise<OrganizationHoliday[]> {
    try {
      let query = db
        .select()
        .from(organizationHolidays)
        .where(eq(organizationHolidays.organizationId, organizationId));

      if (locationId) {
        query = query.where(eq(organizationHolidays.locationId, locationId));
      }

      const holidays = await query as OrganizationHoliday[];
      return holidays;
    } catch (error) {
      console.error('Error fetching organization holidays:', error);
      throw error;
    }
  }

  async createOrganizationHoliday(holiday: InsertOrganizationHoliday): Promise<OrganizationHoliday> {
    try {
      const [newHoliday] = await db
        .insert(organizationHolidays)
        .values(holiday)
        .returning() as OrganizationHoliday[];
      return newHoliday;
    } catch (error) {
      console.error('Error creating organization holiday:', error);
      throw error;
    }
  }

  async updateOrganizationHoliday(id: number, holiday: Partial<InsertOrganizationHoliday>): Promise<OrganizationHoliday> {
    try {
      const [updatedHoliday] = await db
        .update(organizationHolidays)
        .set({
          ...holiday,
          updatedAt: new Date()
        })
        .where(eq(organizationHolidays.id, id))
        .returning() as OrganizationHoliday[];

      if (!updatedHoliday) {
        throw new Error('Holiday not found');
      }

      return updatedHoliday;
    } catch (error) {
      console.error('Error updating organization holiday:', error);
      throw error;
    }
  }

  async deleteOrganizationHoliday(id: number): Promise<void> {
    try {
      await db
        .delete(organizationHolidays)
        .where(eq(organizationHolidays.id, id));
    } catch (error) {
      console.error('Error deleting organization holiday:', error);
      throw error;
    }
  }
  async createEvaluationParameter(parameter: InsertEvaluationParameter): Promise<EvaluationParameter> {
    try {
      console.log('Creating evaluation parameter with data:', parameter);
      
      // Ensure noReasons is an array before inserting
      const parameterData = {
        ...parameter,
        noReasons: Array.isArray(parameter.noReasons) ? parameter.noReasons : [],
      };

      const [newParameter] = await db
        .insert(evaluationParameters)
        .values(parameterData)
        .returning() as EvaluationParameter[];

      console.log('Created parameter:', newParameter);
      return newParameter;
    } catch (error) {
      console.error('Error creating evaluation parameter:', error);
      throw error;
    }
  }

  async updateEvaluationParameter(id: number, parameter: Partial<InsertEvaluationParameter>): Promise<EvaluationParameter> {
    try {
      console.log('Updating evaluation parameter:', id, parameter);

      // Ensure noReasons is an array if provided
      const updateData = {
        ...parameter,
        noReasons: parameter.noReasons ? 
          (Array.isArray(parameter.noReasons) ? parameter.noReasons : []) : 
          undefined,
      };

      const [updatedParameter] = await db
        .update(evaluationParameters)
        .set(updateData)
        .where(eq(evaluationParameters.id, id))
        .returning() as EvaluationParameter[];

      console.log('Updated parameter:', updatedParameter);
      return updatedParameter;
    } catch (error) {
      console.error('Error updating evaluation parameter:', error);
      throw error;
    }
  }

  async createEvaluation(evaluation: InsertEvaluation & { scores: Array<{ parameterId: number; score: string; comment?: string; noReason?: string; }> }): Promise<Evaluation> {
    try {
      console.log('Creating evaluation:', evaluation);

      return await db.transaction(async (tx) => {
        // First create the evaluation record
        const [newEvaluation] = await tx
          .insert(evaluations)
          .values({
            templateId: evaluation.templateId,
            traineeId: evaluation.traineeId,
            batchId: evaluation.batchId,
            evaluatorId: evaluation.evaluatorId, 
            organizationId: evaluation.organizationId,
            finalScore: evaluation.finalScore,
            status: evaluation.status,
          })
          .returning() as Evaluation[];

        console.log('Created evaluation:', newEvaluation);

        // Then create all the parameter scores
        const scoresToInsert = evaluation.scores.map(score => ({
          evaluationId: newEvaluation.id,
          parameterId: score.parameterId,
          score: score.score,
          comment: score.comment,
          noReason: score.noReason,
        }));

        await tx
          .insert(evaluationScores)
          .values(scoresToInsert);

        console.log('Created evaluation scores');

        return newEvaluation;
      });
    } catch (error) {
      console.error('Error creating evaluation:', error);
      throw error;
    }
  }

  async deleteEvaluationTemplate(id: number): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        // First get all pillars for this template
        const pillars = await tx
          .select()
          .from(evaluationPillars)
          .where(eq(evaluationPillars.templateId, id));

        // Delete all parameters for each pillar 
        for (const pillar of pillars) {
          await tx
            .delete(evaluationParameters)
            .where(eq(evaluationParameters.pillarId, pillar.id));
        }

        // Delete all pillars
        await tx
          .delete(evaluationPillars)
          .where(eq(evaluationPillars.templateId, id));

        // Finally delete the template
        await tx 
          .delete(evaluationTemplates)
          .where(eq(evaluationTemplates.id, id));
      });
    } catch (error) {
      console.error('Error deleting evaluation template:', error);
      throw error;
    }
  }

  async updateEvaluationTemplate(id: number, template: Partial<InsertEvaluationTemplate>): Promise<EvaluationTemplate> {
    try {
      console.log('Updating evaluation template:', id, template);
      
      const [updatedTemplate] = await db
        .update(evaluationTemplates)
        .set({
          ...template,
          updatedAt: new Date(),
        })
        .where(eq(evaluationTemplates.id, id))
        .returning() as EvaluationTemplate[];

      if (!updatedTemplate) {
        throw new Error('Template not found');
      }

      console.log('Successfully updated template:', updatedTemplate);
      return updatedTemplate;
    } catch (error) {
      console.error('Error updating evaluation template:', error);
      throw error;
    }
  }

  async createEvaluation(evaluation: InsertEvaluation & { scores: Array<{ parameterId: number; score: string; comment?: string; noReason?: string; }> }): Promise<Evaluation> {
    try {
      console.log('Creating evaluation:', evaluation);

      return await db.transaction(async (tx) => {
        // Format the final score to ensure it's a valid decimal
        const finalScore = Number(parseFloat(evaluation.finalScore.toString()).toFixed(2));
        
        // First create the evaluation record
        const [newEvaluation] = await tx
          .insert(evaluations)
          .values({
            templateId: evaluation.templateId,
            traineeId: evaluation.traineeId,
            batchId: evaluation.batchId,
            evaluatorId: evaluation.evaluatorId, 
            organizationId: evaluation.organizationId,
            finalScore,
            status: evaluation.status,
          })
          .returning() as Evaluation[];

        console.log('Created evaluation:', newEvaluation);

        // Then create all the parameter scores
        const scoresToInsert = evaluation.scores.map(score => ({
          evaluationId: newEvaluation.id,
          parameterId: score.parameterId,
          score: score.score,
          comment: score.comment,
          noReason: score.noReason,
        }));

        await tx
          .insert(evaluationScores)
          .values(scoresToInsert);

        console.log('Created evaluation scores');

        return newEvaluation;
      });
    } catch (error) {
      console.error('Error creating evaluation:', error);
      throw error;
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)) as User[];
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)) as User[];
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)) as User[];
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning() as User[];
    return newUser;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    try {
      console.log(`Attempting to update user with ID: ${id}`, user);

      // Check if username is being updated and if it would conflict
      if (user.username) {
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.username, user.username))
          .then(results => results.find(u => u.id !== id));

        if (existingUser) {
          throw new Error('Username already exists. Please choose a different username.');
        }
      }

      const [updatedUser] = await db
        .update(users)
        .set({
          ...user,
          // Ensure we're not overwriting these fields unintentionally
          id: undefined,
          createdAt: undefined,
        })
        .where(eq(users.id, id))
        .returning() as User[];

      if (!updatedUser) {
        throw new Error('User not found');
      }

      console.log('Successfully updated user:', updatedUser);
      return updatedUser;
    } catch (error: any) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async updateUserPassword(email: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email));
  }

  async deleteUser(id: number): Promise<void> {
    try {
      console.log(`Attempting to soft delete user with ID: ${id}`);

      // First, verify the user exists
      const user = await this.getUser(id);
      if (!user) {
        console.log(`User with ID ${id} not found`);
        throw new Error('User not found');
      }

      console.log(`Found user to soft delete:`, {
        id: user.id,
        username: user.username,
        role: user.role
      });

      // Update user to be inactive instead of deleting
      const [updatedUser] = await db
        .update(users)
        .set({ 
          active: false,
          updatedAt: new Date()
        })
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) {
        throw new Error('User deactivation failed');
      }

      console.log(`Successfully deactivated user with ID: ${id}`);
    } catch (error) {
      console.error('Error in deleteUser:', error);
      throw error;
    }
  }

  async listUsers(organizationId: number, includeInactive: boolean = false): Promise<User[]> {
    let query = db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId));

    // Only include active users unless specifically requested
    if (!includeInactive) {
      query = query.where(eq(users.active, true));
    }

    return await query as User[];
  }

  // User Process operations
  async assignProcessesToUser(processes: InsertUserProcess[]): Promise<UserProcess[]> {
    try {
      const assignedProcesses = await db
        .insert(userProcesses)
        .values(processes)
        .returning() as UserProcess[];
      return assignedProcesses;
    } catch (error) {
      console.error('Error assigning processes to user:', error);
      throw new Error('Failed to assign processes to user');
    }
  }

  async getUserProcesses(userId: number): Promise<UserProcess[]> {
    try {
      const processes = await db
        .select({
          id: userProcesses.id,
          userId: userProcesses.userId,
          processId: userProcesses.processId,
          organizationId: userProcesses.organizationId,
          status: userProcesses.status,
          assignedAt: userProcesses.assignedAt,
          completedAt: userProcesses.completedAt,
          processName: organizationProcesses.name,
        })
        .from(userProcesses)
        .leftJoin(
          organizationProcesses,
          eq(userProcesses.processId, organizationProcesses.id)
        )
        .where(eq(userProcesses.userId, userId)) as UserProcess[];

      return processes;
    } catch (error) {
      console.error('Error fetching user processes:', error);
      throw new Error('Failed to fetch user processes');
    }
  }

  async removeUserProcess(userId: number, processId: number): Promise<void> {
    try {
      await db
        .delete(userProcesses)
        .where(eq(userProcesses.userId, userId))
        .where(eq(userProcesses.processId, processId));
    } catch (error) {
      console.error('Error removing user process:', error);
      throw new Error('Failed to remove user process');
    }
  }

  // Organization operations
  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)) as Organization[];
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [newOrg] = await db.insert(organizations).values(org).returning() as Organization[];
    return newOrg;
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.name, name)) as Organization[];
    return org;
  }

  async updateOrganization(id: number, org: Partial<Organization>): Promise<Organization> {
    const [updatedOrg] = await db
      .update(organizations)
      .set(org)
      .where(eq(organizations.id, id))
      .returning() as Organization[];
    return updatedOrg;
  }

  async hasOrganizationOwner(organizationId: number): Promise<boolean> {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId))
      .where(eq(users.role, 'owner')) as User[];
    return !!owner;
  }

  // Organization settings operations
  async createProcess(process: InsertOrganizationProcess): Promise<OrganizationProcess> {
    try {
      console.log('Creating process with data:', process);

      // First check if process with same name exists in the organization
      const existingProcesses = await db
        .select()
        .from(organizationProcesses)
        .where(eq(organizationProcesses.organizationId, process.organizationId));

      console.log('Found existing processes:', existingProcesses);

      const nameExists = existingProcesses.some(
        existing => existing.name.toLowerCase() === process.name.toLowerCase()
      );

      if (nameExists) {
        throw new Error('A process with this name already exists in this organization');
      }

      const [newProcess] = await db
        .insert(organizationProcesses)
        .values(process)
        .returning() as OrganizationProcess[];

      console.log('Successfully created new process:', newProcess);
      return newProcess;
    } catch (error: any) {
      console.error('Error creating process:', error);
      throw error;
    }
  }

  async listProcesses(organizationId: number, name?: string): Promise<OrganizationProcess[]> {
    try {
      console.log(`Fetching processes for organization ${organizationId}${name ? ` with name filter: ${name}` : ''}`);

      let query = db
        .select({
          id: organizationProcesses.id,
          name: organizationProcesses.name,
          description: organizationProcesses.description,
          status: organizationProcesses.status,
          inductionDays: organizationProcesses.inductionDays,
          trainingDays: organizationProcesses.trainingDays,
          certificationDays: organizationProcesses.certificationDays,
          ojtDays: organizationProcesses.ojtDays,
          ojtCertificationDays: organizationProcesses.ojtCertificationDays,
          organizationId: organizationProcesses.organizationId,
          lineOfBusinessId: organizationProcesses.lineOfBusinessId,
          createdAt: organizationProcesses.createdAt,
          updatedAt: organizationProcesses.updatedAt,
          lineOfBusinessName: organizationLineOfBusinesses.name,
        })
        .from(organizationProcesses)
        .leftJoin(
          organizationLineOfBusinesses,
          eq(organizationProcesses.lineOfBusinessId, organizationLineOfBusinesses.id)
        )
        .where(eq(organizationProcesses.organizationId, organizationId));

      if (name) {
        query = query.where(sql`lower(${organizationProcesses.name}) like ${`%${name.toLowerCase()}%`}`);
      }

      const processes = await query as OrganizationProcess[];

      console.log(`Found ${processes.length} processes with line of business details`);
      return processes;
    } catch (error) {
      console.error('Error fetching processes:', error);
      throw new Error('Failed to fetch processes');
    }
  }

  // Role Permissions operations
  async listRolePermissions(organizationId: number): Promise<RolePermission[]> {
    return await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.organizationId, organizationId)) as RolePermission[];
  }

  async getRolePermissions(organizationId: number, role: string): Promise<RolePermission | undefined> {
    const [permission] = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.organizationId, organizationId))
      .where(eq(rolePermissions.role, role)) as RolePermission[];
    return permission;
  }

  async updateRolePermissions(organizationId: number, role: string, permissions: string[]): Promise<RolePermission> {
    const existingPermission = await this.getRolePermissions(organizationId, role);

    if (existingPermission) {
      const [updated] = await db
        .update(rolePermissions)
        .set({ permissions, updatedAt: new Date() })
        .where(eq(rolePermissions.id, existingPermission.id))
        .returning() as RolePermission[];
      return updated;
    } else {
      const [created] = await db
        .insert(rolePermissions)
        .values({
          role,
          permissions,
          organizationId,
        })
        .returning() as RolePermission[];
      return created;
    }
  }


  // Process operations
  async getProcess(id: number): Promise<OrganizationProcess | undefined> {
    const [process] = await db
      .select()
      .from(organizationProcesses)
      .where(eq(organizationProcesses.id, id)) as OrganizationProcess[];
    return process;
  }

  async updateProcess(id: number, process: Partial<InsertOrganizationProcess>): Promise<OrganizationProcess> {
    try {
      console.log(`Attempting to update process with ID: ${id}`);
      console.log('Update data:', process);

      // Check if process exists
      const existingProcess = await this.getProcess(id);
      if (!existingProcess) {
        throw new Error('Process not found');
      }

      // Check if name is being updated and if it would conflict
      if (process.name && process.name !== existingProcess.name) {
        const nameExists = await db
          .select()
          .from(organizationProcesses)
          .where(eq(organizationProcesses.organizationId, existingProcess.organizationId))
          .where(eq(organizationProcesses.name, process.name))
          .then(results => results.length > 0);

        if (nameExists) {
          throw new Error('A process with this name already exists in this organization');
        }
      }

      const [updatedProcess] = await db
        .update(organizationProcesses)
        .set({
          ...process,
          updatedAt: new Date()
        })
        .where(eq(organizationProcesses.id, id))
        .returning() as OrganizationProcess[];

      console.log('Process updated successfully:', updatedProcess);
      return updatedProcess;
    } catch (error: any) {
      console.error('Error updating process:', error);
      throw error;
    }
  }

  async deleteProcess(id: number): Promise<void> {
    try {
      console.log(`Attempting to delete process with ID: ${id}`);

      // First verify the process exists
      const process = await this.getProcess(id);
      if (!process) {
        console.log(`Process with ID ${id} not found`);
        throw new Error('Process not found');
      }

      // Delete any associated user processes first
      await db
        .delete(userProcesses)
        .where(eq(userProcesses.processId, id));

      // Then delete the process
      const result = await db
        .delete(organizationProcesses)
        .where(eq(organizationProcesses.id, id))
        .returning();

      if (!result.length) {
        throw new Error('Process deletion failed');
      }

      console.log(`Successfully deleted process with ID: ${id}`);
    } catch (error) {
      console.error('Error deleting process:', error);
      throw error;
    }
  }

  async getLineOfBusinessByName(name: string): Promise<{ id: number } | null> {
    try {
      const [lob] = await db
        .select({ id: organizationLineOfBusinesses.id })
        .from(organizationLineOfBusinesses)
        .where(eq(organizationLineOfBusinesses.name, name));
      return lob || null;
    } catch (error) {
      console.error('Error getting line of business by name:', error);
      throw error;
    }
  }

  // Line of Business operations
  async createLineOfBusiness(lob: InsertOrganizationLineOfBusiness): Promise<OrganizationLineOfBusiness> {
    try {
      console.log('Creating new line of business:', lob);

      // Check if LOB with same name exists in the organization
      const existing = await db
        .select()
        .from(organizationLineOfBusinesses)
        .where(eq(organizationLineOfBusinesses.organizationId, lob.organizationId))
        .where(eq(organizationLineOfBusinesses.name, lob.name));

      if (existing.length > 0) {
        throw new Error('A Line of Business with this name already exists in this organization');
      }

      const [newLob] = await db
        .insert(organizationLineOfBusinesses)
        .values(lob)
        .returning() as OrganizationLineOfBusiness[];

      console.log('Successfully created new line of business:', newLob);
      return newLob;
    } catch (error: any) {
      console.error('Error creating line of business:', error);
      throw error;
    }
  }

  async getLineOfBusiness(id: number): Promise<OrganizationLineOfBusiness | undefined> {
    const [lob] = await db
      .select()
      .from(organizationLineOfBusinesses)
      .where(eq(organizationLineOfBusinesses.id, id)) as OrganizationLineOfBusiness[];
    return lob;
  }

  async listLineOfBusinesses(organizationId: number): Promise<OrganizationLineOfBusiness[]> {
    try {
      console.log(`Fetching line of businesses for organization ${organizationId}`);

      const lineOfBusinesses = await db
        .select()
        .from(organizationLineOfBusinesses)
        .where(eq(organizationLineOfBusinesses.organizationId, organizationId)) as OrganizationLineOfBusiness[];

      console.log(`Successfully found ${lineOfBusinesses.length} line of businesses`);
      return lineOfBusinesses;
    } catch (error: any) {
      console.error('Error fetching line of businesses:', error);
      throw new Error(`Failed to fetch line of businesses: ${error.message}`);
    }
  }

  async updateLineOfBusiness(id: number, lob: Partial<InsertOrganizationLineOfBusiness>): Promise<OrganizationLineOfBusiness> {
    try {
      console.log(`Updating Line of Business with ID: ${id}`, lob);

      // Check if name is being updated and if it would conflict
      if (lob.name) {
        const nameExists = await db
          .select()
          .from(organizationLineOfBusinesses)
          .where(eq(organizationLineOfBusinesses.organizationId, lob.organizationId))
          .where(eq(organizationLineOfBusinesses.name, lob.name))
          .then(results => results.some(l => l.id !== id));

        if (nameExists) {
          throw new Error('A Line of Business with this name already exists in this organization');
        }
      }

      const [updatedLob] = await db
        .update(organizationLineOfBusinesses)
        .set({
          ...lob,
          // Ensure we're not overwriting these fields unintentionally
          id: undefined,
          createdAt: undefined,
        })
        .where(eq(organizationLineOfBusinesses.id, id))
        .returning() as OrganizationLineOfBusiness[];

      if (!updatedLob) {
        throw new Error('Line of Business not found');
      }

      console.log('Successfully updated Line of Business:', updatedLob);
      return updatedLob;
    } catch (error) {
      console.error('Error updating Line of Business:', error);
      throw error;
    }
  }

  async deleteLineOfBusiness(id: number): Promise<void> {
    try {
      console.log(`Attempting to delete Line of Business with ID: ${id}`);

      // Use a transaction to ensure data consistency
      await db.transaction(async (tx) => {
        // First update all processes that reference this LOB
        await tx
          .update(organizationProcesses)
          .set({ lineOfBusinessId: null })
          .where(eq(organizationProcesses.lineOfBusinessId, id));

        console.log(`Updated processes' LOB references to null`);

        // Then delete the LOB
        const result = await tx
          .delete(organizationLineOfBusinesses)
          .where(eq(organizationLineOfBusinesses.id, id))
          .returning();

        if (!result.length) {
          throw new Error('Line of Business not found or deletion failed');
        }

        console.log(`Successfully deleted Line of Business with ID: ${id}`);
      });
    } catch (error) {
      console.error('Error deleting Line of Business:', error);
      throw error;
    }
  }

  // Add new methods for user process management
  async assignProcessesToUser(processes: InsertUserProcess[]): Promise<UserProcess[]> {
    try {
      const assignedProcesses = await db
        .insert(userProcesses)
        .values(processes)
        .returning() as UserProcess[];
      return assignedProcesses;
    } catch (error) {
      console.error('Error assigning processes to user:', error);
      throw new Error('Failed to assign processes to user');
    }
  }

  async getUserProcesses(userId: number): Promise<UserProcess[]> {
    try {
      const processes = await db
        .select({
          id: userProcesses.id,
          userId: userProcesses.userId,
          processId: userProcesses.processId,
          organizationId: userProcesses.organizationId,
          status: userProcesses.status,
          assignedAt: userProcesses.assignedAt,
          completedAt: userProcesses.completedAt,
          processName: organizationProcesses.name,
        })
        .from(userProcesses)
        .leftJoin(
          organizationProcesses,
          eq(userProcesses.processId, organizationProcesses.id)
        )
        .where(eq(userProcesses.userId, userId)) as UserProcess[];

      return processes;
    } catch (error) {
      console.error('Error fetching user processes:', error);
      throw new Error('Failed to fetch user processes');
    }
  }

  async removeUserProcess(userId: number, processId: number): Promise<void> {
    try {
      await db
        .delete(userProcesses)
        .where(eq(userProcesses.userId, userId))
        .where(eq(userProcesses.processId, processId));
    } catch (error) {
      console.error('Error removing user process:', error);
      throw new Error('Failed to remove user process');
    }
  }
  async createUserWithProcesses(
    user: InsertUser,
    processIds: number[],
    organizationId: number,
    lineOfBusinessId: number | null
  ): Promise<{ user: User; processes: UserProcess[] }> {
    try {
      return await db.transaction(async (tx) => {
        // Create the user first
        const [newUser] = await tx
          .insert(users)
          .values(user)
          .returning() as User[];

        // If no processes needed (empty array) or admin/owner roles, return just the user
        if (!processIds?.length || user.role === 'admin' || user.role === 'owner') {
          return { user: newUser, processes: [] };
        }

        // Create process assignments with both locationId and lineOfBusinessId
        const processAssignments = processIds.map(processId => ({
          userId: newUser.id,
          processId,
          organizationId,
          lineOfBusinessId,  // This can be null for admin/owner roles
          locationId: user.locationId,  // This comes from the user object
          status: 'assigned',
          assignedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        console.log('Creating process assignments:', {
          userId: newUser.id,
          locationId: user.locationId,
          lineOfBusinessId,
          processIds
        });

        const assignedProcesses = await tx
          .insert(userProcesses)
          .values(processAssignments)
          .returning() as UserProcess[];

        return {
          user: newUser,
          processes: assignedProcesses
        };
      });
    } catch (error: any) {
      console.error('Error in createUserWithProcesses:', error);
      throw error;
    }
  }

  async getProcessesByLineOfBusiness(organizationId: number, lobId: number): Promise<OrganizationProcess[]> {
    try {
      const processes = await db
        .select()
        .from(organizationProcesses)
        .where(eq(organizationProcesses.organizationId, organizationId))
        .where(eq(organizationProcesses.lineOfBusinessId, lobId)) as OrganizationProcess[];

      return processes;
    } catch (error) {
      console.error('Error fetching processes by LOB:', error);
      throw new Error('Failed to fetch processes for Line of Business');
    }
  }

  async listLocations(organizationId: number): Promise<OrganizationLocation[]> {
    try {
      console.log(`Fetching locations for organization ${organizationId}`);
      const locations = await db
        .select()
        .from(organizationLocations)
        .where(eq(organizationLocations.organizationId, organizationId)) as OrganizationLocation[];

      console.log(`Found ${locations.length} locations`);
      return locations;
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw new Error('Failed to fetch locations');
    }
  }

  async updateLocation(id: number, location: Partial<InsertOrganizationLocation>): Promise<OrganizationLocation> {
    try {
      console.log(`Updating location with ID: ${id}`, location);

      const [updatedLocation] = await db
        .update(organizationLocations)
        .set({
          ...location,
          // Ensure we're not overwriting these fields unintentionally
          id: undefined,
          createdAt: undefined,
        })
        .where(eq(organizationLocations.id, id))
        .returning() as OrganizationLocation[];

      if (!updatedLocation) {
        throw new Error('Location not found');
      }

      console.log('Successfully updated location:', updatedLocation);
      return updatedLocation;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }

  async deleteLocation(id: number): Promise<void> {
    try {
      console.log(`Attempting to delete location with ID: ${id}`);

      await db.transaction(async (tx) => {
        const result = await tx
          .delete(organizationLocations)
          .where(eq(organizationLocations.id, id))
          .returning();

        if (!result.length) {
          throw new Error('Location not found or deletion failed');
        }

        console.log(`Successfully deleted location with ID: ${id}`);
      });
    } catch (error) {
      console.error('Error deleting location:', error);      throw error;
    }
  }

  async createLocation(location: InsertOrganizationLocation): Promise<OrganizationLocation> {    try {
      console.log('Creating location with data:', location);

      // Check if location with same name exists in the organization
      const existingLocations = await db
        .select()
        .from(organizationLocations)
        .where(eq(organizationLocations.organizationId, location.organizationId))
        .where(eq(organizationLocations.name, location.name));

      if (existingLocations.length > 0) {
        throw new Error('A location with this name already exists in this organization');
      }

      const [newLocation] = await db
        .insert(organizationLocations)
        .values(location)
        .returning() as OrganizationLocation[];

      console.log('Successfully created new location:', newLocation);
      return newLocation;
    } catch (error: any) {
      console.error('Error creating location:', error);
      throw error;
    }
  }

  async getLocationByName(name: string): Promise<{ id: number } | null> {
    try {
      const [location] = await db
        .select({ id: organizationLocations.id })
        .from(organizationLocations)
        .where(eq(organizationLocations.name, name));
      return location || null;
    } catch (error) {
      console.error('Error getting location by name:', error);
      throw error;
    }
  }

  async getProcessByName(name: string): Promise<{ id: number } | null> {
    try {
      const [process] = await db
        .select({ id: organizationProcesses.id })
        .from(organizationProcesses)
        .where(eq(organizationProcesses.name, name));
      return process || null;
    } catch (error) {
      console.error('Error getting process by name:', error);
      throw error;
    }
  }

  async assignProcessToUser(userId: number, processId: number, lineOfBusinessId?: number): Promise<void> {
    try {
      // Get the organization ID for the user
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create the user process association with optional lineOfBusinessId
      await db.insert(userProcesses).values({
        userId,
        processId,
        organizationId: user.organizationId,
        lineOfBusinessId: lineOfBusinessId || null,
        status: 'assigned',
        assignedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error assigning process to user:', error);
      throw error;
    }
  }

  // Batch operations
  async createBatch(batch: InsertOrganizationBatch): Promise<OrganizationBatch> {
    try {
      console.log('Creating batch with data:', {
        ...batch,
        password: '[REDACTED]' // Ensure we don't log sensitive data
      });

      // Verify the location exists
      const location = await this.getLocation(batch.locationId);
      if (!location) {
        throw new Error('Location not found');
      }

      // Verify the LOB exists
      const lob = await this.getLineOfBusiness(batch.lineOfBusinessId);
      if (!lob) {
        throw new Error('Line of Business not found');
      }

      // Verify the process exists and belongs to the LOB
      const process = await this.getProcess(batch.processId);
      if (!process) {
        throw new Error('Process not found');
      }

      // If trainer is assigned, verify they exist and belong to the location
      if (batch.trainerId) {
        const trainer = await this.getUser(batch.trainerId);
        if (!trainer) {
          throw new Error('Trainer not found');
        }
        if (trainer.locationId !== batch.locationId) {
          throw new Error('Trainer is not assigned to the selected location');
        }
      }

      const [newBatch] = await db
        .insert(organizationBatches)
        .values(batch)
        .returning() as OrganizationBatch[];

      console.log('Successfully created new batch:', {
        id: newBatch.id,
        name: newBatch.name,
        batchCode: newBatch.batchCode
      });

      return newBatch;
    } catch (error) {
      console.error('Error creating batch:', error);
      throw error;
    }
  }

  async getBatch(id: number): Promise<OrganizationBatch & { trainer?: { id: number, fullName: string } } | undefined> {
    try {
      const [batch] = await db
        .select({
          id: organizationBatches.id,
          name: organizationBatches.name,
          batchCategory: organizationBatches.batchCategory,
          startDate: organizationBatches.startDate,
          endDate: organizationBatches.endDate,
          status: organizationBatches.status,
          capacityLimit: organizationBatches.capacityLimit,
          locationId: organizationBatches.locationId,
          processId: organizationBatches.processId,
          lineOfBusinessId: organizationBatches.lineOfBusinessId,
          trainerId: organizationBatches.trainerId,
          organizationId: organizationBatches.organizationId,
          inductionStartDate: organizationBatches.inductionStartDate,
          inductionEndDate: organizationBatches.inductionEndDate,
          trainingStartDate: organizationBatches.trainingStartDate,
          trainingEndDate: organizationBatches.trainingEndDate,
          certificationStartDate: organizationBatches.certificationStartDate,
          certificationEndDate: organizationBatches.certificationEndDate,
          ojtStartDate: organizationBatches.ojtStartDate,
          ojtEndDate: organizationBatches.ojtEndDate,
          ojtCertificationStartDate: organizationBatches.ojtCertificationStartDate,
          ojtCertificationEndDate: organizationBatches.ojtCertificationEndDate,
          handoverToOpsDate: organizationBatches.handoverToOpsDate,
          weeklyOffDays: organizationBatches.weeklyOffDays,
          considerHolidays: organizationBatches.considerHolidays,
          createdAt: organizationBatches.createdAt,
          updatedAt: organizationBatches.updatedAt,
          trainer: {
            id: users.id,
            fullName: users.fullName,
          },
        })
        .from(organizationBatches)
        .leftJoin(
          users,
          eq(organizationBatches.trainerId, users.id)
        )
        .where(eq(organizationBatches.id, id));

      return batch;
    } catch (error) {
      console.error('Error fetching batch:', error);
      throw error;
    }
  }

  async listBatches(organizationId: number): Promise<(OrganizationBatch & { userCount: number, trainer?: { id: number, fullName: string } })[]> {
    try {
      console.log(`Fetching batches for organization ${organizationId}`);
      
      // Log users schema columns for debugging
      console.log('Users schema:', Object.keys(users));
      console.log('Trainer column name:', Object.keys(users).find(k => k.toLowerCase().includes('name')));

      // Explicitly select and cast the batch_category field
      const batches = await db
        .select({
          id: organizationBatches.id,
          name: organizationBatches.name,
          batchCategory: sql<string>`${organizationBatches.batchCategory}::text`,
          startDate: organizationBatches.startDate,
          endDate: organizationBatches.endDate,
          status: organizationBatches.status,
          capacityLimit: organizationBatches.capacityLimit,
          locationId: organizationBatches.locationId,
          processId: organizationBatches.processId,
          lineOfBusinessId: organizationBatches.lineOfBusinessId,
          trainerId: organizationBatches.trainerId,
          organizationId: organizationBatches.organizationId,
          inductionStartDate: organizationBatches.inductionStartDate,
          inductionEndDate: organizationBatches.inductionEndDate,
          trainingStartDate: organizationBatches.trainingStartDate,
          trainingEndDate: organizationBatches.trainingEndDate,
          certificationStartDate: organizationBatches.certificationStartDate,
          certificationEndDate: organizationBatches.certificationEndDate,
          ojtStartDate: organizationBatches.ojtStartDate,
          ojtEndDate: organizationBatches.ojtEndDate,
          ojtCertificationStartDate: organizationBatches.ojtCertificationStartDate,
          ojtCertificationEndDate: organizationBatches.ojtCertificationEndDate,
          handoverToOpsDate: organizationBatches.handoverToOpsDate,
          weeklyOffDays: organizationBatches.weeklyOffDays,
          considerHolidays: organizationBatches.considerHolidays,
          createdAt: organizationBatches.createdAt,
          updatedAt: organizationBatches.updatedAt,
          location: organizationLocations,
          process: organizationProcesses,
          line_of_business: organizationLineOfBusinesses,
          trainer: {
            id: users.id,
            fullName: users.fullName,
          },
        })
        .from(organizationBatches)
        .leftJoin(
          organizationLocations,
          eq(organizationBatches.locationId, organizationLocations.id)
        )
        .leftJoin(
          organizationProcesses,
          eq(organizationBatches.processId, organizationProcesses.id)
        )
        .leftJoin(
          organizationLineOfBusinesses,
          eq(organizationBatches.lineOfBusinessId, organizationLineOfBusinesses.id)
        )
        .leftJoin(
          users,
          eq(organizationBatches.trainerId, users.id)
        )
        .where(eq(organizationBatches.organizationId, organizationId))
        .orderBy(desc(organizationBatches.createdAt));
      
      // Get user counts for each batch
      const batchesWithUserCounts = await Promise.all(
        batches.map(async (batch) => {
          // Count users in this batch from user_batch_processes table
          const userCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(userBatchProcesses)
            .where(eq(userBatchProcesses.batchId, batch.id));
          
          const userCount = userCountResult[0]?.count || 0;
          
          return {
            ...batch,
            userCount
          };
        })
      );

      return batchesWithUserCounts as (OrganizationBatch & { userCount: number })[];
    } catch (error) {
      console.error('Error fetching batches:', error);
      throw error;
    }
  }

  async updateBatch(id: number, batch: Partial<InsertOrganizationBatch>): Promise<OrganizationBatch> {
    try {
      console.log(`Updating batch with ID: ${id}`, batch);

      const [updatedBatch] = await db
        .update(organizationBatches)
        .set({
          ...batch,
          updatedAt: new Date()
        })
        .where(eq(organizationBatches.id, id))
        .returning() as OrganizationBatch[];

      if (!updatedBatch) {
        throw new Error('Batch not found');
      }

      console.log('Successfully updated batch:', updatedBatch);
      return updatedBatch;
    } catch (error) {
      console.error('Error updating batch:', error);
      throw error;
    }
  }

  async deleteBatch(id: number): Promise<void> {
    try {
      console.log(`Attempting to delete batch with ID: ${id}`);

      const result = await db
        .delete(organizationBatches)
        .where(eq(organizationBatches.id, id))
        .returning();

      if (!result.length) {
        throw new Error('Batch not found or deletion failed');
      }

      console.log(`Successfully deleted batch with ID: ${id}`);
    } catch (error) {
      console.error('Error deleting batch:', error);
      throw error;
    }
  }

  async getLocation(id: number): Promise<OrganizationLocation | undefined> {
    try {
      console.log(`Fetching location with ID: ${id}`);
      const [location] = await db
        .select()
        .from(organizationLocations)
        .where(eq(organizationLocations.id, id)) as OrganizationLocation[];

      console.log('Location found:', location);
      return location;
    } catch (error) {
      console.error('Error fetching location:', error);
      throw error;
    }
  }

  // Get LOBs from user_processes table based on location
  async getLineOfBusinessesByLocation(organizationId: number, locationId: number): Promise<OrganizationLineOfBusiness[]> {
    try {
      console.log(`Starting LOB query for location ${locationId}`);

      // First verify if the location exists
      const location = await this.getLocation(locationId);
      if (!location) {
        console.log(`Location ${locationId} not found`);
        return [];
      }

      // Get trainers for this location
      const trainers = await db
        .select()
        .from(users)
        .where(eq(users.locationId, locationId))
        .where(eq(users.role, 'trainer'))
        .where(eq(users.organizationId, organizationId));

      console.log(`Found trainers for location ${locationId}:`, {
        trainerCount: trainers.length,
        trainerIds: trainers.map(t => t.id)
      });

      if (!trainers.length) {
        console.log(`No trainers found for location ${locationId}`);
        return [];
      }

      // Get LOBs from user_processes for these trainers
      const lobs = await db
        .select({
          id: organizationLineOfBusinesses.id,
          name: organizationLineOfBusinesses.name,
          description: organizationLineOfBusinesses.description,
          organizationId: organizationLineOfBusinesses.organizationId,
          createdAt: organizationLineOfBusinesses.createdAt
        })
        .from(userProcesses)
        .innerJoin(
          organizationLineOfBusinesses,
          eq(userProcesses.lineOfBusinessId, organizationLineOfBusinesses.id)
        )
        .where(eq(userProcesses.locationId, locationId))
        .where(inArray(userProcesses.userId, trainers.map(t => t.id)))
        .where(eq(organizationLineOfBusinesses.organizationId, organizationId))
        .groupBy(organizationLineOfBusinesses.id)
        .orderBy(organizationLineOfBusinesses.name) as OrganizationLineOfBusiness[];

      console.log(`Found LOBs for location ${locationId}:`, {
        count: lobs.length,
        lobs: lobs.map(lob => ({
          id: lob.id,
          name: lob.name
        }))
      });

      return lobs;
    } catch (error) {
      console.error('Error fetching LOBs by location:', error);
      throw new Error('Failed to fetch LOBs');
    }
  }
  // Batch Template operations
  async createBatchTemplate(template: InsertBatchTemplate): Promise<BatchTemplate> {
    try {
      console.log('Creating batch template with data:', {
        ...template,
        organizationId: template.organizationId
      });

      // Import from schema
      const [createdTemplate] = await db
        .insert(schema.batchTemplates)
        .values(template)
        .returning() as BatchTemplate[];

      if (!createdTemplate) {
        throw new Error('Failed to create batch template');
      }

      console.log('Batch template created successfully:', createdTemplate);
      return createdTemplate;
    } catch (error: any) {
      console.error('Error creating batch template:', error);
      throw error;
    }
  }

  async listBatchTemplates(organizationId: number): Promise<BatchTemplate[]> {
    try {
      console.log(`Listing batch templates for organization ${organizationId}`);
      
      const templates = await db
        .select()
        .from(schema.batchTemplates)
        .where(eq(schema.batchTemplates.organizationId, organizationId))
        .orderBy(schema.batchTemplates.createdAt);

      console.log(`Found ${templates.length} batch templates`);
      return templates as BatchTemplate[];
    } catch (error) {
      console.error('Error listing batch templates:', error);
      throw new Error('Failed to fetch batch templates');
    }
  }

  async getBatchTemplate(id: number): Promise<BatchTemplate | undefined> {
    try {
      console.log(`Fetching batch template with ID: ${id}`);
      const [template] = await db
        .select()
        .from(schema.batchTemplates)
        .where(eq(schema.batchTemplates.id, id)) as BatchTemplate[];

      console.log('Template found:', template);
      return template;
    } catch (error) {
      console.error('Error fetching batch template:', error);
      throw error;
    }
  }

  async deleteBatchTemplate(id: number): Promise<void> {
    try {
      console.log(`Attempting to delete batch template with ID: ${id}`);

      const result = await db
        .delete(schema.batchTemplates)
        .where(eq(schema.batchTemplates.id, id))
        .returning();

      if (!result.length) {
        throw new Error('Batch template not found or deletion failed');
      }

      console.log(`Successfully deleted batch template with ID: ${id}`);
    } catch (error) {
      console.error('Error deleting batch template:', error);
      throw error;
    }
  }
  async getBatchesByTrainer(
    trainerId: number,
    organizationId: number,
    statuses: typeof batchStatusEnum.enumValues[number][]
  ): Promise<OrganizationBatch[]> {
    try {
      console.log(`Fetching batches for trainer ${trainerId} with statuses:`, statuses);

      const batches = await db
        .select({
          id: organizationBatches.id,
          name: organizationBatches.name,
          batchCategory: sql<string>`${organizationBatches.batchCategory}::text`,
          startDate: organizationBatches.startDate,
          endDate: organizationBatches.endDate,
          status: organizationBatches.status,
          capacityLimit: organizationBatches.capacityLimit,
          locationId: organizationBatches.locationId,
          processId: organizationBatches.processId,
          lineOfBusinessId: organizationBatches.lineOfBusinessId,
          trainerId: organizationBatches.trainerId,
          organizationId: organizationBatches.organizationId,
          inductionStartDate: organizationBatches.inductionStartDate,
          inductionEndDate: organizationBatches.inductionEndDate,
          trainingStartDate: organizationBatches.trainingStartDate,
          trainingEndDate: organizationBatches.trainingEndDate,
          certificationStartDate: organizationBatches.certificationStartDate,
          certificationEndDate: organizationBatches.certificationEndDate,
          ojtStartDate: organizationBatches.ojtStartDate,
          ojtEndDate: organizationBatches.ojtEndDate,
          ojtCertificationStartDate: organizationBatches.ojtCertificationStartDate,
          ojtCertificationEndDate: organizationBatches.ojtCertificationEndDate,
          handoverToOpsDate: organizationBatches.handoverToOpsDate,
          weeklyOffDays: organizationBatches.weeklyOffDays,
          considerHolidays: organizationBatches.considerHolidays,
          createdAt: organizationBatches.createdAt,
          updatedAt: organizationBatches.updatedAt
        })
        .from(organizationBatches)
        .where(eq(organizationBatches.trainerId, trainerId))
        .where(eq(organizationBatches.organizationId, organizationId))
        .where(sql`${organizationBatches.status}::text = ANY(${sql`ARRAY[${statuses.join(',')}]`}::text[])`)
        .orderBy(desc(organizationBatches.startDate));

      console.log(`Found ${batches.length} batches for trainer ${trainerId}`);
      return batches as OrganizationBatch[];
    } catch (error) {
      console.error('Error fetching trainer batches:', error);
      throw new Error('Failed to fetch trainer batches');
    }
  }
  // User Batch Process operations
  async assignUserToBatch(userBatchProcess: {
    userId: number;
    batchId: number;
    processId: number;
    status: string;
    joinedAt: Date;
  }): Promise<UserBatchProcess> {
    try {
      const [result] = await db
        .insert(userBatchProcesses)
        .values({
          ...userBatchProcess,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning() as UserBatchProcess[];

      return result;
    } catch (error) {
      console.error('Error assigning user to batch:', error);
      throw error;
    }
  }

  async getUserBatchProcesses(userId: number): Promise<UserBatchProcess[]> {
    try {
      const processes = await db
        .select({
          id: userBatchProcesses.id,
          userId: userBatchProcesses.userId,
          batchId: userBatchProcesses.batchId,
          processId: userBatchProcesses.processId,
          status: userBatchProcesses.status,
          joinedAt: userBatchProcesses.joinedAt,
          completedAt: userBatchProcesses.completedAt,
          batchName: organizationBatches.name, 
          processName: organizationProcesses.name,
        })
        .from(userBatchProcesses)
        .leftJoin(
          organizationBatches,
          eq(userBatchProcesses.batchId, organizationBatches.id)
        )
        .leftJoin(
          organizationProcesses,
          eq(userBatchProcesses.processId, organizationProcesses.id)
        )
        .where(eq(userBatchProcesses.userId, userId)) as UserBatchProcess[];

      return processes;
    } catch (error) {
      console.error('Error fetching user batch processes:', error);
      throw error;
    }
  }

  async getBatchTrainees(batchId: number): Promise<UserBatchProcess[]> {
    try {
      console.log(`Fetching trainees for batch ${batchId}`);

      const trainees = await db
        .select({
          id: userBatchProcesses.id,
          userId: userBatchProcesses.userId,
          batchId: userBatchProcesses.batchId,
          processId: userBatchProcesses.processId,
          status: userBatchProcesses.status,
          joinedAt: userBatchProcesses.joinedAt,
          completedAt: userBatchProcesses.completedAt,
          createdAt: userBatchProcesses.createdAt,
          updatedAt: userBatchProcesses.updatedAt,
          user: {
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            email: users.email,
            employeeId: users.employeeId,
            category: users.category,
            role: users.role
          }
        })
        .from(userBatchProcesses)
        .leftJoin(users, eq(userBatchProcesses.userId, users.id))
        .where(eq(userBatchProcesses.batchId, batchId)) as UserBatchProcess[]; // Removed category filter to match enrolledCount

      console.log(`Found ${trainees.length} trainees in batch ${batchId}:`, trainees);
      return trainees;
    } catch (error) {
      console.error('Error fetching batch trainees:', error);
      throw error;
    }
  }

  async updateUserBatchStatus(
    userId: number,
    batchId: number,
    status: string
  ): Promise<UserBatchProcess> {
    try {
      const [updated] = await db
        .update(userBatchProcesses)
        .set({
          status,
          completedAt: status === 'completed' ? new Date() : null,
          updatedAt: new Date()
        })
        .where(eq(userBatchProcesses.userId, userId))
        .where(eq(userBatchProcesses.batchId, batchId))
        .returning() as UserBatchProcess[];

      if (!updated) {
        throw new Error('User batch process not found');
      }

      return updated;
    } catch (error) {
      console.error('Error updating user batch status:', error);
      throw error;
    }
  }
  async createUserProcess(process: {
    userId: number;
    processId: number;
    organizationId: number;
    lineOfBusinessId: number;
    locationId: number;
    status: string;
    assignedAt: Date;
  }): Promise<UserProcess> {
    try {
      const [result] = await db
        .insert(userProcesses)
        .values({
          ...process,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning() as UserProcess[];

      return result;
    } catch (error) {
      console.error('Error creating user process:', error);
      throw error;
    }
  }
  async updateUserBatchProcess(userId: number, oldBatchId: number, newBatchId: number): Promise<void> {
    try {
      console.log(`Transferring user ${userId} from batch ${oldBatchId} to batch ${newBatchId}`);

      // Update the user's batch process record
      await db
        .update(userBatchProcesses)
        .set({
          batchId: newBatchId,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(userBatchProcesses.userId, userId),
            eq(userBatchProcesses.batchId, oldBatchId)
          )
        );

      console.log('Successfully transferred user to new batch');
    } catch (error: any) {
      console.error('Error updating user batch process:', error);
      throw error;
    }
  }

  async removeUserFromBatch(userId: number, batchId: number): Promise<void> {
    try {
      console.log(`Removing user ${userId} from batch ${batchId}`);

      // Remove the user's batch process record
      await db
        .delete(userBatchProcesses)
        .where(
          and(
            eq(userBatchProcesses.userId, userId),
            eq(userBatchProcesses.batchId, batchId)
          )
        );

      console.log('Successfully removed user from batch');
    } catch (error: any) {
      console.error('Error removing user from batch:', error);
      throw error;
    }
  }
  async removeTraineeFromBatch(traineeId: number): Promise<void> {
    try {
      console.log(`Attempting to remove trainee ${traineeId} from batch`);

      // Find all user batch processes for this user ID
      const records = await db
        .select()
        .from(userBatchProcesses)
        .where(eq(userBatchProcesses.userId, traineeId));

      if (!records || records.length === 0) {
        throw new Error('Trainee not found in batch');
      }

      const userId = traineeId;
      console.log(`Found ${records.length} batch processes for user ID ${userId}`);

      // Use a transaction to ensure all operations succeed or none do
      await db.transaction(async (tx) => {
        // 1. Delete from user_batch_processes for this user
        await tx
          .delete(userBatchProcesses)
          .where(eq(userBatchProcesses.userId, userId))
          .execute();
        console.log(`Deleted user_batch_processes records for user ${userId}`);

        // 2. Delete from user_processes for this user
        await tx
          .delete(userProcesses)
          .where(eq(userProcesses.userId, userId))
          .execute();
        console.log(`Deleted user_processes records for user ${userId}`);

        // 3. Update user to be inactive instead of deleting
        await tx
          .update(users)
          .set({ 
            active: false,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId))
          .execute();
        console.log(`Deactivated user ${userId}`);
      });

      console.log(`Successfully removed trainee and related records`);
    } catch (error) {
      console.error('Error removing trainee from batch:', error);
      throw error;
    }
  }
  // Phase change request implementation
  async createPhaseChangeRequest(request: InsertBatchPhaseChangeRequest): Promise<BatchPhaseChangeRequest> {
    try {
      console.log('Creating phase change request:', request);

      const [newRequest] = await db
        .insert(batchPhaseChangeRequests)
        .values(request)
        .returning() as BatchPhaseChangeRequest[];

      console.log('Successfully created phase change request:', newRequest);
      return newRequest;
    } catch (error) {
      console.error('Error creating phase change request:', error);
      throw error;
    }
  }

  async getPhaseChangeRequest(id: number): Promise<BatchPhaseChangeRequest | undefined> {
    try {
      const [request] = await db
        .select()
        .from(batchPhaseChangeRequests)
        .where(eq(batchPhaseChangeRequests.id, id)) as BatchPhaseChangeRequest[];
      return request;
    } catch (error) {
      console.error('Error fetching phase change request:', error);
      throw error;
    }
  }

  async listPhaseChangeRequests(organizationId: number, status?: string): Promise<BatchPhaseChangeRequest[]> {
    try {
      let query = db
        .select()
        .from(batchPhaseChangeRequests)
        .where(eq(batchPhaseChangeRequests.organizationId, organizationId));

      if (status) {
        query = query.where(eq(batchPhaseChangeRequests.status, status));
      }

      return await query as BatchPhaseChangeRequest[];
    } catch (error) {
      console.error('Error listing phase change requests:', error);
      throw error;
    }
  }

  async updatePhaseChangeRequest(
    id: number,
    update: {
      status: string;
      managerComments?: string;
    }
  ): Promise<BatchPhaseChangeRequest> {
    try {
      console.log(`Updating phase change request ${id}:`, update);

      const [updatedRequest] = await db
        .update(batchPhaseChangeRequests)
        .set({
          ...update,
          updatedAt: new Date(),
        })
        .where(eq(batchPhaseChangeRequests.id, id))
        .returning() as BatchPhaseChangeRequest[];

      if (!updatedRequest) {
        throw new Error('Phase change request not found');
      }

      console.log('Successfully updated phase change request:', updatedRequest);
      return updatedRequest;
    } catch (error) {
      console.error('Error updating phase change request:', error);
      throw error;
    }
  }

  async listTrainerPhaseChangeRequests(trainerId: number): Promise<BatchPhaseChangeRequest[]> {
    try {
      return await db
        .select()
        .from(batchPhaseChangeRequests)
        .where(eq(batchPhaseChangeRequests.trainerId, trainerId)) as BatchPhaseChangeRequest[];
    } catch (error) {
      console.error('Error listing trainer phase change requests:', error);
      throw error;
    }
  }

  async listManagerPhaseChangeRequests(managerId: number): Promise<BatchPhaseChangeRequest[]> {
    try {
      return await db
        .select()
        .from(batchPhaseChangeRequests)
        .where(eq(batchPhaseChangeRequests.managerId, managerId)) as BatchPhaseChangeRequest[];
    } catch (error) {
      console.error('Error listing manager phase change requests:', error);
      throw error;
    }
  }
  async getReportingTrainers(managerId: number): Promise<User[]> {
    try {
      console.log(`Fetching trainers reporting to manager ${managerId}`);

      const trainers = await db
        .select()
        .from(users)
        .where(eq(users.managerId, managerId))
        .where(eq(users.role, 'trainer')) as User[];

      console.log(`Found ${trainers.length} reporting trainers`);
      return trainers;
    } catch (error) {
      console.error('Error fetching reporting trainers:', error);
      throw new Error('Failed to fetch reporting trainers');
    }
  }
  async listBatchesForTrainer(trainerId: number): Promise<OrganizationBatch[]> {
    try {
      console.log(`Fetching batches for trainer ${trainerId}`);

      const batches = await db
        .select({
          id: organizationBatches.id,
          name: organizationBatches.name,
          batchCategory: sql<string>`${organizationBatches.batchCategory}::text`,
          startDate: organizationBatches.startDate,
          endDate: organizationBatches.endDate,
          status: organizationBatches.status,
          capacityLimit: organizationBatches.capacityLimit,
          locationId: organizationBatches.locationId,
          processId: organizationBatches.processId,
          lineOfBusinessId: organizationBatches.lineOfBusinessId,
          trainerId: organizationBatches.trainerId,
          organizationId: organizationBatches.organizationId,
          inductionStartDate: organizationBatches.inductionStartDate,
          inductionEndDate: organizationBatches.inductionEndDate,
          trainingStartDate: organizationBatches.trainingStartDate,
          trainingEndDate: organizationBatches.trainingEndDate,
          certificationStartDate: organizationBatches.certificationStartDate,
          certificationEndDate: organizationBatches.certificationEndDate,
          ojtStartDate: organizationBatches.ojtStartDate,
          ojtEndDate: organizationBatches.ojtEndDate,
          ojtCertificationStartDate: organizationBatches.ojtCertificationStartDate,
          ojtCertificationEndDate: organizationBatches.ojtCertificationEndDate,
          handoverToOpsDate: organizationBatches.handoverToOpsDate,
          weeklyOffDays: organizationBatches.weeklyOffDays,
          considerHolidays: organizationBatches.considerHolidays,
          createdAt: organizationBatches.createdAt,
          updatedAt: organizationBatches.updatedAt
        })
        .from(organizationBatches)
        .where(eq(organizationBatches.trainerId, trainerId));

      console.log(`Found ${batches.length} batches for trainer ${trainerId}`);
      return batches as OrganizationBatch[];
    } catch (error) {
      console.error('Error fetching trainer batches:', error);
      throw new Error('Failed to fetch trainer batches');
    }
  }

  async listBatchesForTrainers(trainerIds: number[]): Promise<OrganizationBatch[]> {
    try {
      console.log(`Fetching batches for trainers:`, trainerIds);

      const batches = await db
        .select({
          id: organizationBatches.id,
          name: organizationBatches.name,
          batchCategory: sql<string>`${organizationBatches.batchCategory}::text`,
          startDate: organizationBatches.startDate,
          endDate: organizationBatches.endDate,
          status: organizationBatches.status,
          capacityLimit: organizationBatches.capacityLimit,
          locationId: organizationBatches.locationId,
          processId: organizationBatches.processId,
          lineOfBusinessId: organizationBatches.lineOfBusinessId,
          trainerId: organizationBatches.trainerId,
          organizationId: organizationBatches.organizationId,
          inductionStartDate: organizationBatches.inductionStartDate,
          inductionEndDate: organizationBatches.inductionEndDate,
          trainingStartDate: organizationBatches.trainingStartDate,
          trainingEndDate: organizationBatches.trainingEndDate,
          certificationStartDate: organizationBatches.certificationStartDate,
          certificationEndDate: organizationBatches.certificationEndDate,
          ojtStartDate: organizationBatches.ojtStartDate,
          ojtEndDate: organizationBatches.ojtEndDate,
          ojtCertificationStartDate: organizationBatches.ojtCertificationStartDate,
          ojtCertificationEndDate: organizationBatches.ojtCertificationEndDate,
          handoverToOpsDate: organizationBatches.handoverToOpsDate,
          weeklyOffDays: organizationBatches.weeklyOffDays,
          considerHolidays: organizationBatches.considerHolidays,
          createdAt: organizationBatches.createdAt,
          updatedAt: organizationBatches.updatedAt
        })
        .from(organizationBatches)
        .where(inArray(organizationBatches.trainerId, trainerIds));

      console.log(`Found ${batches.length} batches for trainers`);
      return batches as OrganizationBatch[];
    } catch (error) {
      console.error('Error fetching trainer batches:', error);
      throw new Error('Failed to fetch trainer batches');
    }
  }
  async listBatchHistory(batchId: number): Promise<BatchHistory[]> {
    try {
      console.log(`Fetching history for batch ${batchId}`);

      const history = await db
        .select({
          id: batchHistory.id,
          eventType: batchHistory.eventType,
          description: batchHistory.description,
          previousValue: batchHistory.previousValue,
          newValue: batchHistory.newValue,
          date: batchHistory.date,
          user: {
            id: users.id,
            fullName: users.fullName,
          },
        })
        .from(batchHistory)
        .leftJoin(users, eq(batchHistory.userId, users.id))
        .where(eq(batchHistory.batchId, batchId))
        .orderBy(desc(batchHistory.date)) as BatchHistory[];

      console.log(`Found ${history.length} history events`);
      return history;
    } catch (error) {
      console.error('Error fetching batch history:', error);
      throw new Error('Failed to fetch batch history');
    }
  }

  async createBatchHistoryEvent(event: InsertBatchHistory): Promise<BatchHistory> {
    try {
      console.log('Creating batch history event:', event);

      const [newEvent] = await db
        .insert(batchHistory)
        .values(event)
        .returning() as BatchHistory[];

      console.log('Successfully created batch history event:', newEvent);
      return newEvent;
    } catch (error) {
      console.error('Error creating batch history event:', error);
      throw error;
    }
  }
  async createQuestion(question: InsertQuestion): Promise<Question> {
    try {
      const [newQuestion] = await db
        .insert(questions)
        .values(question)
        .returning();
      return newQuestion;
    } catch (error) {
      console.error('Error creating question:', error);
      throw error;
    }
  }

  async listQuestions(organizationId: number): Promise<Question[]> {
    try {
      console.log(`Fetching all questions for organization ${organizationId}`);

      // Select all columns explicitly and use the correct table reference
      const results = await db
        .select({
          id: questions.id,
          question: questions.question,
          type: questions.type,
          options: questions.options,
          correctAnswer: questions.correctAnswer,
          explanation: questions.explanation,
          difficultyLevel: questions.difficultyLevel,
          category: questions.category,
          organizationId: questions.organizationId,
          createdBy: questions.createdBy,
          processId: questions.processId,
          createdAt: questions.createdAt,
          updatedAt: questions.updatedAt
        })
        .from(questions)
        .where(eq(questions.organizationId, organizationId)) as Question[];

      console.log(`Found ${results.length} questions`);
      return results;
    } catch (error) {
      console.error('Error fetching questions:', error);
      throw new Error(`Failed to fetch questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRandomQuestions(
    organizationId: number,
    options: {
      count: number;
      categoryDistribution?: Record<string, number>;
      difficultyDistribution?: Record<string, number>;
      processId?: number;
    }
  ): Promise<Question[]> {
    try {
      console.log('Getting random questions with options:', options);

      // Base query for questions
      let query = db
        .select()
        .from(questions)
        .where(eq(questions.organizationId, organizationId));

      if (options.processId) {
        query = query.where(eq(questions.processId, options.processId));
      }

      // First get all available questions
      const availableQuestions = await query as Question[];
      console.log(`Found ${availableQuestions.length} available questions`);

      if (availableQuestions.length === 0) {
        return [];
      }

      // If no distribution specified, randomly select required number of questions
      if (!options.categoryDistribution && !options.difficultyDistribution) {
        const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, options.count);
      }

      let selectedQuestions: Question[] = [];

      // Handle category distribution
      if (options.categoryDistribution) {
        for (const [category, count] of Object.entries(options.categoryDistribution)) {
          const categoryQuestions = availableQuestions.filter(q => q.category === category);
          const shuffled = [...categoryQuestions].sort(() => Math.random() - 0.5);
          selectedQuestions.push(...shuffled.slice(0, count));
        }
      }

      // Handle difficulty distribution
      if (options.difficultyDistribution) {
        const remainingCount = options.count - selectedQuestions.length;
        if (remainingCount > 0) {
          for (const [difficulty, count] of Object.entries(options.difficultyDistribution)) {
            const difficultyQuestions = availableQuestions.filter(
              q => q.difficultyLevel === parseInt(difficulty) &&
                !selectedQuestions.find(selected => selected.id === q.id)
            );
            const shuffled = [...difficultyQuestions].sort(() => Math.random() - 0.5);
            selectedQuestions.push(...shuffled.slice(0, count));
          }
        }
      }

      // If we still need more questions to meet the count
      const remainingCount = options.count - selectedQuestions.length;
      if (remainingCount > 0) {
        const remainingQuestions = availableQuestions.filter(
          q => !selectedQuestions.find(selected => selected.id === q.id)
        );
        const shuffled = [...remainingQuestions].sort(() => Math.random() - 0.5);
        selectedQuestions.push(...shuffled.slice(0, remainingCount));
      }

      console.log(`Selected ${selectedQuestions.length} random questions`);

      // If we couldn't get enough questions, return empty array to trigger error
      if (selectedQuestions.length < options.count) {
        console.log('Not enough questions available matching the criteria');
        return [];
      }

      return selectedQuestions;
    } catch (error) {
      console.error('Error getting random questions:', error);
      throw error;
    }
  }
  async listQuestionsByProcess(organizationId: number, processId: number): Promise<Question[]> {
    try {
      console.log(`Fetching questions for organization ${organizationId} and process ${processId}`);

      const results = await db
        .select()
        .from(questions)
        .where(
          and(
            eq(questions.organizationId, organizationId),
            eq(questions.processId, processId)
          )
        ) as Question[];

      console.log(`Found ${results.length} questions for process ${processId}`);
      return results;
    } catch (error) {
      console.error('Error fetching questions by process:', error);
      throw new Error(`Failed to fetch questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async updateQuestion(id: number, question: Partial<Question>): Promise<Question> {
    try {
      const [updatedQuestion] = await db
        .update(questions)
        .set(question)
        .where(eq(questions.id, id))
        .returning();
      return updatedQuestion;
    } catch (error) {
      console.error('Error updating question:', error);
      throw error;
    }
  }

  async deleteQuestion(id: number): Promise<void> {
    try {
      await db
        .delete(questions)
        .where(eq(questions.id, id));
    } catch (error) {
      console.error('Error deleting question:', error);
      throw error;
    }
  }
  async getQuestionById(id: number): Promise<Question | undefined> {
    try {
      const result = await db
        .select()
        .from(questions)
        .where(eq(questions.id, id));
      return result[0];
    } catch (error) {
      console.error('Error fetching question:', error);
      throw error;
    }
  }
  // Quiz template operations
  async createQuizTemplate(template: InsertQuizTemplate): Promise<QuizTemplate> {
    try {
      const [newTemplate] = await db
        .insert(quizTemplates)
        .values(template)
        .returning();
      return newTemplate;    
    } catch (error) {
      console.error('Error creating quiz template:', error);
      throw error;
    }
  }

  async listQuizTemplates(organizationId: number, processId?: number): Promise<QuizTemplate[]> {
    try {
      let baseQuery = db
        .select()
        .from(quizTemplates)
        .where(eq(quizTemplates.organizationId, organizationId));

      if (processId) {
        baseQuery = baseQuery.where(eq(quizTemplates.processId, processId));
      }

      return await baseQuery as QuizTemplate[];
    } catch (error) {
      console.error('Error listing quiz templates:', error);
      throw new Error('Failed to list quiz templates');
    }
  }

  async getQuizTemplate(id: number): Promise<QuizTemplate | undefined> {
    try {
      const result = await db
        .select()
        .from(quizTemplates)
        .where(eq(quizTemplates.id, id));
      return result[0];
    } catch (error) {
      console.error('Error fetching quiz template:', error);
      throw error;
    }
  }

  async updateQuizTemplate(id: number, template: Partial<InsertQuizTemplate>): Promise<QuizTemplate> {
    try {
      console.log(`Updating quiz template with ID: ${id}`, template);

      const [updatedTemplate] = await db
        .update(quizTemplates)
        .set({
          ...template,
          updatedAt: new Date()
        })
        .where(eq(quizTemplates.id, id))
        .returning() as QuizTemplate[];

      if (!updatedTemplate) {
        throw new Error('Quiz template not found');
      }

      console.log('Successfully updated quiz template:', updatedTemplate);
      return updatedTemplate;
    } catch (error) {
      console.error('Error updating quiz template:', error);
      throw error;
    }
  }

  async deleteQuizTemplate(id: number): Promise<void> {
    try {
      console.log(`Attempting to delete quiz template with ID: ${id}`);

      // First verify the template exists
      const template = await this.getQuizTemplate(id);
      if (!template) {
        throw new Error('Quiz template not found');
      }

      // Delete the template directly - we want to keep quiz responses
      const result = await db
        .delete(quizTemplates)
        .where(eq(quizTemplates.id, id))
        .returning();

      if (!result.length) {
        throw new Error('Quiz template deletion failed');
      }

      console.log(`Successfully deleted quiz template with ID: ${id}`);
    } catch (error) {
      console.error('Error deleting quiz template:', error);
      throw error;
    }
  }
  async createQuiz(quiz: InsertQuiz): Promise<Quiz> {
    try {
      console.log('Creating quiz:', quiz);

      // Validate quiz data
      if (!quiz.questions || quiz.questions.length === 0) {
        throw new Error('Quiz must have at least one question');
      }

      const [newQuiz] = await db
        .insert(quizzes)
        .values({
          ...quiz,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning() as Quiz[];

      console.log('Successfully created quiz:', newQuiz);
      return newQuiz;
    } catch (error) {
      console.error('Error creating quiz:', error);
      throw error;
    }
  }
  
  async getQuizzesByTemplateId(templateId: number): Promise<Quiz[]> {
    try {
      // Query all quizzes that were generated from a specific template
      const results = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.templateId, templateId))
        .orderBy(desc(quizzes.startTime)) as Quiz[];
        
      console.log(`Found ${results.length} quizzes for template ${templateId}`);
      return results;
    } catch (error) {
      console.error('Error fetching quizzes by template:', error);
      throw new Error(`Failed to fetch quizzes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getQuizWithQuestions(id: number): Promise<Quiz | undefined> {
    try {
      // First get the quiz
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, id)) as Quiz[];

      if (!quiz) {
        console.log(`No quiz found with ID: ${id}`);
        return undefined;
      }

      console.log('Found quiz:', quiz);

      // Get all questions from the quiz's question array
      const questionsList = await db
        .select()
        .from(questions)
        .where(inArray(questions.id, quiz.questions || [])) as Question[];

      console.log(`Found ${questionsList.length} questions for quiz ${id}`);

      // Return quiz with questions
      return {
        ...quiz,
        questions: questionsList
      };

    } catch (error) {
      console.error('Error fetching quiz with questions:', error);
      throw error;
    }
  }

  async getQuizAttempt(id: number): Promise<QuizAttempt | undefined> {
    try {
      console.log("Fetching quiz attempt with ID:", id);

      // Get the quiz attempt with basic quiz info
      const result = await db
        .select({
          id: quizAttempts.id,
          score: quizAttempts.score,
          completedAt: quizAttempts.completedAt,
          quiz: {
            id: quizzes.id,
            name: quizzes.name,
            description: quizzes.description
          }
        })
        .from(quizAttempts)
        .leftJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
        .where(eq(quizAttempts.id, id));

      if (!result.length) {
        console.log("No quiz attempt found for ID:", id);
        return undefined;
      }

      const attempt = result[0];
      console.log("Found quiz attempt:", attempt);

      // Get the responses for this attempt
      const responses = await db
        .select({
          id: quizResponses.id,
          questionId: quizResponses.questionId,
          selectedAnswer: quizResponses.selectedAnswer,
          isCorrect: quizResponses.isCorrect
        })
        .from(quizResponses)
        .where(eq(quizResponses.quizAttemptId, id));

      console.log("Found responses:", responses);

      return {
        id: attempt.id,
        score: attempt.score,
        completedAt: attempt.completedAt.toISOString(),
        quiz: {
          name: attempt.quiz.name,
          description: attempt.quiz.description
        },
        responses: responses
      };
    } catch (error) {
      console.error("Error in getQuizAttempt:", error);
      throw new Error("Failed to fetch quiz attempt");
    }
  }

  async getBatchQuizAttempts(batchId: number): Promise<QuizAttempt[]> {
    try {
      console.log("Fetching quiz attempts for batch ID:", batchId);

      // First, get the users (trainees) associated with this batch
      const batchTrainees = await db
        .select({ 
          userId: userBatchProcesses.userId 
        })
        .from(userBatchProcesses)
        .where(eq(userBatchProcesses.batchId, batchId));

      if (!batchTrainees.length) {
        console.log("No trainees found for batch ID:", batchId);
        return [];
      }

      const traineeIds = batchTrainees.map(trainee => trainee.userId);
      console.log("Found trainee IDs:", traineeIds);

      // Now get quiz attempts for these users
      const attempts = await db
        .select({
          id: quizAttempts.id,
          userId: quizAttempts.userId,
          score: quizAttempts.score,
          completedAt: quizAttempts.completedAt,
          quizId: quizAttempts.quizId,
          quizName: quizzes.name,
          quizDescription: quizzes.description,
          passingScore: quizzes.passingScore,
          userName: users.fullName,
          passingScore: quizzes.passingScore
        })
        .from(quizAttempts)
        .leftJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
        .leftJoin(users, eq(quizAttempts.userId, users.id))
        .where(inArray(quizAttempts.userId, traineeIds))
        .orderBy(desc(quizAttempts.completedAt));

      console.log(`Found ${attempts.length} quiz attempts for batch ${batchId}`);

      // Transform the results to match the expected format
      return attempts.map(attempt => ({
        id: attempt.id,
        userId: attempt.userId,
        score: attempt.score,
        completedAt: attempt.completedAt.toISOString(),
        isPassed: attempt.score >= attempt.passingScore,
        quiz: {
          id: attempt.quizId,
          name: attempt.quizName,
          description: attempt.quizDescription,
          passingScore: attempt.passingScore
        },
        user: {
          fullName: attempt.userName
        }
      }));
    } catch (error) {
      console.error("Error in getBatchQuizAttempts:", error);
      throw new Error("Failed to fetch quiz attempts for batch");
    }
  }

  async createQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt> {
    try {
      console.log('Creating quiz attempt:', attempt);

      // Calculate the score based on correct answers
      let correctCount = 0;
      attempt.answers.forEach(answer => {
        if (answer.isCorrect) {
          correctCount++;
        }
      });

      const score = (correctCount / attempt.answers.length) * 100;

      // Start a transaction to create both attempt and responses
      return await db.transaction(async (tx) => {
        // Create the attempt first
        const [newAttempt] = await tx
          .insert(quizAttempts)
          .values({
            quizId: attempt.quizId,
            userId: attempt.userId,
            organizationId: attempt.organizationId,
            score,
            status: 'completed',
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning() as QuizAttempt[];

        console.log('Created quiz attempt:', newAttempt);

        // Create individual responses for each answer
        const responseValues = attempt.answers.map(answer => ({
          quizAttemptId: newAttempt.id,
          questionId: answer.questionId,
          selectedAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect,
          createdAt: new Date()
        }));

        await tx
          .insert(quizResponses)
          .values(responseValues);

        console.log('Created quiz responses for attempt:', newAttempt.id);
        return newAttempt;
      });
    } catch (error) {
      console.error('Error creating quiz attempt:', error);
      throw error;
    }
  }

  async createQuizResponse(response: InsertQuizResponse): Promise<QuizResponse> {
    try {
      const [newResponse] = await db
        .insert(quizResponses)
        .values(response)
        .returning() as QuizResponse[];
      return newResponse;
    } catch (error) {
      console.error('Error creating quiz response:', error);
      throw error;
    }
  }

  async getQuizResponses(quizAttemptId: number): Promise<QuizResponse[]> {
    try {
      return await db
        .select()
        .from(quizResponses)
        .where(eq(quizResponses.quizAttemptId, quizAttemptId)) as QuizResponse[];
    } catch (error) {
      console.error('Error fetching quiz responses:', error);
      throw error;
    }
  }
  async getBatchTrainees(batchId: number): Promise<UserBatchProcess[]> {
    try {
      console.log(`Fetching trainees for batch ${batchId}`);

      const trainees = await db
        .select({
          id: userBatchProcesses.id,
          userId: userBatchProcesses.userId,
          batchId: userBatchProcesses.batchId,
          processId: userBatchProcesses.processId,
          status: userBatchProcesses.status,
          joinedAt: userBatchProcesses.joinedAt,
          completedAt: userBatchProcesses.completedAt,
          createdAt: userBatchProcesses.createdAt,
          updatedAt: userBatchProcesses.updatedAt,
          user: {
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            email: users.email,
            employeeId: users.employeeId,
            category: users.category,
            role: users.role
          }
        })
        .from(userBatchProcesses)
        .leftJoin(users, eq(userBatchProcesses.userId, users.id))
        .where(eq(userBatchProcesses.batchId, batchId)) as UserBatchProcess[]; // Removed category filter to match enrolledCount

      console.log(`Found ${trainees.length} trainees in batch ${batchId}:`, trainees);
      return trainees;
    } catch (error) {
      console.error('Error fetching batch trainees:', error);
      throw error;
    }
  }


  async getQuiz(id: number): Promise<Quiz | undefined> {
    try {
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, id)) as Quiz[];
      return quiz;
    } catch (error) {
      console.error('Error fetching quiz:', error);
      throw error;
    }
  }
  
  async getQuizzesByTemplateId(templateId: number): Promise<Quiz[]> {
    try {
      const quizList = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.templateId, templateId)) as Quiz[];
      return quizList;
    } catch (error) {
      console.error('Error fetching quizzes by template ID:', error);
      throw error;
    }
  }
  async deleteQuizzesByTemplateId(templateId: number): Promise<void> {
    try {
      console.log(`Starting deletion of all data for quiz template ID: ${templateId}`);

      await db.transaction(async (tx) => {
        // Step 1: Get all quiz IDs for this template
        const quizIds = await tx
          .select({ id: quizzes.id })
          .from(quizzes)
          .where(eq(quizzes.templateId, templateId))
          .then(results => results.map(r => r.id));

        console.log(`Found ${quizIds.length} quizzes to delete for template ${templateId}`);

        if (quizIds.length > 0) {
          // Step 2: Get all quiz attempt IDs
          const attemptIds = await tx
            .select({ id: quizAttempts.id })
            .from(quizAttempts)
            .where(inArray(quizAttempts.quizId, quizIds))
            .then(results => results.map(r => r.id));

          console.log(`Found ${attemptIds.length} quiz attempts to delete`);

          // Step 3: Delete quiz responses
          if (attemptIds.length > 0) {
            await tx
              .delete(quizResponses)
              .where(inArray(quizResponses.quizAttemptId, attemptIds));
            console.log('Deleted quiz responses');
          }

          // Step 4: Delete quiz attempts
          await tx
            .delete(quizAttempts)
            .where(inArray(quizAttempts.quizId, quizIds));
          console.log('Deleted quiz attempts');

          // Step 5: Delete quizzes
          await tx
            .delete(quizzes)
            .where(eq(quizzes.templateId, templateId));
          console.log('Deleted quizzes');
        }

        // Step 6: Finally delete the template
        const result = await tx
          .delete(quizTemplates)
          .where(eq(quizTemplates.id, templateId))
          .returning();

        if (!result.length) {
          throw new Error('Quiz template not found');
        }

        console.log(`Successfully deleted quiz template ${templateId} and all related data`);
      });
    } catch (error) {
      console.error('Error in deleteQuizzesByTemplateId:', error);
      throw error;
    }
  }

  // Add new method for deleting quizzes by template ID

  // Mock Call Scenario operations
  async createMockCallScenario(scenario: InsertMockCallScenario): Promise<MockCallScenario> {
    try {
      console.log('Creating mock call scenario:', scenario);
      const [newScenario] = await db
        .insert(mockCallScenarios)
        .values(scenario)
        .returning() as MockCallScenario[];

      console.log('Created mock call scenario:', newScenario);
      return newScenario;
    } catch (error) {
      console.error('Error creating mock call scenario:', error);
      throw error;
    }
  }

  async getMockCallScenario(id: number): Promise<MockCallScenario | undefined> {
    const [scenario] = await db
      .select()
      .from(mockCallScenarios)
      .where(eq(mockCallScenarios.id, id)) as MockCallScenario[];
    return scenario;
  }

  async listMockCallScenarios(organizationId: number): Promise<MockCallScenario[]> {
    return await db
      .select()
      .from(mockCallScenarios)
      .where(eq(mockCallScenarios.organizationId, organizationId)) as MockCallScenario[];
  }

  async createMockCallAttempt(attempt: InsertMockCallAttempt): Promise<MockCallAttempt> {
    try {
      // Convert the string date to a proper Date object
      const formattedAttempt = {
        ...attempt,
        startedAt: new Date(attempt.startedAt),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [newAttempt] = await db
        .insert(mockCallAttempts)
        .values(formattedAttempt)
        .returning() as MockCallAttempt[];

      console.log('Created mock call attempt:', newAttempt);
      return newAttempt;
    } catch (error) {
      console.error('Error creating mock call attempt:', error);
      throw error;
    }
  }

  // Evaluation Template operations
  async createEvaluationTemplate(template: InsertEvaluationTemplate): Promise<EvaluationTemplate> {
    try {
      console.log('Creating evaluation template:', template);
      const [newTemplate] = await db
        .insert(evaluationTemplates)
        .values(template)
        .returning() as EvaluationTemplate[];

      console.log('Created evaluation template:', newTemplate);
      return newTemplate;
    } catch (error) {
      console.error('Error creating evaluation template:', error);
      throw error;
    }
  }

  async getEvaluationTemplate(id: number): Promise<EvaluationTemplate | undefined> {
    try {
      const [template] = await db
        .select()
        .from(evaluationTemplates)
        .where(eq(evaluationTemplates.id, id)) as EvaluationTemplate[];

      return template;
    } catch (error) {
      console.error('Error fetching evaluation template:', error);
      throw error;
    }
  }

  async getEvaluationTemplateWithDetails(id: number): Promise<EvaluationTemplate & {
    pillars: (EvaluationPillar & {
      parameters: EvaluationParameter[];
    })[];
  } | undefined> {
    try {
      // First get the template
      const template = await this.getEvaluationTemplate(id);
      if (!template) return undefined;

      // Get pillars for this template
      const pillars = await db
        .select()
        .from(evaluationPillars)
        .where(eq(evaluationPillars.templateId, id))
        .orderBy(evaluationPillars.orderIndex) as EvaluationPillar[];

      // Get parameters for all pillars
      const parameters = await db
        .select()
        .from(evaluationParameters)
        .where(inArray(evaluationParameters.pillarId, pillars.map(p => p.id)))
        .orderBy(evaluationParameters.orderIndex) as EvaluationParameter[];

      // Group parameters by pillar
      const pillarsWithParams = pillars.map(pillar => ({
        ...pillar,
        parameters: parameters.filter(param => param.pillarId === pillar.id)
      }));

      return {
        ...template,
        pillars: pillarsWithParams
      };
    } catch (error) {
      console.error('Error fetching evaluation template with details:', error);
      throw error;
    }
  }

  async listEvaluationTemplates(organizationId: number): Promise<EvaluationTemplate[]> {
    try {
      const templates = await db
        .select()
        .from(evaluationTemplates)
        .where(eq(evaluationTemplates.organizationId, organizationId)) as EvaluationTemplate[];

      console.log(`Found ${templates.length} evaluation templates`);
      return templates;
    } catch (error) {
      console.error('Error listing evaluation templates:', error);
      throw error;
    }
  }

  async createEvaluationPillar(pillar: InsertEvaluationPillar): Promise<EvaluationPillar> {
    try {
      // Get current max order index
      const existingPillars = await db
        .select()
        .from(evaluationPillars)
        .where(eq(evaluationPillars.templateId, pillar.templateId));

      const orderIndex = existingPillars.length;

      const [newPillar] = await db
        .insert(evaluationPillars)
        .values({
          ...pillar,
          orderIndex
        })
        .returning() as EvaluationPillar[];

      return newPillar;
    } catch (error) {
      console.error('Error creating evaluation pillar:', error);
      throw error;
    }
  }

  async getEvaluationPillar(id: number): Promise<EvaluationPillar | undefined> {
    try {
      const [pillar] = await db
        .select()
        .from(evaluationPillars)
        .where(eq(evaluationPillars.id, id)) as EvaluationPillar[];

      return pillar;
    } catch (error) {
      console.error('Error fetching evaluation pillar:', error);
      throw error;
    }
  }

  async createEvaluationParameter(parameter: InsertEvaluationParameter): Promise<EvaluationParameter> {
    try {
      // Get current max order index
      const existingParameters = await db
        .select()
        .from(evaluationParameters)
        .where(eq(evaluationParameters.pillarId, parameter.pillarId));

      const orderIndex = existingParameters.length;

      const [newParameter] = await db
        .insert(evaluationParameters)
        .values({
          ...parameter,
          orderIndex
        })
        .returning() as EvaluationParameter[];

      return newParameter;
    } catch (error) {
      console.error('Error creating evaluation parameter:', error);
      throw error;
    }
  }

  async getEvaluationParameter(id: number): Promise<EvaluationParameter | undefined> {
    try {
      const [parameter] = await db
        .select()
        .from(evaluationParameters)
        .where(eq(evaluationParameters.id, id)) as EvaluationParameter[];

      return parameter;
    } catch (error) {
      console.error('Error fetching evaluation parameter:', error);
      throw error;
    }
  }

  async updateEvaluationPillar(id: number, pillar: Partial<InsertEvaluationPillar>): Promise<EvaluationPillar> {
    try {
      const [updatedPillar] = await db
        .update(evaluationPillars)
        .set({
          ...pillar,
          updatedAt: new Date()
        })
        .where(eq(evaluationPillars.id, id))
        .returning() as EvaluationPillar[];

      return updatedPillar;
    } catch (error) {
      console.error('Error updating evaluation pillar:', error);
      throw error;
    }
  }

  async deleteEvaluationPillar(id: number): Promise<void> {
    try {
      // Delete all parameters associated with this pillar first
      await db
        .delete(evaluationParameters)
        .where(eq(evaluationParameters.pillarId, id));

      // Then delete the pillar
      await db
        .delete(evaluationPillars)
        .where(eq(evaluationPillars.id, id));
    } catch (error) {
      console.error('Error deleting evaluation pillar:', error);
      throw error;
    }
  }

  async updateEvaluationParameter(id: number, parameter: Partial<InsertEvaluationParameter>): Promise<EvaluationParameter> {
    try {
      const [updatedParameter] = await db
        .update(evaluationParameters)
        .set({
          ...parameter,
          updatedAt: new Date()
        })
        .where(eq(evaluationParameters.id, id))
        .returning() as EvaluationParameter[];

      return updatedParameter;
    } catch (error) {
      console.error('Error updating evaluation parameter:', error);
      throw error;
    }
  }

  async deleteEvaluationParameter(id: number): Promise<void> {
    try {
      await db
        .delete(evaluationParameters)
        .where(eq(evaluationParameters.id, id));
    } catch (error) {
      console.error('Error deleting evaluation parameter:', error);
      throw error;
    }
  }

  // Attendance operations
  async createAttendanceRecord(attendanceData: {
    traineeId: number;
    status: string;
    date: string;
    markedById: number;
    organizationId: number;
    batchId?: number;
    phase?: string;
  }): Promise<any> {
    try {
      console.log('Creating attendance record:', attendanceData);

      // Get batch ID if not provided
      let batchId = attendanceData.batchId;
      let phase = attendanceData.phase;

      if (!batchId) {
        // Get trainee's active batch
        const userBatches = await db
          .select()
          .from(userBatchProcesses)
          .where(and(
            eq(userBatchProcesses.userId, attendanceData.traineeId),
            eq(userBatchProcesses.status, 'active')
          ));

        if (userBatches.length === 0) {
          throw new Error('Trainee is not assigned to any active batch');
        }

        const batch = await this.getBatch(userBatches[0].batchId);
        if (!batch) {
          throw new Error('Batch not found');
        }

        batchId = batch.id;
        phase = batch.status;
      }

      // Check for existing record
      const existingRecords = await db
        .select()
        .from(attendance)
        .where(and(
          eq(attendance.traineeId, attendanceData.traineeId),
          eq(attendance.date, attendanceData.date),
          eq(attendance.batchId, batchId as number)
        ));

      if (existingRecords.length > 0) {
        // Update existing record
        const [updatedRecord] = await db
          .update(attendance)
          .set({
            status: attendanceData.status as any,
            markedById: attendanceData.markedById,
            updatedAt: new Date()
          })
          .where(eq(attendance.id, existingRecords[0].id))
          .returning();

        console.log('Updated attendance record:', updatedRecord);
        return updatedRecord;
      }

      // Create new record
      const [newRecord] = await db
        .insert(attendance)
        .values({
          traineeId: attendanceData.traineeId,
          batchId: batchId as number,
          phase: phase as any,
          status: attendanceData.status as any,
          date: attendanceData.date,
          markedById: attendanceData.markedById,
          organizationId: attendanceData.organizationId
        })
        .returning();

      console.log('Created attendance record:', newRecord);
      return newRecord;
    } catch (error) {
      console.error('Error creating attendance record:', error);
      throw error;
    }
  }

  async getAttendanceRecord(traineeId: number, date: string): Promise<any> {
    try {
      console.log(`Fetching attendance for trainee ${traineeId} on ${date}`);
      
      const records = await db
        .select()
        .from(attendance)
        .where(and(
          eq(attendance.traineeId, traineeId),
          eq(attendance.date, date)
        ));

      // Return the first record found, or null if none exist
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      console.error('Error fetching attendance record:', error);
      throw error;
    }
  }

  async getBatchAttendanceOverview(organizationId: number, options?: { 
    batchIds?: number[]; 
    dateRange?: { from: string; to: string };
  }): Promise<{ 
    presentCount: number;
    absentCount: number;
    lateCount: number;
    leaveCount: number;
    attendanceRate: number;
  }> {
    try {
      console.log('Fetching attendance overview with options:', options);
      
      // Execute the query and get all attendance records
      let query = db
        .select()
        .from(attendance)
        .where(eq(attendance.organizationId, organizationId));
      
      // Add batch filter if provided
      if (options?.batchIds && options.batchIds.length > 0) {
        query = query.where(inArray(attendance.batchId, options.batchIds));
      }
      
      // Add date range filter if provided
      if (options?.dateRange) {
        query = query.where(
          and(
            gte(attendance.date, options.dateRange.from),
            lte(attendance.date, options.dateRange.to)
          )
        );
      }
      
      const records = await query;
      
      // Count occurrences by status
      const presentCount = records.filter(r => r.status === 'present').length;
      const absentCount = records.filter(r => r.status === 'absent').length;
      const lateCount = records.filter(r => r.status === 'late').length;
      const leaveCount = records.filter(r => r.status === 'leave').length;
      
      // Calculate attendance rate
      const totalCount = presentCount + absentCount + lateCount + leaveCount;
      const attendanceRate = totalCount > 0 
        ? Math.round((presentCount / totalCount) * 100) 
        : 0;
      
      return {
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        attendanceRate
      };
    } catch (error) {
      console.error('Error getting attendance overview:', error);
      throw error;
    }
  }

  async getBatchTrainee(batchId: number, userId: number): Promise<UserBatchProcess | null> {
    try {
      console.log(`Fetching trainee ${userId} for batch ${batchId}`);

      const [trainee] = await db
        .select({
          id: userBatchProcesses.id,
          userId: userBatchProcesses.userId,
          batchId: userBatchProcesses.batchId,
          processId: userBatchProcesses.processId,
          status: userBatchProcesses.status,
          joinedAt: userBatchProcesses.joinedAt,
          completedAt: userBatchProcesses.completedAt,
          batchName: batch.name,
          processName: organizationProcesses.name,
        })
        .from(userBatchProcesses)
        .leftJoin(
          batch,
          eq(userBatchProcesses.batchId, batch.id)
        )
        .leftJoin(
          organizationProcesses,
          eq(userBatchProcesses.processId, organizationProcesses.id)
        )
        .where(
          and(
            eq(userBatchProcesses.batchId, batchId),
            eq(userBatchProcesses.userId, userId)
          )
        ) as any[];

      return trainee || null;
    } catch (error) {
      console.error(`Error fetching trainee ${userId} for batch ${batchId}:`, error);
      throw error;
    }
  }

  async createBatchEvent(event: {
    organizationId: number;
    batchId: number;
    userId: number;
    eventType: "phase_change" | "status_update" | "milestone" | "note";
    description: string;
    date: string;
    previousValue?: string;
    newValue?: string;
  }): Promise<any> {
    try {
      console.log('Creating batch event:', event);
      
      const [newEvent] = await db
        .insert(batchHistory)
        .values({
          ...event,
          createdAt: new Date()
        })
        .returning() as any[];
        
      return newEvent;
    } catch (error) {
      console.error('Error creating batch event:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();