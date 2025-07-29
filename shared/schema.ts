import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  date,
  unique,
  numeric,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, type InferSelectModel } from "drizzle-orm";
import { z } from "zod";

// Define all enums at the top
export const questionTypeEnum = pgEnum("question_type", [
  "multiple_choice",
  "true_false",
  "short_answer",
]);

export const evaluationFeedbackStatusEnum = pgEnum(
  "evaluation_feedback_status",
  ["pending", "accepted", "rejected"],
);

export const quizStatusEnum = pgEnum("quiz_status", [
  "active",
  "completed",
  "expired",
]);

export const quizTypeEnum = pgEnum("quiz_type", ["internal", "final"]);

export const batchCategoryEnum = pgEnum("batch_category", [
  "new_training",
  "upskill",
]);

export const batchStatusEnum = pgEnum("batch_status", [
  "planned",
  "induction",
  "training",
  "certification",
  "ojt",
  "ojt_certification",
  "completed",
]);

export const userCategoryTypeEnum = pgEnum("user_category_type", [
  "active",
  "trainee",
]);
export const roleEnum = pgEnum("role", [
  "owner",
  "admin",
  "manager",
  "team_lead",
  "quality_analyst",
  "trainer",
  "advisor",
  "trainee",
]);

export const permissionEnum = pgEnum("permission", [
  "manage_billing",
  "manage_subscription",
  "manage_organization_settings",
  "manage_users",
  "view_users",
  "edit_users",
  "delete_users",
  "upload_users",
  "add_users", // Create new user accounts
  "manage_organization", // Legacy - to be replaced with more specific permissions
  "view_organization", // Legacy - to be replaced with more specific permissions
  "edit_organization", // Legacy - to be replaced with more specific permissions
  "manage_locations", // Full access to locations management
  "manage_processes", // Full access to processes management
  "manage_holidaylist", // Full access to holiday management
  "manage_lineofbusiness", // Full access to line of business management
  "view_performance",
  "manage_performance",
  "export_reports",
  "manage_batches",
  "manage_batch_users_add", // Add users to batches
  "manage_batch_users_remove", // Remove users from batches
  "view_trainee_management", // View trainee management section (read-only)
  "manage_trainee_management", // Full access to trainee management section
  // Quiz management permissions
  "manage_quiz", // Create, edit, delete quizzes
  "take_quiz", // Take quizzes
  "view_quiz", // View quizzes
  "view_take_quiz", // View take quiz section
  // Evaluation form permissions
  "manage_evaluation_form", // Create, edit, delete evaluation forms
  "edit_evaluation_form", // Edit evaluation forms
  "delete_evaluation_form", // Delete evaluation forms
  "create_evaluation_form", // Create evaluation forms
  "view_evaluation_form", // View evaluation forms
  "manage_conduct_form", // Full control over conduct forms
  "manage_evaluation_feedback", // Full control over evaluation feedback
  // Allocation and feedback permissions
  "manage_allocation", // Manage allocations
  "view_allocation", // View allocations
  "manage_feedback", // Manage feedback
  "view_feedback", // View feedback
]);

export const processStatusEnum = pgEnum("process_status", [
  "active",
  "inactive",
  "archived",
]);

export const featureTypeEnum = pgEnum("feature_type", ["LMS", "QMS", "BOTH"]);

// Audio file related enums
export const audioFileStatusEnum = pgEnum("audio_file_status", [
  "pending",
  "allocated",
  "evaluated",
  "archived",
]);

export const audioLanguageEnum = pgEnum("audio_language", [
  "english",
  "spanish",
  "french",
  "german",
  "portuguese",
  "hindi",
  "mandarin",
  "japanese",
  "korean",
  "arabic",
  "russian",
  "tamil",
  "bengali",
  "telugu",
  "other",
]);

// Audio files management
export const audioFiles = pgTable("audio_files", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  duration: numeric("duration", { precision: 10, scale: 2 }).notNull(), // in seconds, with decimal precision
  language: audioLanguageEnum("language"), // Removed notNull to allow empty values
  version: text("version"), // Removed notNull to allow empty values
  call_date: date("call_date"), // Removed notNull to allow empty values
  callMetrics: jsonb("call_metrics").$type<{
    callId: string;
    callType: string;
    agentId: string;
    campaignName: string;
    duration: number; // in minutes
    disposition1: string;
    disposition2: string;
    customerMobile: string;
    callTime: string;
    subType: string;
    subSubType: string;
    VOC: string;
    userRole: string;
    advisorCategory: string;
    queryType: string;
    businessSegment: string;
    [key: string]: any; // For additional metrics
  }>(),
  status: audioFileStatusEnum("status").default("pending").notNull(),
  uploadedBy: integer("uploaded_by")
    .references(() => users.id)
    .notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processId: integer("process_id"),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  batchId: integer("batch_id").references(() => organizationBatches.id),
  evaluationId: integer("evaluation_id").references(() => evaluations.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audio file allocation to quality analysts
export const audioFileAllocations = pgTable("audio_file_allocations", {
  id: serial("id").primaryKey(),
  audioFileId: integer("audio_file_id")
    .references(() => audioFiles.id)
    .notNull(),
  qualityAnalystId: integer("quality_analyst_id")
    .references(() => users.id)
    .notNull(),
  // Using created_at instead of allocation_date to match the existing database structure
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Removed dueDate and notes fields that were causing issues
  status: audioFileStatusEnum("status").default("allocated").notNull(),
  allocatedBy: integer("allocated_by")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  evaluationTemplateId: integer("evaluation_template_id").references(
    () => evaluationTemplates.id,
  ), // Nullable - the template to use for evaluation
  evaluationId: integer("evaluation_id").references(() => evaluations.id), // Nullable - will be set after evaluation is submitted
});

// Audio file batch allocation
export const audioFileBatchAllocations = pgTable(
  "audio_file_batch_allocations",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    status: audioFileStatusEnum("status").default("allocated").notNull(),
    allocationDate: timestamp("allocation_date").defaultNow().notNull(),
    allocatedBy: integer("allocated_by")
      .references(() => users.id)
      .notNull(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),
    dueDate: timestamp("due_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

// Quiz-related tables
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  type: questionTypeEnum("type").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation"),
  difficultyLevel: integer("difficulty_level").notNull(),
  category: text("category").notNull(),
  active: boolean("active").default(true).notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quizTemplates = pgTable("quiz_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  timeLimit: integer("time_limit").notNull(),
  passingScore: integer("passing_score").notNull(),
  shuffleQuestions: boolean("shuffle_questions").default(false).notNull(),
  shuffleOptions: boolean("shuffle_options").default(false).notNull(),
  questionCount: integer("question_count").notNull(),
  categoryDistribution: jsonb("category_distribution").$type<
    Record<string, number>
  >(),
  difficultyDistribution: jsonb("difficulty_distribution").$type<
    Record<string, number>
  >(),
  quizType: quizTypeEnum("quiz_type").default("internal").notNull(),
  oneTimeOnly: boolean("one_time_only").default(false).notNull(),
  generationCount: integer("generation_count").default(0).notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  batchId: integer("batch_id").references(() => organizationBatches.id),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  questions: integer("questions").array().default("{}").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  timeLimit: integer("time_limit").notNull(),
  passingScore: integer("passing_score").notNull(),
  questions: integer("questions").array().default("{}").notNull(),
  templateId: integer("template_id")
    .references(() => quizTemplates.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  status: quizStatusEnum("status").default("active").notNull(),
  quizType: quizTypeEnum("quiz_type").default("internal").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  oneTimeOnly: boolean("one_time_only").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id")
    .references(() => quizzes.id)
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  score: integer("score").notNull(),
  answers: jsonb("answers")
    .$type<
      {
        questionId: number;
        userAnswer: string;
        correctAnswer: string;
        isCorrect: boolean;
      }[]
    >(),
  completedAt: timestamp("completed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quizResponses = pgTable("quiz_responses", {
  id: serial("id").primaryKey(),
  quizAttemptId: integer("quiz_attempt_id")
    .references(() => quizAttempts.id)
    .notNull(),
  questionId: integer("question_id")
    .references(() => questions.id)
    .notNull(),
  selectedAnswer: text("selected_answer").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Table for quiz assignments to specific trainees
export const quizAssignments = pgTable(
  "quiz_assignments",
  {
    id: serial("id").primaryKey(),
    quizId: integer("quiz_id")
      .references(() => quizzes.id)
      .notNull(),
    traineeId: integer("trainee_id")
      .references(() => users.id)
      .notNull(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    batchId: integer("batch_id").references(() => organizationBatches.id),
    organizationId: integer("organization_id").references(
      () => organizations.id,
    ),
    assignedBy: integer("assigned_by").references(() => users.id),
    assignedAt: timestamp("assigned_at").defaultNow(),
    status: text("status").default("assigned"),
  },
  (table) => {
    return {
      // Create unique constraint on quizId and userId to prevent duplicate assignments
      unq: unique().on(table.quizId, table.userId),
    };
  },
);

// Quiz-related types
export type Question = InferSelectModel<typeof questions>;
export type QuizTemplate = InferSelectModel<typeof quizTemplates>;
export type Quiz = InferSelectModel<typeof quizzes>;
export type QuizAttempt = InferSelectModel<typeof quizAttempts>;
export type QuizAssignment = InferSelectModel<typeof quizAssignments>;
export type QuizResponse = InferSelectModel<typeof quizResponses>;

// Quiz-related schemas
export const insertQuestionSchema = createInsertSchema(questions)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    question: z.string().min(1, "Question text is required"),
    type: z.enum(["multiple_choice", "true_false", "short_answer"]),
    options: z
      .array(z.string())
      .min(2, "At least two options are required for multiple choice"),
    correctAnswer: z.string().min(1, "Correct answer is required"),
    explanation: z.string().optional(),
    difficultyLevel: z.number().int().min(1).max(5),
    category: z.string().min(1, "Category is required"),
    active: z.boolean().default(true),
    processId: z.number().int().positive("Process is required"),
    organizationId: z.number().int().positive("Organization is required"),
    createdBy: z.number().int().positive("Creator is required"),
  });

export const insertQuizTemplateSchema = createInsertSchema(quizTemplates)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Quiz name is required"),
    description: z.string().optional(),
    timeLimit: z.number().int().positive("Time limit must be positive"),
    passingScore: z.number().int().min(0).max(100),
    shuffleQuestions: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    questionCount: z
      .number()
      .int()
      .positive("Must select at least one question"),
    categoryDistribution: z.record(z.string(), z.number()).optional(),
    difficultyDistribution: z.record(z.string(), z.number()).optional(),
    oneTimeOnly: z.boolean().default(false),
    quizType: z.enum(["internal", "final"]).default("internal"),
    processId: z.number().int().positive("Process is required"),
    organizationId: z.number().int().positive("Organization is required"),
    batchId: z.number().int().positive("Batch is required").optional(),
    createdBy: z.number().int().positive("Creator is required"),
    questions: z.array(z.number()).min(1, "At least one question is required"),
  });

export const insertQuizSchema = createInsertSchema(quizzes)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    name: z.string().min(1, "Quiz name is required"),
    description: z.string().optional(),
    timeLimit: z.number().int().positive("Time limit must be positive"),
    passingScore: z.number().int().min(0).max(100),
    questions: z.array(z.number()).min(1, "At least one question is required"),
    templateId: z.number().int().positive("Template is required"),
    organizationId: z.number().int().positive("Organization is required"),
    createdBy: z.number().int().positive("Creator is required"),
    processId: z.number().int().positive("Process is required"),
    status: z.enum(["active", "completed", "expired"]).default("active"),
    startTime: z.date(),
    endTime: z.date(),
    oneTimeOnly: z.boolean().default(false),
  });

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    quizId: z.number().int().positive("Quiz is required"),
    userId: z.number().int().positive("User is required"),
    organizationId: z.number().int().positive("Organization is required"),
    score: z.number().int().min(0).max(100),
    answers: z.array(
      z.object({
        questionId: z.number(),
        userAnswer: z.string(),
        correctAnswer: z.string(),
        isCorrect: z.boolean(),
      }),
    ),
    completedAt: z.date(),
  });

