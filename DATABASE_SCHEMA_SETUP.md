# Database Schema Setup Guide

This guide will help you replicate the same database schema in other instances of this Training Management System application.

## Overview

The application uses PostgreSQL with Drizzle ORM for database management. The schema is defined in TypeScript and includes comprehensive user management, training batches, audio file processing, quiz systems, and evaluation frameworks.

## Prerequisites

1. **PostgreSQL Database**: You need a PostgreSQL database instance (we recommend Neon for serverless PostgreSQL)
2. **Database URL**: Get your database connection string
3. **Node.js Environment**: The application uses Node.js with TypeScript

## Method 1: Using Drizzle Schema Push (Recommended)

### Step 1: Environment Setup

1. Copy the `shared/schema.ts` file to your new application instance
2. Copy the `drizzle.config.ts` file
3. Set up your DATABASE_URL environment variable:
   ```bash
   DATABASE_URL="postgresql://username:password@host:port/database"
   ```

### Step 2: Install Dependencies

Ensure you have the required dependencies:
```bash
npm install drizzle-orm @neondatabase/serverless drizzle-kit
```

### Step 3: Push Schema to Database

Use Drizzle's schema push feature to create all tables:
```bash
npm run db:push
```

This command will:
- Read the schema from `shared/schema.ts`
- Compare it with your database
- Create all necessary tables, indexes, and constraints
- Handle PostgreSQL enums automatically

### Step 4: Verify Schema

After pushing, verify the schema was created correctly:
```bash
npm run db:studio
```

## Method 2: Manual SQL Migration (Advanced)

If you prefer to create the schema manually, here's the complete SQL structure:

### Core Enums

```sql
-- User and permission enums
CREATE TYPE role AS ENUM ('owner', 'admin', 'manager', 'team_lead', 'quality_analyst', 'trainer', 'advisor', 'trainee');
CREATE TYPE user_category_type AS ENUM ('active', 'trainee');
CREATE TYPE permission AS ENUM ('manage_billing', 'manage_subscription', 'manage_organization_settings', 'manage_users', 'view_users', 'edit_users', 'delete_users', 'upload_users', 'add_users', 'manage_organization', 'view_organization', 'edit_organization', 'manage_locations', 'manage_processes', 'manage_holidaylist', 'manage_lineofbusiness', 'view_performance', 'manage_performance', 'export_reports', 'manage_batches', 'manage_batch_users_add', 'manage_batch_users_remove', 'view_trainee_management', 'manage_trainee_management', 'manage_quiz', 'take_quiz', 'view_quiz', 'view_take_quiz', 'manage_evaluation_form', 'edit_evaluation_form', 'delete_evaluation_form', 'create_evaluation_form', 'view_evaluation_form', 'manage_conduct_form', 'manage_evaluation_feedback', 'manage_allocation', 'view_allocation', 'manage_feedback', 'view_feedback');

-- Batch and training enums
CREATE TYPE batch_category AS ENUM ('new_training', 'upskill');
CREATE TYPE batch_status AS ENUM ('planned', 'induction', 'training', 'certification', 'ojt', 'ojt_certification', 'completed');
CREATE TYPE user_batch_status AS ENUM ('active', 'completed', 'dropped', 'on_hold');
CREATE TYPE trainee_phase_status AS ENUM ('planned', 'induction', 'training', 'certification', 'ojt', 'ojt_certification', 'completed', 'refresher', 'refer_to_hr', 'left_job');

-- Audio and evaluation enums
CREATE TYPE audio_file_status AS ENUM ('pending', 'allocated', 'evaluated', 'archived');
CREATE TYPE audio_language AS ENUM ('english', 'spanish', 'french', 'german', 'portuguese', 'hindi', 'mandarin', 'japanese', 'korean', 'arabic', 'russian', 'tamil', 'bengali', 'telugu', 'other');
CREATE TYPE evaluation_feedback_status AS ENUM ('pending', 'accepted', 'rejected');

-- Quiz enums
CREATE TYPE question_type AS ENUM ('multiple_choice', 'true_false', 'short_answer');
CREATE TYPE quiz_status AS ENUM ('active', 'completed', 'expired');
CREATE TYPE quiz_type AS ENUM ('internal', 'final');

-- Other enums
CREATE TYPE process_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE feature_type AS ENUM ('LMS', 'QMS', 'BOTH');
```

### Core Tables

