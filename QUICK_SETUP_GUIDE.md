# Quick Database Setup Guide

## How to Create the Same Database Schema in Your New Application

You have **3 methods** to replicate the database schema. Choose the one that works best for your situation:

## Method 1: Automated Setup (Recommended)

### Step 1: Copy Required Files
Copy these files to your new application:
- `shared/schema.ts` - Complete database schema
- `drizzle.config.ts` - Drizzle configuration
- `setup-database.js` - Automated setup script

### Step 2: Set Environment Variable
```bash
export DATABASE_URL="postgresql://username:password@host:port/database"
```

### Step 3: Run Setup Script
```bash
node setup-database.js
```

This script will:
- Check prerequisites
- Install dependencies
- Test database connection
- Push schema to database
- Verify schema creation
- Create initial organization and admin user

## Method 2: Simple Drizzle Push

### Step 1: Copy Files
Copy `shared/schema.ts` and `drizzle.config.ts` to your new application

### Step 2: Install Dependencies
```bash
npm install drizzle-orm @neondatabase/serverless drizzle-kit
```

### Step 3: Push Schema
```bash
npx drizzle-kit push
```

This will automatically create all tables, enums, and relationships.

## Method 3: Manual SQL (For Advanced Users)

If you prefer manual control, use the complete SQL schema provided in `DATABASE_SCHEMA_SETUP.md`.

## What Gets Created

Your database will have these main components:

### 🏢 Organization Management
- Organizations, locations, processes
- Line of business definitions
- Holiday calendars and settings

### 👥 User Management
- User accounts with roles (admin, trainer, trainee, etc.)
- Role-based permissions
- User-batch enrollments

### 🎓 Training Management
- Training batches with lifecycle tracking
- Batch templates for reuse
- Phase-based training progression

### 🎵 Audio File System
- Audio file metadata and storage
- File allocation to quality analysts
- Azure Blob Storage integration

### 📝 Quiz System
- Question banks with multiple types
- Quiz templates and instances
- Attempt tracking and scoring

### 📊 Evaluation System
- Evaluation templates and parameters
- Scoring frameworks
- Feedback management

### 🖥️ Dashboard System
- Customizable user dashboards
- Widget configurations
- User preferences

## Verification

After setup, verify your schema:

```bash
# View your database
npx drizzle-kit studio

# Check table count (should be 25+ tables)
psql $DATABASE_URL -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

## Next Steps

1. **Start your application**: `npm run dev`
2. **Create initial data**: Organizations, users, locations
3. **Configure Azure Storage**: For audio file management
4. **Set up permissions**: Role-based access control
5. **Test functionality**: Login, create batches, upload files

## Environment Variables You'll Need

```bash
# Database
DATABASE_URL="postgresql://..."

# Azure Storage (for audio files)
AZURE_STORAGE_ACCOUNT_NAME="your_storage_account"
AZURE_STORAGE_ACCOUNT_KEY="your_storage_key"

# Session Management
SESSION_SECRET="your_session_secret"

# Email (optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your_email@gmail.com"
SMTP_PASSWORD="your_app_password"
```

## Common Issues & Solutions

### "Cannot connect to database"
- Check your DATABASE_URL format
- Ensure database server is running
- Verify network connectivity

### "Permission denied"
- Ensure database user has CREATE permissions
- Check if user can create tables and enums

### "Table already exists"
- Drop existing tables if starting fresh
- Use `npx drizzle-kit push --force` to overwrite

### "Missing dependencies"
- Run: `npm install drizzle-orm @neondatabase/serverless drizzle-kit`

## Support

- **Detailed documentation**: See `DATABASE_SCHEMA_SETUP.md`
- **Schema reference**: Check `shared/schema.ts`
- **Database studio**: Use `npx drizzle-kit studio` to explore

The schema supports a full-featured training management system with user management, batch tracking, audio processing, quiz systems, and evaluation frameworks. It's designed to be scalable and maintainable.