export const insertQuizResponseSchema = createInsertSchema(quizResponses)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    quizAttemptId: z.number().int().positive("Quiz attempt is required"),
    questionId: z.number().int().positive("Question is required"),
    selectedAnswer: z.string().min(1, "Selected answer is required"),
    isCorrect: z.boolean(),
  });

// Schema for creating quiz assignments
export const insertQuizAssignmentSchema = createInsertSchema(quizAssignments)
  .omit({
    id: true,
    assignedAt: true,
  })
  .extend({
    quizId: z.number().int().positive("Quiz is required"),
    traineeId: z.number().int().positive("Trainee is required"),
    userId: z.number().int().positive("User is required"),
    batchId: z.number().int().positive("Batch is required"),
    organizationId: z.number().int().positive("Organization is required"),
    assignedBy: z.number().int().positive("Assigner is required"),
    status: z.string().default("assigned"),
  });

export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type InsertQuizTemplate = z.infer<typeof insertQuizTemplateSchema>;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type InsertQuizResponse = z.infer<typeof insertQuizResponseSchema>;
export type InsertQuizAssignment = z.infer<typeof insertQuizAssignmentSchema>;

// Quiz-related relations
export const questionsRelations = relations(questions, ({ one }) => ({
  process: one(organizationProcesses, {
    fields: [questions.processId],
    references: [organizationProcesses.id],
  }),
  organization: one(organizations, {
    fields: [questions.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [questions.createdBy],
    references: [users.id],
  }),
}));

export const quizTemplatesRelations = relations(quizTemplates, ({ one }) => ({
  process: one(organizationProcesses, {
    fields: [quizTemplates.processId],
    references: [organizationProcesses.id],
  }),
  organization: one(organizations, {
    fields: [quizTemplates.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [quizTemplates.createdBy],
    references: [users.id],
  }),
  batch: one(organizationBatches, {
    fields: [quizTemplates.batchId],
    references: [organizationBatches.id],
  }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  template: one(quizTemplates, {
    fields: [quizzes.templateId],
    references: [quizTemplates.id],
  }),
  organization: one(organizations, {
    fields: [quizzes.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [quizzes.createdBy],
    references: [users.id],
  }),
  process: one(organizationProcesses, {
    fields: [quizzes.processId],
    references: [organizationProcesses.id],
  }),
  attempts: many(quizAttempts),
}));

export const quizAttemptsRelations = relations(
  quizAttempts,
  ({ one, many }) => ({
    quiz: one(quizzes, {
      fields: [quizAttempts.quizId],
      references: [quizzes.id],
    }),
    user: one(users, {
      fields: [quizAttempts.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [quizAttempts.organizationId],
      references: [organizations.id],
    }),
    responses: many(quizResponses),
  }),
);

export const quizResponsesRelations = relations(quizResponses, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [quizResponses.quizAttemptId],
    references: [quizAttempts.id],
  }),
  question: one(questions, {
    fields: [quizResponses.questionId],
    references: [questions.id],
  }),
}));

export const batchTemplates = pgTable("batch_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  locationId: integer("location_id")
    .references(() => organizationLocations.id)
    .notNull(),
  lineOfBusinessId: integer("line_of_business_id")
    .references(() => organizationLineOfBusinesses.id)
    .notNull(),
  trainerId: integer("trainer_id").references(() => users.id, {
    onDelete: "set null",
  }),
  batchCategory: batchCategoryEnum("batch_category").notNull(),
  capacityLimit: integer("capacity_limit").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BatchTemplate = InferSelectModel<typeof batchTemplates>;
export type AudioFile = InferSelectModel<typeof audioFiles>;
export type AudioFileAllocation = InferSelectModel<typeof audioFileAllocations>;
export type AudioFileBatchAllocation = InferSelectModel<
  typeof audioFileBatchAllocations
>;

// Audio file schemas
export const insertAudioFileSchema = createInsertSchema(audioFiles)
  .omit({
    id: true,
    uploadedAt: true,
    updatedAt: true,
  })
  .extend({
    filename: z.string().min(1, "Filename is required"),
    originalFilename: z.string().min(1, "Original filename is required"),
    fileUrl: z.string().url("File URL must be a valid URL"),
    fileSize: z.number().int().positive("File size must be positive"),
    duration: z.number().positive("Duration must be positive"), // Removed .int() to allow decimal values
    language: z
      .enum(["english", "spanish", "french", "hindi", "other"])
      .optional(),
    version: z.string().min(1, "Version is required").optional(),
    call_date: z
      .string()
      .refine(
        (val) => {
          return !!val.match(/^\d{4}-\d{2}-\d{2}$/);
        },
        { message: "Call date must be in YYYY-MM-DD format" },
      )
      .optional(),
    callMetrics: z
      .object({
        callId: z.string(),
        callType: z.string(),
        agentId: z.string(),
        campaignName: z.string(),
        duration: z.number(), // in minutes
        disposition1: z.string(),
        disposition2: z.string(),
        customerMobile: z.string(),
        callTime: z.string(),
        subType: z.string(),
        subSubType: z.string(),
        VOC: z.string(),
        userRole: z.string(),
        advisorCategory: z.string(),
        queryType: z.string(),
        businessSegment: z.string(),
      })
      .optional(),
    status: z
      .enum(["pending", "allocated", "evaluated", "archived"])
      .default("pending"),
    uploadedBy: z.number().int().positive("Uploader is required"),
    processId: z.number().int().positive("Process is required").optional(),
    organizationId: z.number().int().positive("Organization is required"),
    batchId: z.number().int().positive("Batch is required").optional(),
  });

export const insertAudioFileAllocationSchema = createInsertSchema(
  audioFileAllocations,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    audioFileId: z.number().int().positive("Audio file is required"),
    qualityAnalystId: z.number().int().positive("Quality analyst is required"),
    // Removed dueDate, completedDate, and notes fields that were causing issues
    status: z
      .enum(["pending", "allocated", "evaluated", "archived"])
      .default("allocated"),
    allocatedBy: z.number().int().positive("Allocator is required"),
    organizationId: z.number().int().positive("Organization is required"),
    evaluationTemplateId: z
      .number()
      .int()
      .positive("Evaluation template is required")
      .optional(),
    evaluationId: z
      .number()
      .int()
      .positive("Evaluation is required")
      .optional(),
  });

export const insertAudioFileBatchAllocationSchema = createInsertSchema(
  audioFileBatchAllocations,
)
  .omit({
    id: true,
    allocationDate: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Batch name is required"),
    description: z.string().optional(),
    status: z
      .enum(["pending", "allocated", "evaluated", "archived"])
      .default("allocated"),
    allocatedBy: z.number().int().positive("Allocator is required"),
    organizationId: z.number().int().positive("Organization is required"),
    dueDate: z.date().optional(),
  });

export type InsertAudioFile = z.infer<typeof insertAudioFileSchema>;
export type InsertAudioFileAllocation = z.infer<
  typeof insertAudioFileAllocationSchema
>;
export type InsertAudioFileBatchAllocation = z.infer<
  typeof insertAudioFileBatchAllocationSchema
>;

// Audio file relations
export const audioFilesRelations = relations(audioFiles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [audioFiles.organizationId],
    references: [organizations.id],
  }),
  uploader: one(users, {
    fields: [audioFiles.uploadedBy],
    references: [users.id],
  }),
  batch: one(organizationBatches, {
    fields: [audioFiles.batchId],
    references: [organizationBatches.id],
  }),
  evaluation: one(evaluations, {
    fields: [audioFiles.evaluationId],
    references: [evaluations.id],
  }),
  allocations: many(audioFileAllocations),
}));