```sql
-- Organizations table
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  employee_id TEXT NOT NULL UNIQUE,
  role role NOT NULL,
  category user_category_type NOT NULL DEFAULT 'trainee',
  location_id INTEGER REFERENCES organization_locations(id),
  email TEXT NOT NULL UNIQUE,
  education TEXT,
  date_of_joining DATE,
  phone_number TEXT,
  date_of_birth DATE,
  last_working_day DATE,
  organization_id INTEGER REFERENCES organizations(id),
  manager_id INTEGER REFERENCES users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  certified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  reset_password_token TEXT,
  reset_password_expires TIMESTAMP
);

-- Continue with other tables...
```

## Method 3: Using Existing Migration Files

If you have access to existing migration files, you can run them:

```bash
# Example migration runner
node run-migration.js
```

## Database Tables Overview

The schema includes the following main table groups:

### 1. Organization & User Management
- `organizations` - Company/organization data
- `users` - User accounts and profiles
- `role_permissions` - Role-based access control
- `organization_locations` - Physical locations
- `organization_processes` - Business processes
- `organization_line_of_businesses` - Line of business definitions

### 2. Training Management
- `organization_batches` - Training batch management
- `batch_templates` - Reusable batch templates
- `user_batch_processes` - User-batch enrollment tracking
- `organization_holidays` - Holiday calendar
- `organization_settings` - Organization-wide settings

### 3. Audio File Management
- `audio_files` - Audio file metadata and storage
- `audio_file_allocations` - Audio file assignments
- `audio_file_batch_allocations` - Batch-level audio allocations

### 4. Quiz System
- `questions` - Quiz questions bank
- `quiz_templates` - Quiz templates
- `quizzes` - Quiz instances
- `quiz_attempts` - Quiz attempt tracking
- `quiz_responses` - Individual question responses
- `quiz_assignments` - Quiz assignments to users

### 5. Evaluation System
- `evaluation_templates` - Evaluation form templates
- `evaluation_pillars` - Evaluation categories
- `evaluation_parameters` - Evaluation criteria
- `evaluation_sub_reasons` - Detailed evaluation reasons
- `evaluations` - Evaluation instances
- `evaluation_scores` - Evaluation scoring
- `evaluation_feedback` - Feedback management

### 6. Dashboard & UI
- `user_dashboards` - User dashboard preferences
- `dashboard_widgets` - Dashboard widget configurations
- `dashboard_configurations` - Dashboard layouts

## Post-Setup Steps

### 1. Create Initial Data

After setting up the schema, you may need to create initial data:

```sql
-- Create initial organization
INSERT INTO organizations (name) VALUES ('Your Organization Name');

-- Create initial admin user
INSERT INTO users (username, password, full_name, employee_id, role, email, organization_id) 
VALUES ('admin', 'hashed_password', 'Admin User', 'EMP001', 'admin', 'admin@example.com', 1);
```

### 2. Set Up Role Permissions

```sql
-- Create role permissions for admin
INSERT INTO role_permissions (role, permissions, organization_id) 
VALUES ('admin', '["manage_users", "manage_organization", "manage_batches"]', 1);
```

### 3. Configure Organization Settings

```sql
-- Set up organization settings
INSERT INTO organization_settings (organization_id, feature_type, weekly_off_days, user_limit) 
VALUES (1, 'BOTH', '["Saturday", "Sunday"]', 400);
```

## Environment Variables

Make sure to set these environment variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# Azure Storage (for audio files)
AZURE_STORAGE_ACCOUNT_NAME="your_storage_account"
AZURE_STORAGE_ACCOUNT_KEY="your_storage_key"

# Session Management
SESSION_SECRET="your_session_secret"
```

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure your database user has CREATE and ALTER permissions
2. **Enum Conflicts**: If enums already exist, you may need to drop them first
3. **Foreign Key Constraints**: Make sure to create tables in the correct order
4. **Connection Issues**: Verify your DATABASE_URL is correct

### Verification Commands

```bash
# Check if all tables were created
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

# Check if all enums were created
SELECT typname FROM pg_type WHERE typtype = 'e';

# Verify foreign key constraints
SELECT conname, conrelid::regclass, confrelid::regclass 
FROM pg_constraint WHERE contype = 'f';
```

## Best Practices

1. **Always backup** your database before making schema changes
2. **Test the schema** in a development environment first
3. **Use transactions** when running multiple migration commands
4. **Monitor performance** after schema creation
5. **Document any customizations** you make to the schema

## Support

If you encounter issues:
1. Check the application logs for detailed error messages
2. Verify your database permissions
3. Ensure all dependencies are installed
4. Check the `shared/schema.ts` file for the latest schema definitions

This schema supports a comprehensive training management system with user management, batch tracking, audio file processing, quiz systems, and evaluation frameworks. The schema is designed to be scalable and maintainable with proper relationships and constraints.