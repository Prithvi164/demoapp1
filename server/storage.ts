import { eq, inArray, sql, desc, and, or, isNotNull, count, gt, gte, lte, between, ne } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import { batchStatusEnum, attendance, permissionEnum } from "@shared/schema";
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
  evaluationFeedback,
  quizAssignments,
  userDashboards,
  dashboardWidgets,
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
  type UserDashboard,
  type InsertUserDashboard,
  type DashboardWidget,
  type InsertDashboardWidget,
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
  type InsertEvaluationScore,
  type EvaluationFeedback,
  type InsertEvaluationFeedback,
  type QuizAssignment,
  type InsertQuizAssignment
} from "@shared/schema";

// Add to IStorage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Batch Events operations
  getBatchEvents(batchId: number, filters?: {
    eventType?: string;
    status?: string;
    organizationId?: number;
  }): Promise<any[]>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  updateUserPassword(email: string, hashedPassword: string): Promise<void>;
  deleteUser(id: number): Promise<void>;
  listUsers(organizationId: number): Promise<User[]>;
  countUsers(organizationId: number): Promise<number>;
  
  // Permission operations
  getUserPermissions(userId: number): Promise<string[]>;
  
  // Password reset operations
  createPasswordResetToken(email: string, token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  resetPassword(token: string, hashedPassword: string): Promise<boolean>;
  
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
  getUserProcessIds(userId: number): Promise<number[]>;
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
  resetRolePermissionsToDefault(organizationId: number, role: string): Promise<RolePermission>;
  getUserPermissions(userId: number): Promise<string[]>;

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
  updateTraineeStatus(
    userBatchProcessId: number, 
    traineeStatus: string | null, 
    isManualStatus: boolean
  ): Promise<UserBatchProcess>;

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
  deletePhaseChangeRequest(id: number): Promise<void>;

  // Add new method for getting reporting trainers
  getReportingTrainers(managerId: number): Promise<User[]>;

  // Dashboard operations
  getUserDashboards(userId: number): Promise<schema.UserDashboard[]>;
  createUserDashboard(dashboard: schema.InsertUserDashboard): Promise<schema.UserDashboard>;
  getUserDashboard(id: number): Promise<schema.UserDashboard | undefined>;
  updateUserDashboard(id: number, dashboard: Partial<schema.InsertUserDashboard>): Promise<schema.UserDashboard>;
  deleteUserDashboard(id: number): Promise<void>;
  setDefaultDashboard(userId: number, dashboardId: number): Promise<void>;
  
  // Dashboard widget operations
  getDashboardWidgets(dashboardId: number): Promise<schema.DashboardWidget[]>;
  createDashboardWidget(widget: schema.InsertDashboardWidget): Promise<schema.DashboardWidget>;
  updateDashboardWidget(id: number, widget: Partial<schema.InsertDashboardWidget>): Promise<schema.DashboardWidget>;
  deleteDashboardWidget(id: number): Promise<void>;

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
  listQuestions(organizationId: number, includeInactive?: boolean): Promise<Question[]>;
  getRandomQuestions(
    organizationId: number,
    options: {
      count: number;
      categoryDistribution?: Record<string, number>;
      difficultyDistribution?: Record<string, number>;
      processId?: number;
    }
  ): Promise<Question[]>;
  listQuestionsByProcess(organizationId: number, processId: number, includeInactive?: boolean): Promise<Question[]>;
  updateQuestion(id: number, question: Partial<Question>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;
  getQuestionById(id: number): Promise<Question | undefined>;

  // Quiz operations
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  getQuizWithQuestions(id: number): Promise<Quiz | undefined>;
  createQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt>;
  getQuizAttempt(id: number): Promise<QuizAttempt | undefined>;
  getQuizAttemptsByUser(userId: number, quizId: number): Promise<QuizAttempt[]>;
  getBatchQuizAttempts(batchId: number): Promise<QuizAttempt[]>;

  // Add new methods for quiz responses
  createQuizResponse(response: InsertQuizResponse): Promise<QuizResponse>;
  getQuizResponses(quizAttemptId: number): Promise<QuizResponse[]>;

  // Quiz Assignment functions for trainee-specific quiz assignments
  createQuizAssignment(assignment: InsertQuizAssignment): Promise<QuizAssignment>;
  getQuizAssignments(quizId: number): Promise<QuizAssignment[]>;
  getQuizAssignmentsByUser(userId: number): Promise<QuizAssignment[]>;
  getQuizAssignmentByUserAndQuiz(userId: number, quizId: number): Promise<QuizAssignment | undefined>;
  listTraineesForQuiz(quizId: number, batchId: number): Promise<{ userId: number; fullName: string }[]>;
  deleteQuizAssignment(id: number): Promise<void>;
  
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
  getEvaluation(id: number): Promise<Evaluation | undefined>;
  getEvaluationWithScores(id: number): Promise<Evaluation & { scores: EvaluationScore[] } | undefined>;
  listEvaluations(filters: { organizationId: number, traineeId?: number, evaluatorId?: number, batchId?: number }): Promise<Evaluation[]>;
  getEvaluationsByBatchAndType(batchId: number, evaluationType: string): Promise<Evaluation[]>;
  
  // Evaluation Feedback operations
  createEvaluationFeedback(feedback: InsertEvaluationFeedback): Promise<EvaluationFeedback>;
  getEvaluationFeedbackByEvaluationId(evaluationId: number): Promise<EvaluationFeedback | undefined>;
  getEvaluationFeedback(id: number): Promise<EvaluationFeedback | undefined>;
  updateEvaluationFeedback(id: number, feedback: Partial<InsertEvaluationFeedback>): Promise<EvaluationFeedback>;
  getPendingEvaluationFeedback(agentId: number): Promise<(EvaluationFeedback & { evaluation: Evaluation })[]>;
  getPendingApprovalEvaluationFeedback(reportingHeadId: number): Promise<(EvaluationFeedback & { evaluation: Evaluation })[]>;

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
  
  // Get day-by-day attendance history for a specific batch
  getBatchAttendanceHistory(organizationId: number, batchId: number): Promise<{
    date: string;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    leaveCount: number;
    attendanceRate: number;
    totalTrainees: number;
  }[]>;
  
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
  
  // Dashboard Configuration operations
  getDashboardConfiguration(id: number): Promise<schema.DashboardConfiguration | undefined>;
  getDashboardConfigurationsByUser(userId: number, organizationId: number): Promise<schema.DashboardConfiguration[]>;
  getDefaultDashboardConfiguration(userId: number, organizationId: number): Promise<schema.DashboardConfiguration | undefined>;
  createDashboardConfiguration(config: schema.InsertDashboardConfiguration): Promise<schema.DashboardConfiguration>;
  updateDashboardConfiguration(id: number, config: Partial<schema.InsertDashboardConfiguration>): Promise<schema.DashboardConfiguration>;
  deleteDashboardConfiguration(id: number): Promise<void>;
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
    page?: number;
    limit?: number;
  }): Promise<{ files: AudioFile[]; total: number }> {
    try {
      // Set default pagination values
      const page = filters?.page || 1;
      const limit = filters?.limit || 100; // Default to 100 items per page
      const offset = (page - 1) * limit;
      
      // Build query for counting total results
      let countQuery = db
        .select({ count: sql`count(*)` })
        .from(audioFiles)
        .where(eq(audioFiles.organizationId, organizationId));
        
      // Build main query for fetching paginated data
      let query = db
        .select()
        .from(audioFiles)
        .where(eq(audioFiles.organizationId, organizationId))
        .limit(limit)
        .offset(offset)
        .orderBy(audioFiles.id);  // Ensure consistent ordering

      // Apply filters if provided
      if (filters) {
        if (filters.status) {
          query = query.where(eq(audioFiles.status, filters.status as any));
          countQuery = countQuery.where(eq(audioFiles.status, filters.status as any));
        }
        if (filters.language) {
          query = query.where(eq(audioFiles.language, filters.language as any));
          countQuery = countQuery.where(eq(audioFiles.language, filters.language as any));
        }
        if (filters.version) {
          query = query.where(eq(audioFiles.version, filters.version));
          countQuery = countQuery.where(eq(audioFiles.version, filters.version));
        }
        if (filters.processId) {
          query = query.where(eq(audioFiles.processId, filters.processId));
          countQuery = countQuery.where(eq(audioFiles.processId, filters.processId));
        }
        if (filters.batchId) {
          query = query.where(eq(audioFiles.batchId, filters.batchId));
          countQuery = countQuery.where(eq(audioFiles.batchId, filters.batchId));
        }
        if (filters.duration) {
          if (filters.duration.min !== undefined) {
            query = query.where(gte(audioFiles.duration, filters.duration.min));
            countQuery = countQuery.where(gte(audioFiles.duration, filters.duration.min));
          }
          if (filters.duration.max !== undefined) {
            query = query.where(lte(audioFiles.duration, filters.duration.max));
            countQuery = countQuery.where(lte(audioFiles.duration, filters.duration.max));
          }
        }
      }

      // Get the total count and paginated files
      const [totalResult] = await countQuery;
      const files = await query as AudioFile[];
      
      return {
        files,
        total: Number(totalResult?.count || 0)
      };
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
  }): Promise<any[]> {
    try {
      // Get the basic allocation data
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
      
      // If no allocations, return empty array
      if (!allocations.length) {
        return [];
      }
      
      // Get all unique IDs we need to fetch
      const audioFileIds = [...new Set(allocations.map(a => a.audioFileId))];
      const userIds = [...new Set([
        ...allocations.map(a => a.qualityAnalystId),
        ...allocations.map(a => a.allocatedBy)
      ])];
      
      // Fetch related data
      const audioFilesData = await db
        .select()
        .from(audioFiles)
        .where(inArray(audioFiles.id, audioFileIds)) as AudioFile[];
      
      const usersData = await db
        .select({
          id: users.id,
          fullName: users.fullName
        })
        .from(users)
        .where(inArray(users.id, userIds));
      
      // Create lookup maps for faster access
      const audioFileMap = new Map(audioFilesData.map(file => [file.id, file]));
      const userMap = new Map(usersData.map(user => [user.id, user]));
      
      // Enhance allocations with related data
      return allocations.map(allocation => {
        const audioFile = audioFileMap.get(allocation.audioFileId);
        const qualityAnalyst = userMap.get(allocation.qualityAnalystId);
        const allocator = userMap.get(allocation.allocatedBy);
        
        // Create a safe version of the allocation object that handles null evaluationId
        return {
          ...allocation,
          // Add a safe evaluationId property (if it's null, it won't cause issues)
          evaluationId: allocation.evaluationId || null,
          allocationDate: allocation.createdAt,
          audioFile: audioFile ? {
            id: audioFile.id,
            originalFilename: audioFile.originalFilename || audioFile.filename || `Audio File #${allocation.audioFileId}`,
            duration: audioFile.duration,
            language: audioFile.language,
            status: audioFile.status
          } : null,
          audioFileName: audioFile?.originalFilename || audioFile?.filename || `Audio File #${allocation.audioFileId}`,
          qualityAnalystName: qualityAnalyst?.fullName || `QA #${allocation.qualityAnalystId}`,
          allocatedByName: allocator?.fullName || `User #${allocation.allocatedBy}`,
          // Add other useful fields
          dueDate: null // We'll add this later if needed
        };
      });
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
      console.log('Fetching quality analysts for organization:', organizationId);
      const qualityAnalysts = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName, // This maps 'full_name' in DB to 'fullName' in code
          employeeId: users.employeeId,
          role: users.role,
          category: users.category,
          locationId: users.locationId,
          email: users.email,
          education: users.education,
          dateOfJoining: users.dateOfJoining,
          phoneNumber: users.phoneNumber,
          dateOfBirth: users.dateOfBirth,
          lastWorkingDay: users.lastWorkingDay,
          organizationId: users.organizationId,
          managerId: users.managerId,
          active: users.active,
          certified: users.certified,
          createdAt: users.createdAt,
          onboardingCompleted: users.onboardingCompleted,
        })
        .from(users)
        .where(and(
          eq(users.organizationId, organizationId),
          eq(users.role, 'quality_analyst'),
          eq(users.active, true)
        )) as User[];
      
      console.log('Found quality analysts:', qualityAnalysts.length);
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
    distributionMethod?: 'random' | 'agent-balanced';
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

        // Distribution depends on the selected method
        if (batchAllocation.distributionMethod === 'agent-balanced') {
          // Group files by agent ID
          const filesByAgent = new Map<string, AudioFile[]>();
          
          // Process each file and group by agent
          for (const file of audioFilesToAllocate) {
            const agentId = file.callMetrics?.agentId;
            
            if (agentId) {
              if (!filesByAgent.has(agentId)) {
                filesByAgent.set(agentId, []);
              }
              filesByAgent.get(agentId)!.push(file);
            } else {
              // Handle files without agent ID by using a special key
              if (!filesByAgent.has('unknown')) {
                filesByAgent.set('unknown', []);
              }
              filesByAgent.get('unknown')!.push(file);
            }
          }
          
          // Calculate how many files each QA should get from each agent
          const qaAllocationMap = new Map<number, number>();
          const qaAgentAllocationMap = new Map<number, Map<string, number>>();
          
          // Initialize allocation maps for each QA
          for (const qa of qualityAnalysts) {
            qaAllocationMap.set(qa.id, 0);
            qaAgentAllocationMap.set(qa.id, new Map<string, number>());
          }
          
          // Distribute files by agent to ensure balanced assignments
          for (const [agentId, agentFiles] of filesByAgent.entries()) {
            const agentFileCount = agentFiles.length;
            
            // Calculate how many files each QA should get for this agent proportionally
            let remainingAgentFiles = agentFileCount;
            
            // First pass: assign files based on QA proportions
            for (const qa of qualityAnalysts) {
              const proportion = qa.count / totalQACount;
              const filesForQA = Math.floor(agentFileCount * proportion);
              
              qaAgentAllocationMap.get(qa.id)!.set(agentId, filesForQA);
              qaAllocationMap.set(qa.id, (qaAllocationMap.get(qa.id) || 0) + filesForQA);
              
              remainingAgentFiles -= filesForQA;
            }
            
            // Second pass: distribute remaining files to QAs who should get more
            let qaIndex = 0;
            while (remainingAgentFiles > 0) {
              const qaId = qualityAnalysts[qaIndex].id;
              
              qaAgentAllocationMap.get(qaId)!.set(
                agentId, 
                (qaAgentAllocationMap.get(qaId)!.get(agentId) || 0) + 1
              );
              
              qaAllocationMap.set(qaId, (qaAllocationMap.get(qaId) || 0) + 1);
              
              remainingAgentFiles--;
              qaIndex = (qaIndex + 1) % qualityAnalysts.length;
            }
          }
          
          // Create allocation records
          const allocations: AudioFileAllocation[] = [];
          
          // Assign files to QAs based on the balanced distribution by agent
          for (const [qaId, agentAllocations] of qaAgentAllocationMap.entries()) {
            for (const [agentId, fileCount] of agentAllocations.entries()) {
              const agentFiles = filesByAgent.get(agentId) || [];
              
              for (let i = 0; i < fileCount && agentFiles.length > 0; i++) {
                const audioFile = agentFiles.shift()!;
                
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
          }
          
          return {
            batchAllocation: newBatchAllocation,
            allocations
          };
          
        } else {
          // Default random distribution method
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
        }
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

  async deleteEvaluationTemplate(id: number): Promise<void> {
    try {
      console.log(`Starting deletion process for template ID: ${id}`);
      
      // First, check if the template exists
      const template = await db.query.evaluationTemplates.findFirst({
        where: eq(evaluationTemplates.id, id)
      });
      
      if (!template) {
        console.error(`Template ID: ${id} not found`);
        throw new Error(`Template with ID ${id} not found`);
      }
      
      // Check if the template has evaluations before trying to delete
      const evaluationCount = await db.select({ count: count() })
        .from(evaluations)
        .where(eq(evaluations.templateId, id));
        
      if (evaluationCount[0]?.count && evaluationCount[0].count > 0) {
        console.log(`Template ID: ${id} has ${evaluationCount[0].count} evaluations. Consider archiving instead of deleting.`);
        throw new Error(`This template has ${evaluationCount[0].count} evaluations and cannot be deleted. Please archive it instead.`);
      }
      
      await db.transaction(async (tx) => {
        console.log(`Starting transaction to delete template ID: ${id}`);
        
        // First get all pillars for this template
        const pillars = await tx
          .select()
          .from(evaluationPillars)
          .where(eq(evaluationPillars.templateId, id));
          
        console.log(`Found ${pillars.length} pillars to delete for template ID: ${id}`);

        // For each pillar, delete its parameters and sub-reasons
        for (const pillar of pillars) {
          // Get parameters for this pillar
          const parameters = await tx
            .select()
            .from(evaluationParameters)
            .where(eq(evaluationParameters.pillarId, pillar.id));
            
          console.log(`Found ${parameters.length} parameters for pillar ID: ${pillar.id}`);
          
          // Delete sub-reasons for each parameter
          for (const parameter of parameters) {
            try {
              await tx
                .delete(evaluationSubReasons)
                .where(eq(evaluationSubReasons.parameterId, parameter.id));
            } catch (error) {
              console.error(`Error deleting sub-reasons for parameter ${parameter.id}:`, error);
              // Continue with the rest of the deletion
            }
          }
          
          // Delete parameters
          try {
            await tx
              .delete(evaluationParameters)
              .where(eq(evaluationParameters.pillarId, pillar.id));
          } catch (error) {
            console.error(`Error deleting parameters for pillar ${pillar.id}:`, error);
            throw new Error(`Failed to delete template components. The template may be in use.`);
          }
        }

        // Delete all pillars
        try {
          await tx
            .delete(evaluationPillars)
            .where(eq(evaluationPillars.templateId, id));
        } catch (error) {
          console.error(`Error deleting pillars for template ${id}:`, error);
          throw new Error(`Failed to delete template pillars. The template may be in use.`);
        }

        // Finally delete the template
        console.log(`Deleting template ID: ${id}`);
        try {
          await tx 
            .delete(evaluationTemplates)
            .where(eq(evaluationTemplates.id, id));
        } catch (error) {
          console.error(`Error deleting template ${id}:`, error);
          throw new Error(`Failed to delete the template. Try archiving it instead.`);
        }
          
        console.log(`Template ID: ${id} successfully deleted`);
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
            feedbackThreshold: evaluation.feedbackThreshold,
            audioFileId: evaluation.audioFileId,
            evaluationType: evaluation.evaluationType || 'standard',
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

        // If the final score is below the feedback threshold, create a feedback record
        if (evaluation.feedbackThreshold && finalScore < evaluation.feedbackThreshold) {
          console.log(`Final score ${finalScore} is below threshold ${evaluation.feedbackThreshold}, creating feedback record`);
          
          // Get reporting head for the trainee if possible
          let reportingHeadId = evaluation.evaluatorId; // Default to evaluator if no reporting head found
          
          if (evaluation.traineeId) {
            try {
              const trainee = await tx
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, evaluation.traineeId))
                .limit(1);
              
              if (trainee.length > 0 && trainee[0].reportingTo) {
                reportingHeadId = trainee[0].reportingTo;
              }
            } catch (err) {
              console.error('Error getting trainee reporting head, using evaluator instead:', err);
            }
          }
          
          // For audio evaluations, we need to create a feedback record either using the traineeId or the agentId from call_metrics
          if (evaluation.traineeId) {
            // If we have a traineeId, use it directly
            await tx
              .insert(evaluationFeedback)
              .values({
                evaluationId: newEvaluation.id,
                agentId: evaluation.traineeId as number,
                reportingHeadId,
                status: 'pending',
              });
              
            console.log('Created evaluation feedback record using traineeId');
          } else if (evaluation.evaluationType === 'audio' && evaluation.audioFileId) {
            // For audio evaluations without traineeId, try to get the agent ID from the audio file's call_metrics
            try {
              // Get the audio file to access its metadata
              const audioFile = await tx.select().from(audioFiles).where(eq(audioFiles.id, evaluation.audioFileId)).then(res => res[0]);
              
              // Check for agent ID in different possible field names (case-insensitive)
              const callMetrics = audioFile?.callMetrics || {};
              const agentIdStr = callMetrics.agentId || callMetrics.agentid || callMetrics.agent_id || null;
              
              if (agentIdStr) {
                console.log(`Found agentId ${agentIdStr} in call_metrics, looking for matching user`);
                
                // First try to find by exact ID match
                let agent = await tx.select().from(users).where(eq(users.id, parseInt(agentIdStr))).then(res => res[0] || null);
                
                // If not found, try to search by pbxId if it exists in our user schema
                if (!agent) {
                  console.log(`No user found with ID ${agentIdStr}, skipping feedback creation`);
                  // Don't return early, just skip this section
                } else {
                  // Create feedback with the agent ID from call_metrics only if agent was found
                  await tx
                    .insert(evaluationFeedback)
                    .values({
                      evaluationId: newEvaluation.id,
                      agentId: agent.id,
                      reportingHeadId,
                      status: 'pending',
                    });
                    
                  console.log(`Created evaluation feedback record using agentId ${agent.id} from call_metrics`);
                }
              } else {
                console.log('No valid agentId found in audio file call_metrics, skipping feedback creation');
              }
            } catch (err) {
              console.error('Error creating feedback from audio file metadata:', err);
            }
          } else {
            console.log('Skipping feedback record creation: no traineeId or valid audio file metadata');
          }
        }

        return newEvaluation;
      });
    } catch (error) {
      console.error('Error creating evaluation:', error);
      throw error;
    }
  }

  async getEvaluation(id: number): Promise<Evaluation | undefined> {
    try {
      const [evaluation] = await db
        .select()
        .from(evaluations)
        .where(eq(evaluations.id, id)) as Evaluation[];
      
      return evaluation;
    } catch (error) {
      console.error('Error getting evaluation:', error);
      throw error;
    }
  }
  
  async getEvaluationWithScores(id: number): Promise<Evaluation & { scores: EvaluationScore[] } | undefined> {
    try {
      const evaluation = await this.getEvaluation(id);
      
      if (!evaluation) {
        return undefined;
      }
      
      const scores = await db
        .select()
        .from(evaluationScores)
        .where(eq(evaluationScores.evaluationId, id)) as EvaluationScore[];
      
      return {
        ...evaluation,
        scores
      };
    } catch (error) {
      console.error('Error getting evaluation with scores:', error);
      throw error;
    }
  }
  
  async listEvaluations(filters: { 
    organizationId: number, 
    traineeId?: number, 
    evaluatorId?: number, 
    batchId?: number 
  }): Promise<Evaluation[]> {
    try {
      let query = db
        .select()
        .from(evaluations)
        .where(eq(evaluations.organizationId, filters.organizationId))
        .orderBy(desc(evaluations.createdAt));
      
      if (filters.traineeId) {
        query = query.where(eq(evaluations.traineeId, filters.traineeId));
      }
      
      if (filters.evaluatorId) {
        query = query.where(eq(evaluations.evaluatorId, filters.evaluatorId));
      }
      
      if (filters.batchId) {
        query = query.where(eq(evaluations.batchId, filters.batchId));
      }
      
      return query as Promise<Evaluation[]>;
    } catch (error) {
      console.error('Error listing evaluations:', error);
      throw error;
    }
  }
  
  async getEvaluationsByBatchAndType(batchId: number, evaluationType: string): Promise<Evaluation[]> {
    try {
      console.log(`Fetching evaluations for batch ${batchId} with type ${evaluationType}`);
      
      // First fetch the evaluations with basic information
      const evaluationsData = await db
        .select({
          id: evaluations.id,
          templateId: evaluations.templateId,
          traineeId: evaluations.traineeId,
          evaluatorId: evaluations.evaluatorId,
          finalScore: evaluations.finalScore,
          evaluationType: evaluations.evaluationType,
          createdAt: evaluations.createdAt,
          organizationId: evaluations.organizationId,
        })
        .from(evaluations)
        .where(and(
          eq(evaluations.batchId, batchId),
          eq(evaluations.evaluationType, evaluationType)
        ))
        .orderBy(desc(evaluations.createdAt)) as Evaluation[];
      
      if (evaluationsData.length === 0) {
        console.log(`No ${evaluationType} evaluations found for batch ${batchId}`);
        return [];
      }
      
      console.log(`Found ${evaluationsData.length} ${evaluationType} evaluations for batch ${batchId}`);
      
      // Fetch related data (templates and trainees) to enrich the evaluation objects
      const evaluationIds = evaluationsData.map(e => e.id);
      const templateIds = [...new Set(evaluationsData.map(e => e.templateId))];
      const traineeIds = [...new Set(evaluationsData.filter(e => e.traineeId).map(e => e.traineeId as number))];
      
      // Get templates for these evaluations
      const templates = await db
        .select()
        .from(evaluationTemplates)
        .where(inArray(evaluationTemplates.id, templateIds));
      
      // Get trainees for these evaluations
      const trainees = traineeIds.length > 0 ? await db
        .select({
          id: users.id,
          fullName: users.fullName,
        })
        .from(users)
        .where(inArray(users.id, traineeIds)) : [];
      
      // Determine if each evaluation is passed based on feedback threshold
      // For certification evaluations, we'll consider them passed if score is >= 70% (can be customized)
      const passingThreshold = 70.0; // Default passing threshold for certifications
      
      // Enrich the evaluations with template, trainee info, and passing status
      const enrichedEvaluations = evaluationsData.map(evaluation => {
        // Find related template
        const template = templates.find(t => t.id === evaluation.templateId);
        
        // Find related trainee
        const trainee = trainees.find(t => t.id === evaluation.traineeId);
        
        // Determine if passed (using template threshold if available, otherwise default)
        const threshold = template?.feedbackThreshold ? parseFloat(template.feedbackThreshold.toString()) : passingThreshold;
        const isPassed = parseFloat(evaluation.finalScore.toString()) >= threshold;
        
        // Return enriched evaluation
        return {
          ...evaluation,
          template: template ? {
            id: template.id,
            name: template.name,
            description: template.description,
          } : undefined,
          trainee: trainee ? {
            fullName: trainee.fullName,
          } : undefined,
          isPassed,
          score: parseFloat(evaluation.finalScore.toString()),
          evaluatedAt: evaluation.createdAt.toISOString(),
        };
      });
      
      return enrichedEvaluations;
    } catch (error) {
      console.error(`Error fetching ${evaluationType} evaluations for batch ${batchId}:`, error);
      throw error;
    }
  }
  
  async createEvaluationFeedback(feedback: InsertEvaluationFeedback): Promise<EvaluationFeedback> {
    try {
      const [newFeedback] = await db
        .insert(evaluationFeedback)
        .values(feedback)
        .returning() as EvaluationFeedback[];
      
      return newFeedback;
    } catch (error) {
      console.error('Error creating evaluation feedback:', error);
      throw error;
    }
  }
  
  async getEvaluationFeedbackByEvaluationId(evaluationId: number): Promise<EvaluationFeedback | undefined> {
    try {
      const [feedback] = await db
        .select()
        .from(evaluationFeedback)
        .where(eq(evaluationFeedback.evaluationId, evaluationId)) as EvaluationFeedback[];
      
      return feedback;
    } catch (error) {
      console.error('Error getting evaluation feedback by evaluation ID:', error);
      throw error;
    }
  }
  
  async getEvaluationFeedback(id: number): Promise<EvaluationFeedback | undefined> {
    try {
      const [feedback] = await db
        .select()
        .from(evaluationFeedback)
        .where(eq(evaluationFeedback.id, id)) as EvaluationFeedback[];
      
      return feedback;
    } catch (error) {
      console.error('Error getting evaluation feedback by ID:', error);
      throw error;
    }
  }
  
  async updateEvaluationFeedback(id: number, feedback: Partial<InsertEvaluationFeedback>): Promise<EvaluationFeedback> {
    try {
      const [updatedFeedback] = await db
        .update(evaluationFeedback)
        .set({
          ...feedback,
          updatedAt: new Date()
        })
        .where(eq(evaluationFeedback.id, id))
        .returning() as EvaluationFeedback[];
      
      if (!updatedFeedback) {
        throw new Error('Evaluation feedback not found');
      }
      
      return updatedFeedback;
    } catch (error) {
      console.error('Error updating evaluation feedback:', error);
      throw error;
    }
  }
  
  async getPendingEvaluationFeedback(agentId: number): Promise<(EvaluationFeedback & { evaluation: Evaluation })[]> {
    try {
      const feedbackList = await db
        .select({
          feedback: evaluationFeedback,
          evaluation: evaluations
        })
        .from(evaluationFeedback)
        .innerJoin(evaluations, eq(evaluationFeedback.evaluationId, evaluations.id))
        .where(and(
          eq(evaluationFeedback.agentId, agentId),
          eq(evaluationFeedback.status, 'pending')
        ));
      
      return feedbackList.map(item => ({
        ...item.feedback,
        evaluation: item.evaluation
      }));
    } catch (error) {
      console.error('Error getting pending evaluation feedback for agent:', error);
      throw error;
    }
  }
  
  async getPendingApprovalEvaluationFeedback(reportingHeadId: number): Promise<(EvaluationFeedback & { evaluation: Evaluation })[]> {
    try {
      const feedbackList = await db
        .select({
          feedback: evaluationFeedback,
          evaluation: evaluations
        })
        .from(evaluationFeedback)
        .innerJoin(evaluations, eq(evaluationFeedback.evaluationId, evaluations.id))
        .where(and(
          eq(evaluationFeedback.reportingHeadId, reportingHeadId),
          eq(evaluationFeedback.status, 'pending'),
          isNotNull(evaluationFeedback.agentResponseDate) // Only show feedback that the agent has already reviewed
        ));
      
      return feedbackList.map(item => ({
        ...item.feedback,
        evaluation: item.evaluation
      }));
    } catch (error) {
      console.error('Error getting pending approval evaluation feedback for reporting head:', error);
      throw error;
    }
  }
  
  async getAllEvaluationFeedback(userId: number, organizationId: number, role: string): Promise<(EvaluationFeedback & { evaluation: Evaluation })[]> {
    try {
      let query = db
        .select({
          feedback: evaluationFeedback,
          evaluation: evaluations
        })
        .from(evaluationFeedback)
        .innerJoin(evaluations, eq(evaluationFeedback.evaluationId, evaluations.id))
        .where(eq(evaluations.organizationId, organizationId));
      
      // For quality analysts, show both feedback where they are the reporting head
      // and where they are the evaluator
      if (role === 'quality_analyst') {
        query = query.where(
          or(
            eq(evaluationFeedback.reportingHeadId, userId),
            and(
              eq(evaluations.evaluatorId, userId),
              ne(evaluationFeedback.reportingHeadId, userId) // Don't duplicate entries
            )
          )
        );
      } 
      // For agents/trainees, show only their feedback
      else if (role === 'trainee' || role === 'advisor') {
        query = query.where(eq(evaluationFeedback.agentId, userId));
      }
      // For admin/owner/managers, show all feedback in the organization
      
      const feedbackList = await query;
      
      return feedbackList.map(item => ({
        ...item.feedback,
        evaluation: item.evaluation
      }));
    } catch (error) {
      console.error('Error getting all evaluation feedback:', error);
      throw error;
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)) as User[];
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Make the username lookup case-insensitive
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`) as User[];
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Make the email lookup case-insensitive
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${email})`) as User[];
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    // Check for existing email
    if (user.email) {
      const existingUserWithEmail = await this.getUserByEmail(user.email);
      if (existingUserWithEmail) {
        throw new Error(`A user with email ${user.email} already exists`);
      }
    }
    
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
      
      // Check if email is being updated and if it would conflict
      if (user.email) {
        const existingUserWithEmail = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .then(results => results.find(u => u.id !== id));

        if (existingUserWithEmail) {
          throw new Error('Email already exists. Please choose a different email address.');
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
  
  async createPasswordResetToken(email: string, token: string): Promise<User | undefined> {
    try {
      console.log(`Creating password reset token for email: ${email}`);
      
      // Set token expiration to 1 hour from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);
      
      const [updatedUser] = await db
        .update(users)
        .set({ 
          resetPasswordToken: token,
          resetPasswordExpires: expiresAt
        })
        .where(eq(users.email, email))
        .returning() as User[];
      
      if (!updatedUser) {
        console.log(`No user found with email: ${email}`);
        return undefined;
      }
      
      console.log(`Password reset token created for user: ${updatedUser.username}`);
      return updatedUser;
    } catch (error) {
      console.error('Error creating password reset token:', error);
      throw error;
    }
  }
  
  async getUserByResetToken(token: string): Promise<User | undefined> {
    try {
      console.log(`Looking up user by reset token: ${token}`);
      
      const now = new Date();
      const users = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.resetPasswordToken, token),
            gt(schema.users.resetPasswordExpires, now)
          )
        );
      
      if (users.length === 0) {
        console.log('No valid user found with the provided reset token');
        return undefined;
      }
      
      console.log(`Found user by reset token: ${users[0].username}`);
      return users[0];
    } catch (error) {
      console.error('Error getting user by reset token:', error);
      throw error;
    }
  }
  
  async resetPassword(token: string, hashedPassword: string): Promise<boolean> {
    try {
      console.log('Attempting to reset password with token');
      
      const now = new Date();
      const [updatedUser] = await db
        .update(schema.users)
        .set({ 
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null
        })
        .where(
          and(
            eq(schema.users.resetPasswordToken, token),
            gt(schema.users.resetPasswordExpires, now)
          )
        )
        .returning() as User[];
      
      if (!updatedUser) {
        console.log('No user found with valid reset token');
        return false;
      }
      
      console.log(`Password reset successful for user: ${updatedUser.username}`);
      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
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
  
  async countUsers(organizationId: number, includeInactive: boolean = false): Promise<number> {
    try {
      let query = db
        .select({ count: count() })
        .from(users)
        .where(eq(users.organizationId, organizationId));
        
      // Only count active users unless specifically requested
      if (!includeInactive) {
        query = query.where(eq(users.active, true));
      }
      
      const result = await query;
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error counting users:', error);
      throw new Error('Failed to count users');
    }
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
  
  async updateUserProcesses(userId: number, processIds: number[], organizationId: number): Promise<void> {
    try {
      console.log(`Updating processes for user ${userId}:`, processIds);
      
      // Begin a transaction
      await db.transaction(async (tx) => {
        // Get current user processes
        const currentProcesses = await tx
          .select({ processId: userProcesses.processId })
          .from(userProcesses)
          .where(eq(userProcesses.userId, userId));
          
        const currentProcessIds = currentProcesses.map(p => p.processId);
        
        // Find processes to remove (in current but not in new list)
        const processesToRemove = currentProcessIds.filter(id => !processIds.includes(id));
        
        // Find processes to add (in new list but not in current)
        const processesToAdd = processIds.filter(id => !currentProcessIds.includes(id));
        
        console.log(`For user ${userId}: Removing ${processesToRemove.length} processes, Adding ${processesToAdd.length} processes`);
        
        // Remove processes that are no longer assigned
        if (processesToRemove.length > 0) {
          await tx
            .delete(userProcesses)
            .where(
              and(
                eq(userProcesses.userId, userId),
                inArray(userProcesses.processId, processesToRemove)
              )
            );
        }
        
        // Add new processes
        if (processesToAdd.length > 0) {
          // Get process details to determine line of business IDs
          const processDetails = await tx
            .select({
              id: organizationProcesses.id,
              lineOfBusinessId: organizationProcesses.lineOfBusinessId,
            })
            .from(organizationProcesses)
            .where(inArray(organizationProcesses.id, processesToAdd));
            
          // Insert new processes with their line of business IDs
          for (const process of processDetails) {
            await tx.insert(userProcesses).values({
              userId,
              processId: process.id,
              organizationId,
              lineOfBusinessId: process.lineOfBusinessId,
              status: 'assigned',
              assignedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      });
      
      console.log(`Successfully updated processes for user ${userId}`);
    } catch (error) {
      console.error(`Error updating processes for user ${userId}:`, error);
      throw new Error('Failed to update user processes');
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

  async getUserPermissions(userId: number): Promise<string[]> {
    try {
      // Get the user to find their role
      const user = await this.getUser(userId);
      if (!user) {
        return []; // User not found, no permissions
      }

      // If user is owner, return all permissions
      if (user.role === 'owner') {
        // Return all permissions from the permissionEnum
        return permissionEnum.enumValues;
      }

      // Get the role permissions for this user's role
      const rolePermission = await this.getRolePermissions(user.organizationId, user.role);
      
      // Return the permissions or an empty array if none found
      return rolePermission?.permissions || [];
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
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
  
  async resetRolePermissionsToDefault(organizationId: number, role: string): Promise<RolePermission> {
    // Import the default permissions from shared permissions
    const { getDefaultPermissions } = await import("@shared/permissions");
    
    // Get the default permissions for this role
    const defaultPermissions = getDefaultPermissions(role);
    
    // Update the role permissions with the defaults
    return this.updateRolePermissions(organizationId, role, defaultPermissions);
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
      // Check if email already exists before starting the transaction
      if (user.email) {
        const existingUserByEmail = await this.getUserByEmail(user.email);
        if (existingUserByEmail) {
          throw new Error(`Email ${user.email} already exists. Please use a different email address.`);
        }
      }
      
      // Check if username already exists before starting the transaction
      if (user.username) {
        const existingUserByUsername = await this.getUserByUsername(user.username);
        if (existingUserByUsername) {
          throw new Error(`Username ${user.username} already exists. Please use a different username.`);
        }
      }
      
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

  async getProcessByName(name: string): Promise<{ id: number, lineOfBusinessId?: number } | null> {
    try {
      const [process] = await db
        .select({ 
          id: organizationProcesses.id,
          lineOfBusinessId: organizationProcesses.lineOfBusinessId
        })
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
      console.log(`Assigning user ${userBatchProcess.userId} to batch ${userBatchProcess.batchId}`);
      
      // Get the current batch status to set initial trainee status
      const batch = await db.query.organizationBatches.findFirst({
        where: eq(organizationBatches.id, userBatchProcess.batchId)
      });
      
      console.log(`Retrieved batch info: ${batch?.name}, status: ${batch?.status}`);
      
      // Set the trainee status to match the batch status
      const [result] = await db
        .insert(userBatchProcesses)
        .values({
          ...userBatchProcess,
          traineeStatus: batch?.status, // Set initial trainee status to match batch status
          isManualStatus: false, // Mark as auto-synced
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning() as UserBatchProcess[];
        
      console.log(`User assigned to batch with trainee status: ${result.traineeStatus}`);
      

      return result;
    } catch (error) {
      console.error('Error assigning user to batch:', error);
      throw error;
    }
  }

  async getUserBatchProcesses(userId: number): Promise<UserBatchProcess[]> {
    try {
      console.log(`Fetching batch processes for user ${userId}`);
      
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
          trainerId: organizationBatches.trainerId,
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

      // Add debugging for specific user ID
      if (userId === 386) {
        console.log(`Found ${processes.length} batch processes for user 386:`, 
          processes.map(p => ({
            batchId: p.batchId,
            batchName: p.batchName,
            processId: p.processId,
            processName: p.processName
          }))
        );
      }

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

  async updateTraineeStatus(
    userBatchProcessId: number, 
    traineeStatus: string | null, 
    isManualStatus: boolean
  ): Promise<UserBatchProcess> {
    try {
      console.log(`Updating trainee status for userBatchProcess ${userBatchProcessId} to ${traineeStatus}, isManual: ${isManualStatus}`);
      
      const [updated] = await db
        .update(userBatchProcesses)
        .set({
          traineeStatus,
          isManualStatus,
          updatedAt: new Date()
        })
        .where(eq(userBatchProcesses.id, userBatchProcessId))
        .returning();
      
      if (!updated) {
        throw new Error(`User batch process with ID ${userBatchProcessId} not found`);
      }
      
      return updated;
    } catch (error) {
      console.error('Error updating trainee status:', error);
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

  async deletePhaseChangeRequest(id: number): Promise<void> {
    try {
      console.log(`Deleting phase change request ${id}`);
      
      // First verify the request exists and is in pending state
      const [request] = await db
        .select()
        .from(batchPhaseChangeRequests)
        .where(eq(batchPhaseChangeRequests.id, id)) as BatchPhaseChangeRequest[];
        
      console.log(`Found request to delete:`, request);
      
      if (!request) {
        throw new Error('Phase change request not found');
      }
      
      if (request.status !== 'pending') {
        throw new Error('Only pending requests can be deleted');
      }
      
      // Delete the request - add more detailed logging
      console.log(`Executing DELETE query on batch_phase_change_requests where id=${id}`);
      try {
        const result = await db
          .delete(batchPhaseChangeRequests)
          .where(eq(batchPhaseChangeRequests.id, id));
        console.log(`Delete operation result:`, result);
      } catch (deleteError) {
        console.error(`Error in delete operation:`, deleteError);
        throw deleteError;
      }
      
      // Verify the record was deleted
      const checkIfDeleted = await db
        .select()
        .from(batchPhaseChangeRequests)
        .where(eq(batchPhaseChangeRequests.id, id));
      
      console.log(`After delete, found ${checkIfDeleted.length} records`);
        
      console.log(`Successfully deleted phase change request ${id}`);
    } catch (error) {
      console.error('Error deleting phase change request:', error);
      throw error;
    }
  }

  async listTrainerPhaseChangeRequests(trainerId: number): Promise<BatchPhaseChangeRequest[]> {
    try {
      const requests = await db
        .select({
          request: batchPhaseChangeRequests,
          trainer: {
            id: users.id,
            fullName: users.fullName,
          }
        })
        .from(batchPhaseChangeRequests)
        .leftJoin(users, eq(batchPhaseChangeRequests.trainerId, users.id))
        .where(eq(batchPhaseChangeRequests.trainerId, trainerId));

      // Transform the result to the expected format
      return requests.map(item => ({
        ...item.request,
        trainer: item.trainer
      })) as BatchPhaseChangeRequest[];
    } catch (error) {
      console.error('Error listing trainer phase change requests:', error);
      throw error;
    }
  }

  async listManagerPhaseChangeRequests(managerId: number): Promise<BatchPhaseChangeRequest[]> {
    try {
      const requests = await db
        .select({
          request: batchPhaseChangeRequests,
          trainer: {
            id: users.id,
            fullName: users.fullName,
          }
        })
        .from(batchPhaseChangeRequests)
        .leftJoin(users, eq(batchPhaseChangeRequests.trainerId, users.id))
        .where(eq(batchPhaseChangeRequests.managerId, managerId));

      // Transform the result to the expected format
      return requests.map(item => ({
        ...item.request,
        trainer: item.trainer
      })) as BatchPhaseChangeRequest[];
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

  async listQuestions(organizationId: number, includeInactive: boolean = false): Promise<Question[]> {
    try {
      console.log(`Fetching questions for organization ${organizationId}, includeInactive: ${includeInactive}`);

      // Select all columns explicitly and use the correct table reference
      let query = db
        .select({
          id: questions.id,
          question: questions.question,
          type: questions.type,
          options: questions.options,
          correctAnswer: questions.correctAnswer,
          explanation: questions.explanation,
          difficultyLevel: questions.difficultyLevel,
          category: questions.category,
          active: questions.active,
          organizationId: questions.organizationId,
          createdBy: questions.createdBy,
          processId: questions.processId,
          createdAt: questions.createdAt,
          updatedAt: questions.updatedAt
        })
        .from(questions)
        .where(eq(questions.organizationId, organizationId));
        
      // If we're not including inactive questions, add the active filter
      if (!includeInactive) {
        query = query.where(eq(questions.active, true));
      }
      
      const results = await query as Question[];

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

      // Base query for questions (only active questions)
      let query = db
        .select()
        .from(questions)
        .where(
          and(
            eq(questions.organizationId, organizationId),
            eq(questions.active, true)
          )
        );

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
  async listQuestionsByProcess(organizationId: number, processId: number, includeInactive: boolean = false): Promise<Question[]> {
    try {
      console.log(`Fetching questions for organization ${organizationId} and process ${processId}, includeInactive: ${includeInactive}`);

      let query = db
        .select()
        .from(questions)
        .where(
          and(
            eq(questions.organizationId, organizationId),
            eq(questions.processId, processId)
          )
        );
        
      // If we're not including inactive questions, add the active filter
      if (!includeInactive) {
        query = query.where(eq(questions.active, true));
      }
      
      const results = await query as Question[];

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
  
  async getQuizAttemptsByUser(userId: number, quizId: number): Promise<QuizAttempt[]> {
    try {
      console.log(`Fetching quiz attempts for user ${userId} and quiz ${quizId}`);

      // Get all attempts for this user and quiz
      const attempts = await db
        .select({
          id: quizAttempts.id,
          quizId: quizAttempts.quizId,
          userId: quizAttempts.userId,
          score: quizAttempts.score,
          completedAt: quizAttempts.completedAt,
          organizationId: quizAttempts.organizationId
        })
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.userId, userId),
            eq(quizAttempts.quizId, quizId)
          )
        )
        .orderBy(desc(quizAttempts.completedAt));
      
      console.log(`Found ${attempts.length} attempts for user ${userId} on quiz ${quizId}`);
      return attempts;
    } catch (error) {
      console.error("Error in getQuizAttemptsByUser:", error);
      throw new Error("Failed to fetch quiz attempts for user");
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
          passingScore: quizzes.passingScore,
          quizType: quizzes.quizType
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
          passingScore: attempt.passingScore,
          quizType: attempt.quizType
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

      // Ensure score is an integer as per database schema requirement
      const score = Math.round((correctCount / attempt.answers.length) * 100);

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

  async getBatchAttendanceHistory(organizationId: number, batchId: number): Promise<{
    date: string;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    leaveCount: number;
    attendanceRate: number;
    totalTrainees: number;
  }[]> {
    try {
      console.log('Fetching attendance history for batch:', batchId);
      
      // Get all trainees in the batch to calculate total
      const batchTrainees = await db
        .select()
        .from(userBatchProcesses)
        .where(eq(userBatchProcesses.batchId, batchId));
        
      const totalTraineesInBatch = batchTrainees.length;
      
      if (totalTraineesInBatch === 0) {
        return []; // No trainees in batch, return empty array
      }
      
      // Get all attendance records for this batch directly
      const attendanceRecords = await db
        .select()
        .from(attendance)
        .where(eq(attendance.batchId, batchId))
        .where(eq(attendance.organizationId, organizationId));
      
      if (attendanceRecords.length === 0) {
        return []; // No attendance records, return empty array
      }
      
      // Group attendance records by date
      const attendanceByDate = new Map<string, { 
        present: number, 
        absent: number, 
        late: number, 
        leave: number 
      }>();
      
      // Initialize the map with all dates that have records
      attendanceRecords.forEach(record => {
        const date = record.date;
        if (!attendanceByDate.has(date)) {
          attendanceByDate.set(date, { present: 0, absent: 0, late: 0, leave: 0 });
        }
        
        const stats = attendanceByDate.get(date)!;
        
        // Increment the appropriate counter based on attendance status
        switch(record.status) {
          case 'present':
            stats.present++;
            break;
          case 'absent':
            stats.absent++;
            break;
          case 'late':
            stats.late++;
            break;
          case 'leave':
            stats.leave++;
            break;
        }
      });
      
      // Convert the map to array of daily attendance objects
      const result = Array.from(attendanceByDate.entries()).map(([date, stats]) => {
        const totalMarked = stats.present + stats.absent + stats.late + stats.leave;
        const attendanceRate = totalMarked > 0 
          ? Math.round((stats.present + stats.late) / totalMarked * 100) 
          : 0;
        
        return {
          date,
          presentCount: stats.present,
          absentCount: stats.absent,
          lateCount: stats.late,
          leaveCount: stats.leave,
          attendanceRate,
          totalTrainees: totalTraineesInBatch
        };
      });
      
      // Sort by date (newest first)
      return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Error fetching batch attendance history:', error);
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

      // Import the correct tables from schema.ts
      const { organizationBatches, organizationProcesses } = await import('@shared/schema');

      const [trainee] = await db
        .select({
          id: userBatchProcesses.id,
          userId: userBatchProcesses.userId,
          batchId: userBatchProcesses.batchId,
          processId: userBatchProcesses.processId,
          status: userBatchProcesses.status,
          traineeStatus: userBatchProcesses.traineeStatus,
          isManualStatus: userBatchProcesses.isManualStatus,
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
    createdBy?: number;
    userId?: number;
    eventType?: string;
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    date?: string;
    previousValue?: string;
    newValue?: string;
    refresherReason?: string | null; // Added refresher reason field
  }): Promise<any> {
    try {
      console.log('Creating batch event:', event);
      
      // Import the batch history schema
      const { batchHistory, batchEvents } = await import('@shared/schema');
      
      // Determine which table to use based on the event format
      if (event.startDate && event.endDate) {
        // This is a schedule/calendar event
        console.log('Creating batch calendar event');
        
        // Parse dates properly to ensure they are valid Date objects
        let startDate, endDate;
        
        try {
          startDate = new Date(event.startDate);
          endDate = new Date(event.endDate);
          
          // Validate the dates
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Invalid date format');
          }
        } catch (err) {
          console.error('Date parsing error:', err);
          // Fallback to current time + 1 day for end date if parsing fails
          const now = new Date();
          startDate = now;
          endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
        }
        
        console.log('Using dates:', { startDate, endDate });
        
        const [newEvent] = await db
          .insert(batchEvents)
          .values({
            batchId: event.batchId,
            title: event.title || 'Scheduled Event',
            description: event.description || '',
            startDate: startDate,
            endDate: endDate,
            eventType: event.eventType || 'refresher',
            organizationId: event.organizationId,
            createdBy: event.createdBy || event.userId || 1,
            status: event.status || 'scheduled',
            refresherReason: event.refresherReason || null,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning() as any[];
          
        return newEvent;
      } else {
        // This is a batch history event
        console.log('Creating batch history event');
        
        // Make sure required fields for history are present
        if (!event.date) {
          event.date = new Date().toISOString();
        }
        
        if (!event.eventType) {
          event.eventType = 'note';
        }
        
        const [newEvent] = await db
          .insert(batchHistory)
          .values({
            batchId: event.batchId,
            userId: event.userId || event.createdBy || 1,
            eventType: event.eventType as "phase_change" | "status_update" | "milestone" | "note",
            description: event.description || 'Batch event',
            date: new Date(event.date),
            previousValue: event.previousValue,
            newValue: event.newValue,
            organizationId: event.organizationId,
            createdAt: new Date()
          })
          .returning() as any[];
          
        return newEvent;
      }
    } catch (error) {
      console.error('Error creating batch event:', error);
      throw error;
    }
  }
  
  // Audio File Evaluation with Parameter Scores
  async getAudioFileEvaluation(audioFileId: number): Promise<Evaluation | undefined> {
    try {
      const [audioFile] = await db
        .select()
        .from(audioFiles)
        .where(eq(audioFiles.id, audioFileId))
        .where(isNotNull(audioFiles.evaluationId)) as AudioFile[];
      
      if (!audioFile || !audioFile.evaluationId) {
        return undefined;
      }
      
      const [evaluation] = await db
        .select()
        .from(evaluations)
        .where(eq(evaluations.id, audioFile.evaluationId)) as Evaluation[];
      
      return evaluation;
    } catch (error) {
      console.error('Error getting audio file evaluation:', error);
      throw error;
    }
  }
  
  async getAudioFileEvaluationWithScores(audioFileId: number): Promise<{
    evaluation: Evaluation;
    scores: EvaluationScore[];
    parametersDetails: Array<{
      parameter: EvaluationParameter;
      pillar: EvaluationPillar;
    }>;
  } | undefined> {
    try {
      // First get the evaluation
      const audioFileEval = await this.getAudioFileEvaluation(audioFileId);
      if (!audioFileEval) {
        return undefined;
      }
      
      // Get the scores for this evaluation
      const scores = await db
        .select()
        .from(evaluationScores)
        .where(eq(evaluationScores.evaluationId, audioFileEval.id)) as EvaluationScore[];
      
      // Get parameter details for all scored parameters
      const parameterIds = scores.map(score => score.parameterId);
      
      // Get parameters
      const parameters = await db
        .select()
        .from(evaluationParameters)
        .where(inArray(evaluationParameters.id, parameterIds)) as EvaluationParameter[];
      
      // Get pillars for these parameters
      const pillarIds = [...new Set(parameters.map(param => param.pillarId))];
      
      const pillars = await db
        .select()
        .from(evaluationPillars)
        .where(inArray(evaluationPillars.id, pillarIds)) as EvaluationPillar[];
      
      // Map parameters to their pillars
      const parametersDetails = parameters.map(parameter => ({
        parameter,
        pillar: pillars.find(pillar => pillar.id === parameter.pillarId)!
      }));
      
      return {
        evaluation: audioFileEval,
        scores,
        parametersDetails
      };
    } catch (error) {
      console.error('Error getting audio file evaluation with scores:', error);
      throw error;
    }
  }
  
  async getAllParameterScores(organizationId: number, filters?: {
    qaIds?: number[];
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalEvaluations: number;
    averageScore: number;
    parameterScores: Record<number, { 
      totalScore: number;
      count: number;
      average: number;
      parameterName: string;
      pillarName: string;
      qaScores?: Record<number, {
        totalScore: number;
        count: number;
        average: number;
      }>;
    }>;
    qaAnalysts?: Record<number, {
      id: number;
      name: string;
      totalEvaluations: number;
      averageScore: number;
    }>;
  }> {
    try {
      // Build the where clause dynamically
      let whereClause = and(
        eq(evaluations.organizationId, organizationId),
        eq(evaluations.evaluationType, 'audio')
      );
      
      // Add date filters if provided
      if (filters?.startDate && filters?.endDate) {
        whereClause = and(
          whereClause,
          gte(evaluations.createdAt, filters.startDate),
          lte(evaluations.createdAt, filters.endDate)
        );
      }
      
      // Add QA filters if provided
      if (filters?.qaIds && filters.qaIds.length > 0) {
        whereClause = and(
          whereClause,
          inArray(evaluations.evaluatorId, filters.qaIds)
        );
      }
      
      // Get all audio evaluations based on filters
      const audioFileEvaluations = await db
        .select({
          id: evaluations.id,
          finalScore: evaluations.finalScore,
          evaluatorId: evaluations.evaluatorId,
          createdAt: evaluations.createdAt
        })
        .from(evaluations)
        .where(whereClause);
      
      // Get scores for all these evaluations
      const evaluationIds = audioFileEvaluations.map(evalItem => evalItem.id);
      
      let parameterScores: Record<number, { 
        totalScore: number; 
        count: number; 
        average: number;
        parameterName: string;
        pillarName: string;
        qaScores: Record<number, {
          totalScore: number;
          count: number;
          average: number;
        }>;
      }> = {};
      
      let qaStats: Record<number, {
        id: number;
        name: string;
        totalEvaluations: number;
        totalScore: number;
        averageScore: number;
      }> = {};
      
      let totalScore = 0;
      
      if (evaluationIds.length > 0) {
        // Get all scores with evaluation details
        const scores = await db
          .select({
            evaluationId: evaluationScores.evaluationId,
            parameterId: evaluationScores.parameterId,
            score: evaluationScores.score,
            parameterName: evaluationParameters.name,
            pillarName: evaluationPillars.name,
            evaluatorId: evaluations.evaluatorId
          })
          .from(evaluationScores)
          .leftJoin(
            evaluationParameters,
            eq(evaluationScores.parameterId, evaluationParameters.id)
          )
          .leftJoin(
            evaluationPillars,
            eq(evaluationParameters.pillarId, evaluationPillars.id)
          )
          .leftJoin(
            evaluations,
            eq(evaluationScores.evaluationId, evaluations.id)
          )
          .where(inArray(evaluationScores.evaluationId, evaluationIds));
        
        // Get QA user details for names
        const qaIds = [...new Set(audioFileEvaluations.map(evalItem => evalItem.evaluatorId))];
        const qaUsers = await db
          .select({
            id: users.id,
            fullName: users.fullName
          })
          .from(users)
          .where(inArray(users.id, qaIds));
        
        // Initialize QA stats
        qaUsers.forEach(qa => {
          qaStats[qa.id] = {
            id: qa.id,
            name: qa.fullName || `QA ${qa.id}`,
            totalEvaluations: 0,
            totalScore: 0,
            averageScore: 0
          };
        });
        
        // Count evaluations by QA
        audioFileEvaluations.forEach(evalItem => {
          if (qaStats[evalItem.evaluatorId]) {
            qaStats[evalItem.evaluatorId].totalEvaluations++;
            qaStats[evalItem.evaluatorId].totalScore += parseFloat(evalItem.finalScore.toString());
          }
        });
        
        // Calculate average scores for QAs
        Object.keys(qaStats).forEach(qaId => {
          const qa = qaStats[parseInt(qaId)];
          qa.averageScore = qa.totalEvaluations > 0 
            ? Math.round(qa.totalScore / qa.totalEvaluations) 
            : 0;
        });
        
        // Aggregate scores by parameter and QA
        scores.forEach(score => {
          const scoreValue = parseInt(score.score);
          if (!isNaN(scoreValue)) {
            if (!parameterScores[score.parameterId]) {
              parameterScores[score.parameterId] = { 
                totalScore: 0, 
                count: 0, 
                average: 0,
                parameterName: score.parameterName || `Parameter ${score.parameterId}`,
                pillarName: score.pillarName || 'Unknown Pillar',
                qaScores: {}
              };
            }
            
            // Add overall parameter score
            parameterScores[score.parameterId].totalScore += scoreValue;
            parameterScores[score.parameterId].count++;
            
            // Add QA-specific parameter score
            if (score.evaluatorId) {
              if (!parameterScores[score.parameterId].qaScores[score.evaluatorId]) {
                parameterScores[score.parameterId].qaScores[score.evaluatorId] = {
                  totalScore: 0,
                  count: 0,
                  average: 0
                };
              }
              
              parameterScores[score.parameterId].qaScores[score.evaluatorId].totalScore += scoreValue;
              parameterScores[score.parameterId].qaScores[score.evaluatorId].count++;
            }
          }
        });
        
        // Calculate averages for each parameter
        Object.keys(parameterScores).forEach(paramId => {
          const param = parameterScores[parseInt(paramId)];
          param.average = param.count > 0 ? Math.round(param.totalScore / param.count) : 0;
          
          // Calculate QA-specific averages
          Object.keys(param.qaScores).forEach(qaId => {
            const qaScore = param.qaScores[parseInt(qaId)];
            qaScore.average = qaScore.count > 0 ? Math.round(qaScore.totalScore / qaScore.count) : 0;
          });
        });
        
        // Calculate total average score
        totalScore = audioFileEvaluations.reduce((sum, evalItem) => 
          sum + parseFloat(evalItem.finalScore.toString()), 0);
      }
      
      return {
        totalEvaluations: audioFileEvaluations.length,
        averageScore: audioFileEvaluations.length > 0 
          ? Math.round(totalScore / audioFileEvaluations.length) 
          : 0,
        parameterScores,
        qaAnalysts: qaStats
      };
    } catch (error) {
      console.error('Error getting parameter scores:', error);
      throw error;
    }
  }

  async getQualityAnalystEvaluationStats(qualityAnalystId: number, organizationId: number): Promise<{
    totalEvaluations: number;
    averageScore: number;
    parameterScores: Record<number, { 
      totalScore: number;
      count: number;
      average: number;
      parameterName: string;
      pillarName: string;
    }>;
  }> {
    try {
      // Get all evaluations done by this QA
      const audioFileEvaluations = await db
        .select()
        .from(evaluations)
        .where(and(
          eq(evaluations.evaluatorId, qualityAnalystId),
          eq(evaluations.organizationId, organizationId),
          eq(evaluations.evaluationType, 'audio')
        )) as Evaluation[];
      
      // Get scores for all these evaluations
      const evaluationIds = audioFileEvaluations.map(evalItem => evalItem.id);
      
      let parameterScores: Record<number, { 
        totalScore: number; 
        count: number; 
        average: number;
        parameterName: string;
        pillarName: string;
      }> = {};
      
      let totalScore = 0;
      
      if (evaluationIds.length > 0) {
        // Get all scores
        const scores = await db
          .select({
            evaluationId: evaluationScores.evaluationId,
            parameterId: evaluationScores.parameterId,
            score: evaluationScores.score,
            parameterName: evaluationParameters.name,
            pillarName: evaluationPillars.name
          })
          .from(evaluationScores)
          .leftJoin(
            evaluationParameters,
            eq(evaluationScores.parameterId, evaluationParameters.id)
          )
          .leftJoin(
            evaluationPillars,
            eq(evaluationParameters.pillarId, evaluationPillars.id)
          )
          .where(inArray(evaluationScores.evaluationId, evaluationIds));
        
        // Aggregate scores by parameter
        scores.forEach(score => {
          const scoreValue = parseInt(score.score);
          if (!isNaN(scoreValue)) {
            if (!parameterScores[score.parameterId]) {
              parameterScores[score.parameterId] = { 
                totalScore: 0, 
                count: 0, 
                average: 0,
                parameterName: score.parameterName || `Parameter ${score.parameterId}`,
                pillarName: score.pillarName || 'Unknown Pillar'
              };
            }
            
            parameterScores[score.parameterId].totalScore += scoreValue;
            parameterScores[score.parameterId].count++;
          }
        });
        
        // Calculate averages for each parameter
        Object.keys(parameterScores).forEach(paramId => {
          const param = parameterScores[parseInt(paramId)];
          param.average = param.count > 0 ? Math.round(param.totalScore / param.count) : 0;
        });
        
        // Calculate total average score
        totalScore = audioFileEvaluations.reduce((sum, evalItem) => 
          sum + parseFloat(evalItem.finalScore.toString()), 0);
      }
      
      return {
        totalEvaluations: audioFileEvaluations.length,
        averageScore: audioFileEvaluations.length > 0 
          ? Math.round(totalScore / audioFileEvaluations.length) 
          : 0,
        parameterScores
      };
    } catch (error) {
      console.error('Error getting quality analyst evaluation stats:', error);
      throw error;
    }
  }
  
  async getBatchEvents(batchId: number, filters?: {
    eventType?: string;
    status?: string;
    organizationId?: number;
  }): Promise<any[]> {
    try {
      console.log(`Fetching batch events for batch ${batchId} with filters:`, filters);
      
      let query = db.select().from(batchEvents).where(eq(batchEvents.batchId, batchId));
      
      // Apply filters if provided
      if (filters) {
        if (filters.eventType) {
          query = query.where(eq(batchEvents.eventType, filters.eventType as any));
        }
        
        if (filters.status) {
          query = query.where(eq(batchEvents.status, filters.status));
        }
        
        if (filters.organizationId) {
          query = query.where(eq(batchEvents.organizationId, filters.organizationId));
        }
      }
      
      // Order by createdAt descending to get the most recent events first
      query = query.orderBy(desc(batchEvents.createdAt));
      
      const events = await query;
      console.log(`Retrieved ${events.length} events for batch ${batchId}`);
      return events;
    } catch (error) {
      console.error('Error fetching batch events:', error);
      return [];
    }
  }

  // Quiz Assignment methods
  async createQuizAssignment(assignment: InsertQuizAssignment): Promise<QuizAssignment> {
    try {
      // Check if quiz exists
      const quiz = await this.getQuiz(assignment.quizId);
      if (!quiz) {
        throw new Error(`Quiz with ID ${assignment.quizId} does not exist`);
      }

      // Check if user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, assignment.userId));
        
      if (!user) {
        throw new Error(`User with ID ${assignment.userId} does not exist`);
      }

      // Check if trainee exists
      const [trainee] = await db
        .select()
        .from(users)
        .where(eq(users.id, assignment.traineeId));
        
      if (!trainee) {
        throw new Error(`Trainee with ID ${assignment.traineeId} does not exist`);
      }

      // Check if trainee is enrolled in the batch - skip if batchId is not provided
      if (assignment.batchId) {
        const [traineeInBatch] = await db
          .select()
          .from(userBatchProcesses)
          .where(eq(userBatchProcesses.userId, assignment.traineeId))
          .where(eq(userBatchProcesses.batchId, assignment.batchId));

        if (!traineeInBatch) {
          console.warn(`Trainee with ID ${assignment.traineeId} is not enrolled in batch ${assignment.batchId}, but will create assignment anyway`);
          // We're not throwing an error here since we don't want to block assignment creation
        }
      }

      // Create the assignment
      const [newAssignment] = await db
        .insert(quizAssignments)
        .values(assignment)
        .returning() as QuizAssignment[];
        
      return newAssignment;
    } catch (error) {
      console.error('Error creating quiz assignment:', error);
      throw error;
    }
  }

  async getQuizAssignments(quizId: number): Promise<QuizAssignment[]> {
    try {
      const assignments = await db
        .select()
        .from(quizAssignments)
        .where(eq(quizAssignments.quizId, quizId)) as QuizAssignment[];
        
      return assignments;
    } catch (error) {
      console.error('Error fetching quiz assignments:', error);
      throw error;
    }
  }

  async getQuizAssignmentsByUser(userId: number): Promise<QuizAssignment[]> {
    try {
      const assignments = await db
        .select()
        .from(quizAssignments)
        .where(eq(quizAssignments.userId, userId)) as QuizAssignment[];
        
      return assignments;
    } catch (error) {
      console.error('Error fetching user quiz assignments:', error);
      throw error;
    }
  }

  async getQuizAssignmentByUserAndQuiz(userId: number, quizId: number): Promise<QuizAssignment | undefined> {
    try {
      const [assignment] = await db
        .select()
        .from(quizAssignments)
        .where(eq(quizAssignments.userId, userId))
        .where(eq(quizAssignments.quizId, quizId)) as QuizAssignment[];
        
      return assignment;
    } catch (error) {
      console.error('Error fetching quiz assignment:', error);
      throw error;
    }
  }

  async listTraineesForQuiz(quizId: number, batchId: number): Promise<{ userId: number; fullName: string }[]> {
    try {
      // Get the quiz
      const quiz = await this.getQuiz(quizId);
      if (!quiz) {
        throw new Error(`Quiz with ID ${quizId} does not exist`);
      }

      // Get the trainees for the batch
      const trainees = await db
        .select({
          userId: users.id,
          fullName: users.fullName
        })
        .from(userBatchProcesses)
        .innerJoin(users, eq(userBatchProcesses.userId, users.id))
        .where(eq(userBatchProcesses.batchId, batchId))
        .where(eq(users.category, 'trainee'));

      return trainees;
    } catch (error) {
      console.error('Error listing trainees for quiz:', error);
      throw error;
    }
  }

  async deleteQuizAssignment(id: number): Promise<void> {
    try {
      await db
        .delete(quizAssignments)
        .where(eq(quizAssignments.id, id));
    } catch (error) {
      console.error('Error deleting quiz assignment:', error);
      throw error;
    }
  }

  // Dashboard operations
  async getUserDashboards(userId: number): Promise<schema.UserDashboard[]> {
    try {
      const dashboards = await db
        .select()
        .from(userDashboards)
        .where(eq(userDashboards.userId, userId))
        .orderBy(userDashboards.createdAt);
      return dashboards;
    } catch (error) {
      console.error('Error fetching user dashboards:', error);
      throw error;
    }
  }

  async createUserDashboard(dashboard: schema.InsertUserDashboard): Promise<schema.UserDashboard> {
    try {
      const [newDashboard] = await db
        .insert(userDashboards)
        .values(dashboard)
        .returning();
      return newDashboard;
    } catch (error) {
      console.error('Error creating user dashboard:', error);
      throw error;
    }
  }

  async getUserDashboard(id: number): Promise<schema.UserDashboard | undefined> {
    try {
      const [dashboard] = await db
        .select()
        .from(userDashboards)
        .where(eq(userDashboards.id, id));
      return dashboard;
    } catch (error) {
      console.error('Error fetching user dashboard:', error);
      throw error;
    }
  }

  async updateUserDashboard(id: number, dashboard: Partial<schema.InsertUserDashboard>): Promise<schema.UserDashboard> {
    try {
      const [updatedDashboard] = await db
        .update(userDashboards)
        .set({
          ...dashboard,
          updatedAt: new Date()
        })
        .where(eq(userDashboards.id, id))
        .returning();
      return updatedDashboard;
    } catch (error) {
      console.error('Error updating user dashboard:', error);
      throw error;
    }
  }

  async deleteUserDashboard(id: number): Promise<void> {
    try {
      // First delete all associated widgets
      await db
        .delete(dashboardWidgets)
        .where(eq(dashboardWidgets.dashboardId, id));
      
      // Then delete the dashboard
      await db
        .delete(userDashboards)
        .where(eq(userDashboards.id, id));
    } catch (error) {
      console.error('Error deleting user dashboard:', error);
      throw error;
    }
  }

  async setDefaultDashboard(userId: number, dashboardId: number): Promise<void> {
    try {
      // Begin transaction
      await db.transaction(async (tx) => {
        // Clear default status on all user dashboards
        await tx
          .update(userDashboards)
          .set({ isDefault: false })
          .where(eq(userDashboards.userId, userId));
        
        // Set new default dashboard
        await tx
          .update(userDashboards)
          .set({ isDefault: true })
          .where(eq(userDashboards.id, dashboardId))
          .where(eq(userDashboards.userId, userId));
      });
    } catch (error) {
      console.error('Error setting default dashboard:', error);
      throw error;
    }
  }

  // Dashboard widget operations
  async getDashboardWidgets(dashboardId: number): Promise<schema.DashboardWidget[]> {
    try {
      const widgets = await db
        .select()
        .from(dashboardWidgets)
        .where(eq(dashboardWidgets.dashboardId, dashboardId))
        .orderBy(dashboardWidgets.position);
      return widgets;
    } catch (error) {
      console.error('Error fetching dashboard widgets:', error);
      throw error;
    }
  }

  async createDashboardWidget(widget: schema.InsertDashboardWidget): Promise<schema.DashboardWidget> {
    try {
      // Get current highest position
      const [lastPositionResult] = await db
        .select({ maxPosition: sql`MAX(${dashboardWidgets.position})` })
        .from(dashboardWidgets)
        .where(eq(dashboardWidgets.dashboardId, widget.dashboardId));
      
      const position = (lastPositionResult?.maxPosition || 0) + 1;
      
      const [newWidget] = await db
        .insert(dashboardWidgets)
        .values({
          ...widget,
          position
        })
        .returning();
      
      return newWidget;
    } catch (error) {
      console.error('Error creating dashboard widget:', error);
      throw error;
    }
  }

  async updateDashboardWidget(id: number, widget: Partial<schema.InsertDashboardWidget>): Promise<schema.DashboardWidget> {
    try {
      const [updatedWidget] = await db
        .update(dashboardWidgets)
        .set({
          ...widget,
          updatedAt: new Date()
        })
        .where(eq(dashboardWidgets.id, id))
        .returning();
      
      return updatedWidget;
    } catch (error) {
      console.error('Error updating dashboard widget:', error);
      throw error;
    }
  }

  async deleteDashboardWidget(id: number): Promise<void> {
    try {
      await db
        .delete(dashboardWidgets)
        .where(eq(dashboardWidgets.id, id));
    } catch (error) {
      console.error('Error deleting dashboard widget:', error);
      throw error;
    }
  }

  // Dashboard Configuration operations
  async getDashboardConfiguration(id: number): Promise<schema.DashboardConfiguration | undefined> {
    try {
      const [config] = await db
        .select()
        .from(schema.dashboardConfigurations)
        .where(eq(schema.dashboardConfigurations.id, id));
      return config;
    } catch (error) {
      console.error('Error getting dashboard configuration:', error);
      throw error;
    }
  }

  async getDashboardConfigurationsByUser(userId: number, organizationId: number): Promise<schema.DashboardConfiguration[]> {
    try {
      const configs = await db
        .select()
        .from(schema.dashboardConfigurations)
        .where(eq(schema.dashboardConfigurations.userId, userId))
        .where(eq(schema.dashboardConfigurations.organizationId, organizationId))
        .orderBy(schema.dashboardConfigurations.isDefault, desc(schema.dashboardConfigurations.updatedAt));
      return configs;
    } catch (error) {
      console.error('Error getting dashboard configurations by user:', error);
      throw error;
    }
  }

  async getDefaultDashboardConfiguration(userId: number, organizationId: number): Promise<schema.DashboardConfiguration | undefined> {
    try {
      const [config] = await db
        .select()
        .from(schema.dashboardConfigurations)
        .where(eq(schema.dashboardConfigurations.userId, userId))
        .where(eq(schema.dashboardConfigurations.organizationId, organizationId))
        .where(eq(schema.dashboardConfigurations.isDefault, true));
      return config;
    } catch (error) {
      console.error('Error getting default dashboard configuration:', error);
      throw error;
    }
  }

  async createDashboardConfiguration(config: schema.InsertDashboardConfiguration): Promise<schema.DashboardConfiguration> {
    try {
      // If this is being set as the default, unset any existing default
      if (config.isDefault) {
        await db
          .update(schema.dashboardConfigurations)
          .set({ isDefault: false })
          .where(eq(schema.dashboardConfigurations.userId, config.userId))
          .where(eq(schema.dashboardConfigurations.organizationId, config.organizationId))
          .where(eq(schema.dashboardConfigurations.isDefault, true));
      }
      
      const [newConfig] = await db
        .insert(schema.dashboardConfigurations)
        .values(config)
        .returning();
      
      return newConfig;
    } catch (error) {
      console.error('Error creating dashboard configuration:', error);
      throw error;
    }
  }

  async updateDashboardConfiguration(id: number, config: Partial<schema.InsertDashboardConfiguration>): Promise<schema.DashboardConfiguration> {
    try {
      // Get the current config to get userId and organizationId
      const [currentConfig] = await db
        .select()
        .from(schema.dashboardConfigurations)
        .where(eq(schema.dashboardConfigurations.id, id));
      
      if (!currentConfig) {
        throw new Error('Dashboard configuration not found');
      }
      
      // If this is being set as the default, unset any existing default
      if (config.isDefault) {
        await db
          .update(schema.dashboardConfigurations)
          .set({ isDefault: false })
          .where(eq(schema.dashboardConfigurations.userId, currentConfig.userId))
          .where(eq(schema.dashboardConfigurations.organizationId, currentConfig.organizationId))
          .where(eq(schema.dashboardConfigurations.isDefault, true))
          .where(ne(schema.dashboardConfigurations.id, id));
      }
      
      const [updatedConfig] = await db
        .update(schema.dashboardConfigurations)
        .set({
          ...config,
          updatedAt: new Date()
        })
        .where(eq(schema.dashboardConfigurations.id, id))
        .returning();
      
      if (!updatedConfig) {
        throw new Error('Dashboard configuration not found');
      }
      
      return updatedConfig;
    } catch (error) {
      console.error('Error updating dashboard configuration:', error);
      throw error;
    }
  }

  async deleteDashboardConfiguration(id: number): Promise<void> {
    try {
      // Get the configuration first to check if it's the default
      const [config] = await db
        .select()
        .from(schema.dashboardConfigurations)
        .where(eq(schema.dashboardConfigurations.id, id));
      
      if (!config) {
        throw new Error('Dashboard configuration not found');
      }
      
      // Delete the configuration
      await db
        .delete(schema.dashboardConfigurations)
        .where(eq(schema.dashboardConfigurations.id, id));
      
      // If this was the default configuration, set another one as default if available
      if (config.isDefault) {
        const [nextConfig] = await db
          .select()
          .from(schema.dashboardConfigurations)
          .where(eq(schema.dashboardConfigurations.userId, config.userId))
          .where(eq(schema.dashboardConfigurations.organizationId, config.organizationId))
          .orderBy(desc(schema.dashboardConfigurations.updatedAt))
          .limit(1);
        
        if (nextConfig) {
          await db
            .update(schema.dashboardConfigurations)
            .set({ isDefault: true })
            .where(eq(schema.dashboardConfigurations.id, nextConfig.id));
        }
      }
    } catch (error) {
      console.error('Error deleting dashboard configuration:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();