export const audioFileAllocationsRelations = relations(
  audioFileAllocations,
  ({ one }) => ({
    audioFile: one(audioFiles, {
      fields: [audioFileAllocations.audioFileId],
      references: [audioFiles.id],
    }),
    qualityAnalyst: one(users, {
      fields: [audioFileAllocations.qualityAnalystId],
      references: [users.id],
    }),
    allocator: one(users, {
      fields: [audioFileAllocations.allocatedBy],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [audioFileAllocations.organizationId],
      references: [organizations.id],
    }),
    evaluationTemplate: one(evaluationTemplates, {
      fields: [audioFileAllocations.evaluationTemplateId],
      references: [evaluationTemplates.id],
    }),
    evaluation: one(evaluations, {
      fields: [audioFileAllocations.evaluationId],
      references: [evaluations.id],
    }),
  }),
);

export const audioFileBatchAllocationsRelations = relations(
  audioFileBatchAllocations,
  ({ one }) => ({
    allocator: one(users, {
      fields: [audioFileBatchAllocations.allocatedBy],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [audioFileBatchAllocations.organizationId],
      references: [organizations.id],
    }),
  }),
);

// Add template schema validation
export const insertBatchTemplateSchema = createInsertSchema(batchTemplates)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Template name is required"),
    description: z.string().optional(),
    organizationId: z.number().int().positive("Organization is required"),
    processId: z.number().int().positive("Process is required"),
    locationId: z.number().int().positive("Location is required"),
    lineOfBusinessId: z.number().int().positive("Line of Business is required"),
    trainerId: z.number().int().positive("Trainer is required"),
    batchCategory: z.enum(["new_training", "upskill"]),
    capacityLimit: z.number().int().min(1, "Capacity must be at least 1"),
  });

export type InsertBatchTemplate = z.infer<typeof insertBatchTemplateSchema>;

// Add relations for batch templates
export const batchTemplatesRelations = relations(batchTemplates, ({ one }) => ({
  organization: one(organizations, {
    fields: [batchTemplates.organizationId],
    references: [organizations.id],
  }),
  process: one(organizationProcesses, {
    fields: [batchTemplates.processId],
    references: [organizationProcesses.id],
  }),
  location: one(organizationLocations, {
    fields: [batchTemplates.locationId],
    references: [organizationLocations.id],
  }),
  lob: one(organizationLineOfBusinesses, {
    fields: [batchTemplates.lineOfBusinessId],
    references: [organizationLineOfBusinesses.id],
  }),
  trainer: one(users, {
    fields: [batchTemplates.trainerId],
    references: [users.id],
  }),
}));

export const organizationBatches = pgTable("organization_batches", {
  id: serial("id").primaryKey(),
  batchCategory: batchCategoryEnum("batch_category").notNull(),
  name: text("name").notNull().unique(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: batchStatusEnum("status").default("planned").notNull(),
  capacityLimit: integer("capacity_limit").notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  locationId: integer("location_id")
    .references(() => organizationLocations.id)
    .notNull(),
  trainerId: integer("trainer_id").references(() => users.id, {
    onDelete: "set null",
  }),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  lineOfBusinessId: integer("line_of_business_id")
    .references(() => organizationLineOfBusinesses.id)
    .notNull(),
  // Planned phase dates
  inductionStartDate: date("induction_start_date").notNull(),
  inductionEndDate: date("induction_end_date"),
  trainingStartDate: date("training_start_date"),
  trainingEndDate: date("training_end_date"),
  certificationStartDate: date("certification_start_date"),
  certificationEndDate: date("certification_end_date"),
  ojtStartDate: date("ojt_start_date"),
  ojtEndDate: date("ojt_end_date"),
  ojtCertificationStartDate: date("ojt_certification_start_date"),
  ojtCertificationEndDate: date("ojt_certification_end_date"),
  handoverToOpsDate: date("handover_to_ops_date"),
  // Actual phase dates
  actualInductionStartDate: date("actual_induction_start_date"),
  actualInductionEndDate: date("actual_induction_end_date"),
  actualTrainingStartDate: date("actual_training_start_date"),
  actualTrainingEndDate: date("actual_training_end_date"),
  actualCertificationStartDate: date("actual_certification_start_date"),
  actualCertificationEndDate: date("actual_certification_end_date"),
  actualOjtStartDate: date("actual_ojt_start_date"),
  actualOjtEndDate: date("actual_ojt_end_date"),
  actualOjtCertificationStartDate: date("actual_ojt_certification_start_date"),
  actualOjtCertificationEndDate: date("actual_ojt_certification_end_date"),
  actualHandoverToOpsDate: date("actual_handover_to_ops_date"),
  weeklyOffDays: text("weekly_off_days")
    .array()
    .default(["Saturday", "Sunday"]),
  considerHolidays: boolean("consider_holidays").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OrganizationBatch = InferSelectModel<typeof organizationBatches>;

// Add relations for batches
export const organizationBatchesRelations = relations(
  organizationBatches,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationBatches.organizationId],
      references: [organizations.id],
    }),
    process: one(organizationProcesses, {
      fields: [organizationBatches.processId],
      references: [organizationProcesses.id],
    }),
    location: one(organizationLocations, {
      fields: [organizationBatches.locationId],
      references: [organizationLocations.id],
    }),
    lob: one(organizationLineOfBusinesses, {
      fields: [organizationBatches.lineOfBusinessId],
      references: [organizationLineOfBusinesses.id],
    }),
    trainer: one(users, {
      fields: [organizationBatches.trainerId],
      references: [users.id],
    }),
  }),
);

// Update validation schema to properly handle the enum
export const insertOrganizationBatchSchema = createInsertSchema(
  organizationBatches,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    batchCategory: z.enum(["new_training", "upskill"]),
    name: z.string().min(1, "Batch name is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    inductionStartDate: z.string().min(1, "Induction Start date is required"),
    inductionEndDate: z.string().optional(),
    trainingStartDate: z.string().optional(),
    trainingEndDate: z.string().optional(),
    certificationStartDate: z.string().optional(),
    certificationEndDate: z.string().optional(),
    ojtStartDate: z.string().optional(),
    ojtEndDate: z.string().optional(),
    ojtCertificationStartDate: z.string().optional(),
    ojtCertificationEndDate: z.string().optional(),
    handoverToOpsDate: z.string().optional(),
    weeklyOffDays: z.array(z.string()).default(["Saturday", "Sunday"]),
    considerHolidays: z.boolean().default(true),
    capacityLimit: z.number().int().min(1, "Capacity must be at least 1"),
    status: z
      .enum([
        "planned",
        "induction",
        "training",
        "certification",
        "ojt",
        "ojt_certification",
        "completed",
      ])
      .default("planned"),
    processId: z.number().int().positive("Process is required"),
    locationId: z.number().int().positive("Location is required"),
    lineOfBusinessId: z.number().int().positive("Line of Business is required"),
    trainerId: z.number().int().positive("Trainer is required"),
    organizationId: z.number().int().positive("Organization is required"),
  });

export type InsertOrganizationBatch = z.infer<
  typeof insertOrganizationBatchSchema
>;

// Organization settings for weekly off days and holidays
export const organizationSettings = pgTable("organization_settings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  featureType: featureTypeEnum("feature_type").default("BOTH").notNull(),
  weeklyOffDays: text("weekly_off_days")
    .array()
    .notNull()
    .default(["Saturday", "Sunday"]),
  userLimit: integer("user_limit").default(400).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OrganizationSettings = InferSelectModel<
  typeof organizationSettings
>;

export const insertOrganizationSettingsSchema = createInsertSchema(
  organizationSettings,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    organizationId: z.number().int().positive("Organization is required"),
    featureType: z.enum(["LMS", "QMS", "BOTH"]).default("BOTH"),
    userLimit: z.number().int().min(1).max(500).default(500),
  });

export type InsertOrganizationSettings = z.infer<typeof insertOrganizationSettingsSchema>;

// User dashboard configurations
export const userDashboards = pgTable("user_dashboards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserDashboard = InferSelectModel<typeof userDashboards>;

export const insertUserDashboardSchema = createInsertSchema(userDashboards)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    userId: z.number().int().positive("User is required"),
    name: z.string().min(1, "Dashboard name is required"),
    description: z.string().optional(),
    isDefault: z.boolean().default(false),
  });

export type InsertUserDashboard = z.infer<typeof insertUserDashboardSchema>;

// Dashboard widget configurations
export const dashboardWidgets = pgTable("dashboard_widgets", {
  id: serial("id").primaryKey(),
  dashboardId: integer("dashboard_id")
    .references(() => userDashboards.id)
    .notNull(),
  widgetType: text("widget_type").notNull(),
  position: jsonb("position").$type<{ x: number; y: number; w: number; h: number }>().notNull(),
  configuration: jsonb("configuration").$type<{
    title: string;
    description?: string;
    chartType?: string;
    size?: string;
    customColors?: Record<string, string>;
    filters?: Record<string, any>;
  }>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DashboardWidget = InferSelectModel<typeof dashboardWidgets>;

export const insertDashboardWidgetSchema = createInsertSchema(dashboardWidgets)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    dashboardId: z.number().int().positive("Dashboard is required"),
    widgetType: z.string().min(1, "Widget type is required"),
    position: z.object({
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      w: z.number().int().min(1),
      h: z.number().int().min(1),
    }),
    configuration: z.object({
      title: z.string().min(1, "Title is required"),
      description: z.string().optional(),
      chartType: z.string().optional(),
      size: z.string().optional(),
      customColors: z.record(z.string(), z.string()).optional(),
      filters: z.record(z.string(), z.any()).optional(),
    }),
  });

export type InsertDashboardWidget = z.infer<typeof insertDashboardWidgetSchema>;

// Dashboard relations
export const userDashboardsRelations = relations(userDashboards, ({ one, many }) => ({
  user: one(users, {
    fields: [userDashboards.userId],
    references: [users.id],
  }),
  widgets: many(dashboardWidgets),
}));

export const dashboardWidgetsRelations = relations(dashboardWidgets, ({ one }) => ({
  dashboard: one(userDashboards, {
    fields: [dashboardWidgets.dashboardId],
    references: [userDashboards.id],
  }),
}));

export const organizationSettingsRelations = relations(
  organizationSettings,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSettings.organizationId],
      references: [organizations.id],
    }),
  }),
);

// Organization holidays
export const organizationHolidays = pgTable("organization_holidays", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  date: date("date").notNull(),
  locationId: integer("location_id").references(() => organizationLocations.id),
  isRecurring: boolean("is_recurring").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OrganizationHoliday = InferSelectModel<typeof organizationHolidays>;

export const insertOrganizationHolidaySchema = createInsertSchema(
  organizationHolidays,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    organizationId: z.number().int().positive("Organization is required"),
    name: z.string().min(1, "Holiday name is required"),
    date: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Invalid date format"),
    locationId: z.number().int().positive("Location is required").optional(),
    isRecurring: z.boolean().default(false),
  });

export type InsertOrganizationHoliday = z.infer<
  typeof insertOrganizationHolidaySchema
>;

export const organizationHolidaysRelations = relations(
  organizationHolidays,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationHolidays.organizationId],
      references: [organizations.id],
    }),
    location: one(organizationLocations, {
      fields: [organizationHolidays.locationId],
      references: [organizationLocations.id],
    }),
  }),
);

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Organization = InferSelectModel<typeof organizations>;

export const organizationProcesses = pgTable("organization_processes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  status: processStatusEnum("status").default("active").notNull(),
  inductionDays: integer("induction_days").notNull(),
  trainingDays: integer("training_days").notNull(),
  certificationDays: integer("certification_days").notNull(),
  ojtDays: integer("ojt_days").notNull(),
  ojtCertificationDays: integer("ojt_certification_days").notNull(),
  lineOfBusinessId: integer("line_of_business_id")
    .references(() => organizationLineOfBusinesses.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OrganizationProcess = typeof organizationProcesses.$inferSelect;

export const organizationLocations = pgTable("organization_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OrganizationLocation = InferSelectModel<
  typeof organizationLocations
>;

export const organizationLineOfBusinesses = pgTable(
  "organization_line_of_businesses",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description").notNull(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);

export type OrganizationLineOfBusiness = InferSelectModel<
  typeof organizationLineOfBusinesses
>;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  employeeId: text("employee_id").notNull().unique(),
  role: roleEnum("role").notNull(),
  category: userCategoryTypeEnum("category").default("trainee").notNull(),
  locationId: integer("location_id").references(() => organizationLocations.id),
  email: text("email").notNull().unique(),
  education: text("education"),
  dateOfJoining: date("date_of_joining"),
  phoneNumber: text("phone_number"),
  dateOfBirth: date("date_of_birth"),
  lastWorkingDay: date("last_working_day"),
  organizationId: integer("organization_id").references(() => organizations.id),
  managerId: integer("manager_id").references(() => users.id),
  active: boolean("active").notNull().default(true),
  certified: boolean("certified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpires: timestamp("reset_password_expires"),
});

export type User = InferSelectModel<typeof users>;

export const userProcesses = pgTable(
  "user_processes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    processId: integer("process_id")
      .references(() => organizationProcesses.id)
      .notNull(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),
    lineOfBusinessId: integer("line_of_business_id").references(
      () => organizationLineOfBusinesses.id,
    ),
    locationId: integer("location_id").references(
      () => organizationLocations.id,
    ),
    status: text("status").default("assigned").notNull(),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      unq: unique().on(table.userId, table.processId),
    };
  },
);

export type UserProcess = typeof userProcesses.$inferSelect;

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: roleEnum("role").notNull(),
  permissions: jsonb("permissions").notNull().$type<string[]>(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  processes: many(organizationProcesses),
  locations: many(organizationLocations),
  lineOfBusinesses: many(organizationLineOfBusinesses),
  rolePermissions: many(rolePermissions),
  batches: many(organizationBatches),
}));

export const organizationProcessesRelations = relations(
  organizationProcesses,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [organizationProcesses.organizationId],
      references: [organizations.id],
    }),
    lineOfBusiness: one(organizationLineOfBusinesses, {
      fields: [organizationProcesses.lineOfBusinessId],
      references: [organizationLineOfBusinesses.id],
    }),
    batches: many(organizationBatches),
    templates: many(batchTemplates),
  }),
);

export const organizationLocationsRelations = relations(
  organizationLocations,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [organizationLocations.organizationId],
      references: [organizations.id],
    }),
    batches: many(organizationBatches),
  }),
);

export const userBatchStatusEnum = pgEnum("user_batch_status", [
  "active",
  "completed",
  "dropped",
  "on_hold",
]);

// Trainee phase status enum - includes all batch phases plus special statuses
export const traineePhaseStatusEnum = pgEnum("trainee_phase_status", [
  "planned",
  "induction",
  "training",
  "certification",
  "ojt",
  "ojt_certification",
  "completed",
  "refresher", // Special status: Trainee needs additional training
  "refer_to_hr", // Special status: Trainee has HR-related issues
  "left_job", // Special status: Trainee has left the job
]);

export const userBatchProcesses = pgTable(
  "user_batch_processes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    batchId: integer("batch_id")
      .references(() => organizationBatches.id)
      .notNull(),
    processId: integer("process_id")
      .references(() => organizationProcesses.id)
      .notNull(),
    status: userBatchStatusEnum("status").default("active").notNull(),
    // New field for trainee status that can be different from batch status
    traineeStatus: traineePhaseStatusEnum("trainee_status"),
    // Flag to indicate if trainee status has been manually set
    isManualStatus: boolean("is_manual_status").default(false),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      // Ensure a user can only be assigned to a batch-process combination once
      unq: unique().on(table.userId, table.batchId, table.processId),
    };
  },
);

export type UserBatchProcess = InferSelectModel<typeof userBatchProcesses>;

export const insertUserBatchProcessSchema = createInsertSchema(
  userBatchProcesses,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    userId: z.number().int().positive("User ID is required"),
    batchId: z.number().int().positive("Batch ID is required"),
    processId: z.number().int().positive("Process ID is required"),
    status: z
      .enum(["active", "completed", "dropped", "on_hold"])
      .default("active"),
    traineeStatus: z
      .enum([
        "planned",
        "induction",
        "training",
        "certification",
        "ojt",
        "ojt_certification",
        "completed",
        "refresher",
        "refer_to_hr",
      ])
      .optional(),
    isManualStatus: z.boolean().default(false),
    joinedAt: z.string().min(1, "Joined date is required"),
    completedAt: z.string().optional(),
  });

export type InsertUserBatchProcess = z.infer<
  typeof insertUserBatchProcessSchema
>;

export const userBatchProcessesRelations = relations(
  userBatchProcesses,
  ({ one }) => ({
    user: one(users, {
      fields: [userBatchProcesses.userId],
      references: [users.id],
    }),
    batch: one(organizationBatches, {
      fields: [userBatchProcesses.batchId],
      references: [organizationBatches.id],
    }),
    process: one(organizationProcesses, {
      fields: [userBatchProcesses.processId],
      references: [organizationProcesses.id],
    }),
  }),
);

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  manager: one(users, {
    fields: [users.managerId],
    references: [users.id],
  }),
  location: one(organizationLocations, {
    fields: [users.locationId],
    references: [organizationLocations.id],
  }),
  managedProcesses: many(userProcesses),
  batches: many(organizationBatches),
  batchProcesses: many(userBatchProcesses),
}));

export const userProcessesRelations = relations(userProcesses, ({ one }) => ({
  user: one(users, {
    fields: [userProcesses.userId],
    references: [users.id],
  }),
  process: one(organizationProcesses, {
    fields: [userProcesses.processId],
    references: [organizationProcesses.id],
  }),
  organization: one(organizations, {
    fields: [userProcesses.organizationId],
    references: [organizations.id],
  }),
  lineOfBusiness: one(organizationLineOfBusinesses, {
    fields: [userProcesses.lineOfBusinessId],
    references: [organizationLineOfBusinesses.id],
  }),
  location: one(organizationLocations, {
    fields: [userProcesses.locationId],
    references: [organizationLocations.id],
  }),
}));

export const rolePermissionsRelations = relations(
  rolePermissions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [rolePermissions.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const insertOrganizationProcessSchema = createInsertSchema(
  organizationProcesses,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Process name is required"),
    description: z.string().optional(),
    status: z.enum(["active", "inactive", "archived"]).default("active"),
    inductionDays: z.number().min(0, "Induction days cannot be negative"),
    trainingDays: z.number().min(0, "Training days cannot be negative"),
    certificationDays: z
      .number()
      .min(0, "Certification days cannot be negative"),
    ojtDays: z.number().min(0, "OJT days cannot be negative"),
    ojtCertificationDays: z
      .number()
      .min(0, "OJT certification days cannot be negative"),
    lineOfBusinessId: z.number().int().positive("Line of Business is required"),
    organizationId: z.number().int().positive("Organization is required"),
  });

export const insertOrganizationLocationSchema = createInsertSchema(
  organizationLocations,
)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    name: z.string().min(1, "Location name is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    country: z.string().min(1, "Country is required"),
    organizationId: z.number().int().positive("Organization is required"),
  });

export const insertOrganizationLineOfBusinessSchema = createInsertSchema(
  organizationLineOfBusinesses,
)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    name: z.string().min(1, "LOBname is required"),
    description: z.string().min(1, "Description is required"),
    organizationId: z.number().int().positive("Organization is required"),
  });

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true })
  .extend({
    fullName: z.string().min(1, "Full name is required"),
    employeeId: z.string().min(1, "Employee ID is required"),
    email: z.string().email("Invalid email format"),
    phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
    dateOfJoining: z.string().optional(),
    dateOfBirth: z.string().optional(),
    lastWorkingDay: z.string().optional().nullable(),
    education: z.string().optional(),
    certified: z.boolean().default(false),
    active: z.boolean().default(true),
    category: z.enum(["active", "trainee"]).default("trainee"),
    role: z
      .enum([
        "owner",
        "admin",
        "manager",
        "team_lead",
        "quality_analyst",
        "trainer",
        "advisor",
        "trainee",
      ])
      .default("trainee"),
    // We'll add line of business validation through userProcesses which will be validated separately
  });

// Helper function to check if a role requires line of business selection
export const requiresLineOfBusiness = (role: string): boolean => {
  return !["owner", "admin"].includes(role);
};

export const insertRolePermissionSchema = createInsertSchema(
  rolePermissions,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserWithProcessesSchema = insertUserSchema.extend({
  processes: z.array(z.number()).optional(),
});

export type InsertUserWithProcesses = z.infer<
  typeof insertUserWithProcessesSchema
>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertOrganizationProcess = z.infer<
  typeof insertOrganizationProcessSchema
>;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type InsertBatchTemplate = z.infer<typeof insertBatchTemplateSchema>;

export const batchHistoryEventTypeEnum = pgEnum("batch_history_event_type", [
  "phase_change",
  "status_update",
  "milestone",
  "note",
]);

export const batchHistory = pgTable("batch_history", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id")
    .references(() => organizationBatches.id)
    .notNull(),
  eventType: batchHistoryEventTypeEnum("event_type").notNull(),
  description: text("description").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  date: timestamp("date").defaultNow().notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BatchHistory = InferSelectModel<typeof batchHistory>;

// Batch calendar events for scheduling refresher trainings, etc.
export const batchEventStatusEnum = pgEnum("batch_event_status", [
  "scheduled",
  "completed",
  "cancelled",
]);

export const batchEventTypeEnum = pgEnum("batch_event_type", [
  "refresher",
  "quiz",
  "training",
  "meeting",
  "other",
]);

export const batchEvents = pgTable("batch_events", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id")
    .references(() => organizationBatches.id)
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  eventType: batchEventTypeEnum("event_type").default("other").notNull(),
  status: batchEventStatusEnum("status").default("scheduled").notNull(),
  refresherReason: text("refresher_reason"), // Added field for refresher reason
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BatchEvent = InferSelectModel<typeof batchEvents>;

export const insertBatchHistorySchema = createInsertSchema(batchHistory)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    batchId: z.number().int().positive("Batch ID is required"),
    eventType: z.enum(["phase_change", "status_update", "milestone", "note"]),
    description: z.string().min(1, "Description is required"),
    previousValue: z.string().optional(),
    newValue: z.string().optional(),
    date: z.string().min(1, "Date is required"),
    userId: z.number().int().positive("User ID is required"),
    organizationId: z.number().int().positive("Organization ID is required"),
  });

export type InsertBatchHistory = z.infer<typeof insertBatchHistorySchema>;

export const batchHistoryRelations = relations(batchHistory, ({ one }) => ({
  batch: one(organizationBatches, {
    fields: [batchHistory.batchId],
    references: [organizationBatches.id],
  }),
  user: one(users, {
    fields: [batchHistory.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [batchHistory.organizationId],
    references: [organizations.id],
  }),
}));

export interface RolePermission {
  id: number;
  role: string;
  permissions: string[];
  organizationId: number;
  createdAt: Date;
  updatedAt: Date;
}

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "leave",
  "half_day",
  "public_holiday",
  "weekly_off",
  "left_job",
]);

export const attendance = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    traineeId: integer("trainee_id")
      .references(() => users.id)
      .notNull(),
    batchId: integer("batch_id")
      .references(() => organizationBatches.id)
      .notNull(),
    phase: batchStatusEnum("phase").notNull(),
    status: attendanceStatusEnum("status").notNull(),
    date: date("date").notNull(),
    markedById: integer("marked_by_id")
      .references(() => users.id)
      .notNull(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      // Ensure only one attendance record per trainee per day per batch
      unq: unique().on(table.traineeId, table.date, table.batchId),
    };
  },
);

export const attendanceRelations = relations(attendance, ({ one }) => ({
  trainee: one(users, {
    fields: [attendance.traineeId],
    references: [users.id],
  }),
  markedBy: one(users, {
    fields: [attendance.markedById],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [attendance.organizationId],
    references: [organizations.id],
  }),
  batch: one(organizationBatches, {
    fields: [attendance.batchId],
    references: [organizationBatches.id],
  }),
}));

export const insertAttendanceSchema = createInsertSchema(attendance)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    traineeId: z.number().int().positive("Trainee ID is required"),
    batchId: z.number().int().positive("Batch ID is required"),
    phase: z.enum([
      "induction",
      "training",
      "certification",
      "ojt",
      "ojt_certification",
    ]),
    status: z.enum([
      "present",
      "absent",
      "late",
      "leave",
      "half_day",
      "public_holiday",
      "weekly_off",
      "left_job",
    ]),
    date: z.string().min(1, "Date is required"),
    markedById: z.number().int().positive("Marker ID is required"),
    organizationId: z.number().int().positive("Organization ID is required"),
  });

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = InferSelectModel<typeof attendance>;

export const phaseChangeRequestStatusEnum = pgEnum(
  "phase_change_request_status",
  ["pending", "approved", "rejected"],
);

export const batchPhaseChangeRequests = pgTable("batch_phase_change_requests", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id")
    .references(() => organizationBatches.id)
    .notNull(),
  trainerId: integer("trainer_id")
    .references(() => users.id)
    .notNull(),
  managerId: integer("manager_id")
    .references(() => users.id)
    .notNull(),
  currentPhase: batchStatusEnum("current_phase").notNull(),
  requestedPhase: batchStatusEnum("requested_phase").notNull(),
  justification: text("justification").notNull(),
  status: phaseChangeRequestStatusEnum("status").default("pending").notNull(),
  managerComments: text("manager_comments"),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const batchPhaseChangeRequestsRelations = relations(
  batchPhaseChangeRequests,
  ({ one }) => ({
    batch: one(organizationBatches, {
      fields: [batchPhaseChangeRequests.batchId],
      references: [organizationBatches.id],
    }),
    trainer: one(users, {
      fields: [batchPhaseChangeRequests.trainerId],
      references: [users.id],
    }),
    manager: one(users, {
      fields: [batchPhaseChangeRequests.managerId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [batchPhaseChangeRequests.organizationId],
      references: [organizations.id],
    }),
  }),
);

export type BatchPhaseChangeRequest = InferSelectModel<
  typeof batchPhaseChangeRequests
>;

export const insertBatchPhaseChangeRequestSchema = createInsertSchema(
  batchPhaseChangeRequests,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    batchId: z.number().int().positive("Batch ID is required"),
    trainerId: z.number().int().positive("Trainer ID is required"),
    managerId: z.number().int().positive("Manager ID is required"),
    currentPhase: z.enum([
      "planned",
      "induction",
      "training",
      "certification",
      "ojt",
      "ojt_certification",
      "completed",
    ]),
    requestedPhase: z.enum([
      "planned",
      "induction",
      "training",
      "certification",
      "ojt",
      "ojt_certification",
      "completed",
    ]),
    justification: z.string().min(1, "Justification is required"),
    status: z.enum(["pending", "approved", "rejected"]).default("pending"),
    managerComments: z.string().optional(),
    organizationId: z.number().int().positive("Organization ID is required"),
  });

export type InsertBatchPhaseChangeRequest = z.infer<
  typeof insertBatchPhaseChangeRequestSchema
>;

export type {
  Organization,
  OrganizationProcess,
  OrganizationLocation,
  OrganizationLineOfBusiness,
  User,
  UserProcess,
  BatchTemplate,
  UserBatchProcess,
  InsertUser,
  InsertOrganization,
  InsertOrganizationProcess,
  InsertRolePermission,
  InsertOrganizationBatch,
  InsertBatchTemplate,
  InsertUserBatchProcess,
  RolePermission,
  Attendance,
  BatchPhaseChangeRequest,
  InsertBatchPhaseChangeRequest,
  InsertAttendance,
  BatchHistory,
  InsertBatchHistory,
  Question,
  QuizTemplate,
  QuizAttempt,
  QuizResponse,
  InsertQuestion,
  InsertQuizTemplate,
  InsertQuizAttempt,
  InsertQuizResponse,
  Quiz,
  InsertQuiz,
  MockCallScenario,
  MockCallAttempt,
  InsertMockCallScenario,
  InsertMockCallAttempt,
  EvaluationTemplate,
  EvaluationPillar,
  EvaluationParameter,
  EvaluationSubReason,
  EvaluationResult,
  EvaluationParameterResult,
  InsertEvaluationTemplate,
  InsertEvaluationPillar,
  InsertEvaluationParameter,
  InsertEvaluationSubReason,
  InsertEvaluationResult,
  InsertEvaluationParameterResult,
  AudioFile,
  AudioFileAllocation,
  AudioFileBatchAllocation,
  InsertAudioFile,
  InsertAudioFileAllocation,
  InsertAudioFileBatchAllocation,
};

// Add new enums for mock calls
export const mockCallDifficultyEnum = pgEnum("mock_call_difficulty", [
  "basic",
  "intermediate",
  "advanced",
]);

export const callEvaluationStatusEnum = pgEnum("call_evaluation_status", [
  "pending",
  "completed",
  "failed",
]);

// Mock call scenarios table
export const mockCallScenarios = pgTable("mock_call_scenarios", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  difficulty: mockCallDifficultyEnum("difficulty").notNull(),
  customerProfile: jsonb("customer_profile")
    .$type<{
      name: string;
      background: string;
      personality: string;
      concerns: string[];
    }>()
    .notNull(),
  expectedDialogue: jsonb("expected_dialogue")
    .$type<{
      greeting: string;
      keyPoints: string[];
      resolutions: string[];
      closingStatements: string[];
    }>()
    .notNull(),
  evaluationRubric: jsonb("evaluation_rubric")
    .$type<{
      greetingScore: number;
      problemIdentificationScore: number;
      solutionScore: number;
      communicationScore: number;
      closingScore: number;
    }>()
    .notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Mock call attempts table
export const mockCallAttempts = pgTable("mock_call_attempts", {
  id: serial("id").primaryKey(),
  scenarioId: integer("scenario_id")
    .references(() => mockCallScenarios.id)
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  evaluatorId: integer("evaluator_id")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  status: callEvaluationStatusEnum("status").default("pending").notNull(),
  recordingUrl: text("recording_url"),
  scores: jsonb("scores").$type<{
    greeting: number;
    problemIdentification: number;
    solution: number;
    communication: number;
    closing: number;
    total: number;
  }>(),
  feedback: text("feedback"),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Types for the new tables
export type MockCallScenario = typeof mockCallScenarios.$inferSelect;
export type MockCallAttempt = typeof mockCallAttempts.$inferSelect;

// Insert schemas for validation
export const insertMockCallScenarioSchema = createInsertSchema(
  mockCallScenarios,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    difficulty: z.enum(["basic", "intermediate", "advanced"]),
    customerProfile: z.object({
      name: z.string(),
      background: z.string(),
      personality: z.string(),
      concerns: z.array(z.string()),
    }),
    expectedDialogue: z.object({
      greeting: z.string(),
      keyPoints: z.array(z.string()),
      resolutions: z.array(z.string()),
      closingStatements: z.array(z.string()),
    }),
    evaluationRubric: z.object({
      greetingScore: z.number().min(0).max(100),
      problemIdentificationScore: z.number().min(0).max(100),
      solutionScore: z.number().min(0).max(100),
      communicationScore: z.number().min(0).max(100),
      closingScore: z.number().min(0).max(100),
    }),
    processId: z.number().int().positive("Process is required"),
    organizationId: z.number().int().positive("Organization is required"),
    createdBy: z.number().int().positive("Creator is required"),
  });

export const insertMockCallAttemptSchema = createInsertSchema(mockCallAttempts)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    scenarioId: z.number().int().positive("Scenario is required"),
    userId: z.number().int().positive("User is required"),
    evaluatorId: z.number().int().positive("Evaluator is required"),
    organizationId: z.number().int().positive("Organization is required"),
    status: z.enum(["pending", "completed", "failed"]).default("pending"),
    recordingUrl: z.string().optional(),
    scores: z
      .object({
        greeting: z.number().min(0).max(100),
        problemIdentification: z.number().min(0).max(100),
        solution: z.number().min(0).max(100),
        communication: z.number().min(0).max(100),
        closing: z.number().min(0).max(100),
        total: z.number().min(0).max(100),
      })
      .optional(),
    feedback: z.string().optional(),
    startedAt: z.string().min(1, "Start time is required"),
    completedAt: z.string().optional(),
  });

export type InsertMockCallScenario = z.infer<
  typeof insertMockCallScenarioSchema
>;
export type InsertMockCallAttempt = z.infer<typeof insertMockCallAttemptSchema>;

// Add relations for the new tables
export const mockCallScenariosRelations = relations(
  mockCallScenarios,
  ({ one, many }) => ({
    process: one(organizationProcesses, {
      fields: [mockCallScenarios.processId],
      references: [organizationProcesses.id],
    }),
    organization: one(organizations, {
      fields: [mockCallScenarios.organizationId],
      references: [organizations.id],
    }),
    creator: one(users, {
      fields: [mockCallScenarios.createdBy],
      references: [users.id],
    }),
    attempts: many(mockCallAttempts),
  }),
);

export const mockCallAttemptsRelations = relations(
  mockCallAttempts,
  ({ one }) => ({
    scenario: one(mockCallScenarios, {
      fields: [mockCallAttempts.scenarioId],
      references: [mockCallScenarios.id],
    }),
    user: one(users, {
      fields: [mockCallAttempts.userId],
      references: [users.id],
    }),
    evaluator: one(users, {
      fields: [mockCallAttempts.evaluatorId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [mockCallAttempts.organizationId],
      references: [organizations.id],
    }),
  }),
);

// Evaluation related enums
export const evaluationRatingTypeEnum = pgEnum("evaluation_rating_type", [
  "yes_no_na",
  "numeric",
  "custom",
]);

export const evaluationStatusEnum = pgEnum("evaluation_status", [
  "draft",
  "active",
  "archived",
]);

// Evaluation Templates
export const evaluationTemplates = pgTable("evaluation_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  status: evaluationStatusEnum("status").default("draft").notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  feedbackThreshold: numeric("feedback_threshold", { precision: 5, scale: 2 }), // Threshold below which feedback is triggered
  batchId: integer("batch_id").references(() => organizationBatches.id), // New field to associate template with a batch
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Evaluation Pillars (Categories)
export const evaluationPillars = pgTable("evaluation_pillars", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .references(() => evaluationTemplates.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  weightage: integer("weightage").notNull(), // Percentage weightage of this pillar
  orderIndex: integer("order_index").notNull(), // For maintaining display order
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Evaluation Parameters
export const evaluationParameters = pgTable("evaluation_parameters", {
  id: serial("id").primaryKey(),
  pillarId: integer("pillar_id")
    .references(() => evaluationPillars.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  guidelines: text("guidelines"), // Detailed instructions for evaluation
  ratingType: text("rating_type").notNull(),
  weightage: integer("weightage").notNull(), // Percentage weightage within the pillar
  weightageEnabled: boolean("weightage_enabled").default(true).notNull(), // New field
  isFatal: boolean("is_fatal").default(false).notNull(), // Whether this parameter can cause automatic failure
  requiresComment: boolean("requires_comment").default(false).notNull(),
  noReasons: jsonb("no_reasons").$type<string[]>(),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sub-reasons for parameter ratings
export const evaluationSubReasons = pgTable("evaluation_sub_reasons", {
  id: serial("id").primaryKey(),
  parameterId: integer("parameter_id")
    .references(() => evaluationParameters.id)
    .notNull(),
  reason: text("reason").notNull(),
  appliesTo: text("applies_to").notNull(), // e.g., "no" for Yes/No/NA, or specific rating value
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Evaluation Results
export const evaluationResults = pgTable("evaluation_results", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .references(() => evaluationTemplates.id)
    .notNull(),
  batchId: integer("batch_id")
    .references(() => organizationBatches.id)
    .notNull(),
  traineeId: integer("trainee_id")
    .references(() => users.id)
    .notNull(),
  evaluatorId: integer("evaluator_id")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  totalScore: integer("total_score").notNull(),
  hasFatalError: boolean("has_fatal_error").default(false).notNull(),
  evaluatedAt: timestamp("evaluated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Parameter-level evaluation results
export const evaluationParameterResults = pgTable(
  "evaluation_parameter_results",
  {
    id: serial("id").primaryKey(),
    evaluationResultId: integer("evaluation_result_id")
      .references(() => evaluationResults.id)
      .notNull(),
    parameterId: integer("parameter_id")
      .references(() => evaluationParameters.id)
      .notNull(),
    rating: text("rating").notNull(), // The actual rating given (yes/no/na or numeric value)
    subReasonId: integer("sub_reason_id").references(
      () => evaluationSubReasons.id,
    ),
    comment: text("comment"),
    score: integer("score").notNull(), // Calculated score based on weightage
    isFatal: boolean("is_fatal").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);

// Add types
export type EvaluationTemplate = InferSelectModel<typeof evaluationTemplates>;
export type EvaluationPillar = InferSelectModel<typeof evaluationPillars>;
export type EvaluationParameter = InferSelectModel<typeof evaluationParameters>;
export type EvaluationSubReason = InferSelectModel<typeof evaluationSubReasons>;
export type EvaluationResult = InferSelectModel<typeof evaluationResults>;
export type EvaluationParameterResult = InferSelectModel<
  typeof evaluationParameterResults
>;

// Add insert schemas
export const insertEvaluationTemplateSchema = createInsertSchema(
  evaluationTemplates,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Template name is required"),
    processId: z.number().int().positive("Process is required"),
    organizationId: z.number().int().positive("Organization is required"),
    createdBy: z.number().int().positive("Creator is required"),
    batchId: z
      .number()
      .int()
      .positive("Batch is required")
      .optional()
      .nullable(),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    feedbackThreshold: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .transform((val) => (val === undefined ? null : Number(val.toFixed(2)))),
  });

export const insertEvaluationPillarSchema = createInsertSchema(
  evaluationPillars,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    templateId: z.number().int().positive("Template is required"),
    name: z.string().min(1, "Pillar name is required"),
    weightage: z.number().int().min(0).max(100),
    orderIndex: z.number().int().min(0),
  });

export const insertEvaluationParameterSchema = createInsertSchema(
  evaluationParameters,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    pillarId: z.number().int().positive("Pillar is required"),
    name: z.string().min(1, "Parameter name is required"),
    description: z.string().optional(),
    guidelines: z.string().optional(),
    ratingType: z.string().min(1, "Rating type is required"),
    weightage: z.number().min(0).max(100),
    weightageEnabled: z.boolean().default(true),
    isFatal: z.boolean().default(false),
    requiresComment: z.boolean().default(false),
    noReasons: z.array(z.string()).optional(),
    orderIndex: z.number().int().min(0),
  });

export const insertEvaluationSubReasonSchema = createInsertSchema(
  evaluationSubReasons,
)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    parameterId: z.number().int().positive("Parameter is required"),
    reason: z.string().min(1, "Reason is required"),
    appliesTo: z.string().min(1, "Applies to value is required"),
    orderIndex: z.number().int().min(0),
  });

export const insertEvaluationResultSchema = createInsertSchema(
  evaluationResults,
)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    templateId: z.number().int().positive("Template is required"),
    batchId: z.number().int().positive("Batch is required"),
    traineeId: z.number().int().positive("Trainee is required"),
    evaluatorId: z.number().int().positive("Evaluator is required"),
    organizationId: z.number().int().positive("Organization is required"),
    totalScore: z.number().int().min(0).max(100),
    hasFatalError: z.boolean().default(false),
    evaluatedAt: z.string().min(1, "Evaluation date is required"),
  });

export const insertEvaluationParameterResultSchema = createInsertSchema(
  evaluationParameterResults,
)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    evaluationResultId: z
      .number()
      .int()
      .positive("Evaluation result is required"),
    parameterId: z.number().int().positive("Parameter is required"),
    rating: z.string().min(1, "Rating is required"),
    subReasonId: z.number().int().positive("Sub-reason is required").optional(),
    comment: z.string().optional(),
    score: z.number().int().min(0).max(100),
    isFatal: z.boolean().default(false),
  });

// Add relations
export const evaluationTemplatesRelations = relations(
  evaluationTemplates,
  ({ one, many }) => ({
    process: one(organizationProcesses, {
      fields: [evaluationTemplates.processId],
      references: [organizationProcesses.id],
    }),
    organization: one(organizations, {
      fields: [evaluationTemplates.organizationId],
      references: [organizations.id],
    }),
    creator: one(users, {
      fields: [evaluationTemplates.createdBy],
      references: [users.id],
    }),
    batch: one(organizationBatches, {
      fields: [evaluationTemplates.batchId],
      references: [organizationBatches.id],
    }),
    pillars: many(evaluationPillars),
    results: many(evaluationResults),
  }),
);

export const evaluationPillarsRelations = relations(
  evaluationPillars,
  ({ one, many }) => ({
    template: one(evaluationTemplates, {
      fields: [evaluationPillars.templateId],
      references: [evaluationTemplates.id],
    }),
    parameters: many(evaluationParameters),
  }),
);

export const evaluationParametersRelations = relations(
  evaluationParameters,
  ({ one, many }) => ({
    pillar: one(evaluationPillars, {
      fields: [evaluationParameters.pillarId],
      references: [evaluationPillars.id],
    }),
    subReasons: many(evaluationSubReasons),
    results: many(evaluationParameterResults),
  }),
);

export const evaluationSubReasonsRelations = relations(
  evaluationSubReasons,
  ({ one }) => ({
    parameter: one(evaluationParameters, {
      fields: [evaluationSubReasons.parameterId],
      references: [evaluationParameters.id],
    }),
  }),
);

export const evaluationResultsRelations = relations(
  evaluationResults,
  ({ one, many }) => ({
    template: one(evaluationTemplates, {
      fields: [evaluationResults.templateId],
      references: [evaluationTemplates.id],
    }),
    batch: one(organizationBatches, {
      fields: [evaluationResults.batchId],
      references: [organizationBatches.id],
    }),
    trainee: one(users, {
      fields: [evaluationResults.traineeId],
      references: [users.id],
    }),
    evaluator: one(users, {
      fields: [evaluationResults.evaluatorId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [evaluationResults.organizationId],
      references: [organizations.id],
    }),
    parameterResults: many(evaluationParameterResults),
  }),
);

export const evaluationParameterResultsRelations = relations(
  evaluationParameterResults,
  ({ one }) => ({
    evaluationResult: one(evaluationResults, {
      fields: [evaluationParameterResults.evaluationResultId],
      references: [evaluationResults.id],
    }),
    parameter: one(evaluationParameters, {
      fields: [evaluationParameterResults.parameterId],
      references: [evaluationParameters.id],
    }),
    subReason: one(evaluationSubReasons, {
      fields: [evaluationParameterResults.subReasonId],
      references: [evaluationSubReasons.id],
    }),
  }),
);

// Export types for insertion
export type InsertEvaluationTemplate = z.infer<
  typeof insertEvaluationTemplateSchema
>;
export type InsertEvaluationPillar = z.infer<
  typeof insertEvaluationPillarSchema
>;
export type InsertEvaluationParameter = z.infer<
  typeof insertEvaluationParameterSchema
>;
export type InsertEvaluationSubReason = z.infer<
  typeof insertEvaluationSubReasonSchema
>;
export type InsertEvaluationResult = z.infer<
  typeof insertEvaluationResultSchema
>;
export type InsertEvaluationParameterResult = z.infer<
  typeof insertEvaluationParameterResultSchema
>;

// Evaluation type enum
export const evaluationTypeEnum = pgEnum("evaluation_type", [
  "audio",
  "standard",
  "certification", // Added certification type for dedicated certification evaluations
]);

// Evaluation-related tables
export const evaluations = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .references(() => evaluationTemplates.id)
    .notNull(),
  evaluationType: evaluationTypeEnum("evaluation_type")
    .default("standard")
    .notNull(),
  traineeId: integer("trainee_id").references(() => users.id),
  batchId: integer("batch_id").references(() => organizationBatches.id),
  evaluatorId: integer("evaluator_id")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  finalScore: numeric("final_score", { precision: 5, scale: 2 }).notNull(),
  status: text("status").notNull(),
  feedbackThreshold: numeric("feedback_threshold", { precision: 5, scale: 2 }), // Threshold below which feedback is triggered
  audioFileId: integer("audio_file_id").references(() => audioFiles.id), // Reference to audio file for audio evaluations
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evaluationScores = pgTable("evaluation_scores", {
  id: serial("id").primaryKey(),
  evaluationId: integer("evaluation_id")
    .references(() => evaluations.id)
    .notNull(),
  parameterId: integer("parameter_id")
    .references(() => evaluationParameters.id)
    .notNull(),
  score: text("score").notNull(),
  comment: text("comment"),
  noReason: text("no_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Dashboard configuration
export const dashboardConfigurations = pgTable("dashboard_configurations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  layout: jsonb("layout").$type<{
    sections: {
      id: string;
      title: string;
      widgets: {
        id: string;
        title: string;
        type: string;
        category: string;
        chartType?: "bar" | "pie" | "line";
        size?: string;
        gridSpan?: number;
        gridHeight?: number;
      }[];
    }[];
    activeSection?: string;
  } | null>(),
  userId: integer("user_id").references(() => users.id).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  widgets: jsonb("widgets").$type<{
    id: string;
    title: string;
    type: string;
    category: string;
    chartType?: "bar" | "pie" | "line";
    size?: string;
    gridSpan?: number;
    gridHeight?: number;
  }[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Types
export type Evaluation = InferSelectModel<typeof evaluations>;
export type EvaluationScore = InferSelectModel<typeof evaluationScores>;
export type DashboardConfiguration = InferSelectModel<typeof dashboardConfigurations>;

// Dashboard Configuration relations
export const dashboardConfigurationsRelations = relations(dashboardConfigurations, ({ one }) => ({
  user: one(users, {
    fields: [dashboardConfigurations.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [dashboardConfigurations.organizationId],
    references: [organizations.id],
  }),
}));

// Create insert schema for dashboard configurations
export const insertDashboardConfigurationSchema = createInsertSchema(dashboardConfigurations)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Dashboard name is required"),
    description: z.string().nullable().optional(),
    layout: z.object({
      sections: z.array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          widgets: z.array(
            z.object({
              id: z.string().min(1),
              title: z.string().min(1),
              type: z.string().min(1),
              category: z.string().min(1),
              chartType: z.enum(["bar", "pie", "line"]).optional(),
              size: z.string().optional(),
              gridSpan: z.number().optional(),
              gridHeight: z.number().optional(),
            })
          )
        })
      ),
      activeSection: z.string().optional()
    }).nullable().optional(),
    userId: z.number().int().positive("User ID is required"),
    organizationId: z.number().int().positive("Organization ID is required"),
    isDefault: z.boolean().default(false),
    widgets: z.array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        type: z.string().min(1),
        category: z.string().min(1),
        chartType: z.enum(["bar", "pie", "line"]).optional(),
        size: z.string().optional(),
        gridSpan: z.number().optional(),
        gridHeight: z.number().optional(),
      })
    ).min(0, "Widgets array is required"),
  });

export type InsertDashboardConfiguration = z.infer<typeof insertDashboardConfigurationSchema>;

// Insert schemas
export const insertEvaluationSchema = createInsertSchema(evaluations)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    templateId: z.number().int().positive("Template ID is required"),
    evaluationType: z.enum(["audio", "standard", "certification"]).default("standard"),
    traineeId: z.number().int().positive("Trainee ID is required").optional(),
    batchId: z.number().int().positive("Batch ID is required").optional(),
    evaluatorId: z.number().int().positive("Evaluator ID is required"),
    organizationId: z.number().int().positive("Organization ID is required"),
    finalScore: z
      .number()
      .min(0)
      .max(100)
      .transform((score) => Number(score.toFixed(2))),
    status: z.string().min(1, "Status is required"),
    feedbackThreshold: z
      .number()
      .min(0)
      .max(100)
      .transform((score) => Number(score.toFixed(2)))
      .optional(),
    audioFileId: z
      .number()
      .int()
      .positive("Audio File ID is required")
      .optional(),
  });

export const insertEvaluationScoreSchema = createInsertSchema(evaluationScores)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    evaluationId: z.number().int().positive("Evaluation ID is required"),
    parameterId: z.number().int().positive("Parameter ID is required"),
    score: z.string().min(1, "Score is required"),
    comment: z.string().optional(),
    noReason: z.string().optional(),
  });

export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type InsertEvaluationScore = z.infer<typeof insertEvaluationScoreSchema>;

// Relations
// Evaluation feedback table to track feedback on evaluations
export const evaluationFeedback = pgTable("evaluation_feedback", {
  id: serial("id").primaryKey(),
  evaluationId: integer("evaluation_id")
    .references(() => evaluations.id)
    .notNull(),
  agentId: integer("agent_id")
    .references(() => users.id)
    .notNull(),
  reportingHeadId: integer("reporting_head_id")
    .references(() => users.id)
    .notNull(),
  status: evaluationFeedbackStatusEnum("status").default("pending").notNull(),
  agentResponse: text("agent_response"),
  reportingHeadResponse: text("reporting_head_response"),
  agentResponseDate: timestamp("agent_response_date"),
  reportingHeadResponseDate: timestamp("reporting_head_response_date"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type EvaluationFeedback = InferSelectModel<typeof evaluationFeedback>;

export const insertEvaluationFeedbackSchema = createInsertSchema(
  evaluationFeedback,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    evaluationId: z.number().int().positive("Evaluation ID is required"),
    agentId: z.number().int().positive("Agent ID is required"),
    reportingHeadId: z.number().int().positive("Reporting Head ID is required"),
    status: z.enum(["pending", "accepted", "rejected"]).default("pending"),
    agentResponse: z.string().optional(),
    reportingHeadResponse: z.string().optional(),
    agentResponseDate: z.date().optional(),
    reportingHeadResponseDate: z.date().optional(),
    rejectionReason: z.string().optional(),
  });

export type InsertEvaluationFeedback = z.infer<
  typeof insertEvaluationFeedbackSchema
>;

export const evaluationFeedbackRelations = relations(
  evaluationFeedback,
  ({ one }) => ({
    evaluation: one(evaluations, {
      fields: [evaluationFeedback.evaluationId],
      references: [evaluations.id],
    }),
    agent: one(users, {
      fields: [evaluationFeedback.agentId],
      references: [users.id],
    }),
    reportingHead: one(users, {
      fields: [evaluationFeedback.reportingHeadId],
      references: [users.id],
    }),
  }),
);

export const evaluationsRelations = relations(evaluations, ({ one, many }) => ({
  template: one(evaluationTemplates, {
    fields: [evaluations.templateId],
    references: [evaluationTemplates.id],
  }),
  trainee: one(users, {
    fields: [evaluations.traineeId],
    references: [users.id],
  }),
  batch: one(organizationBatches, {
    fields: [evaluations.batchId],
    references: [organizationBatches.id],
  }),
  evaluator: one(users, {
    fields: [evaluations.evaluatorId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [evaluations.organizationId],
    references: [organizations.id],
  }),
  audioFiles: many(audioFiles),
  audioFileAllocations: many(audioFileAllocations),
  feedback: many(evaluationFeedback),
}));

export const evaluationScoresRelations = relations(
  evaluationScores,
  ({ one }) => ({
    evaluation: one(evaluations, {
      fields: [evaluationScores.evaluationId],
      references: [evaluations.id],
    }),
    parameter: one(evaluationParameters, {
      fields: [evaluationScores.parameterId],
      references: [evaluationParameters.id],
    }),
  }),
);
