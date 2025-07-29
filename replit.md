# Training Management System

## Overview

This is a comprehensive training management system built with React, Node.js, and PostgreSQL. The application provides a full-featured platform for managing training batches, users, evaluations, and audio file processing with Azure Blob Storage integration.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Components**: Radix UI primitives with Tailwind CSS
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy and session management
- **File Processing**: Azure Blob Storage for audio files
- **Task Scheduling**: Cron jobs for batch status management

### Database Design
- **ORM**: Drizzle with TypeScript schema definitions
- **Connection**: Neon serverless PostgreSQL
- **Migrations**: Drizzle Kit for schema migrations
- **Session Storage**: PostgreSQL-backed session store

## Key Components

### User Management
- Multi-role system (owner, admin, manager, trainer, trainee, etc.)
- Permission-based access control
- Bulk user import via Excel templates
- User dashboard customization

### Training Batch Management
- Batch lifecycle management (planned → induction → training → certification → OJT)
- Automated status transitions with cron jobs
- Trainee enrollment and tracking
- Batch history and audit trails

### Audio File Processing
- Azure Blob Storage integration for audio file management
- Metadata extraction and processing
- Audio file allocation to users and batches
- Excel-based metadata import system

### Evaluation System
- Flexible evaluation templates
- Audio file-based evaluations
- Feedback management system
- Performance tracking and reporting

### Quiz System
- Quiz creation and management
- Timed quiz sessions
- Result tracking and analytics
- Integration with training phases

## Data Flow

1. **Authentication Flow**: Users authenticate via username/password, sessions managed server-side
2. **File Upload Flow**: Audio files uploaded to Azure → metadata processed → allocated to users/batches
3. **Batch Management Flow**: Batches created → users enrolled → automated phase transitions → completion tracking
4. **Evaluation Flow**: Audio files allocated → evaluations conducted → feedback collected → reports generated

## External Dependencies

### Azure Services
- **Azure Blob Storage**: Primary storage for audio files
- **Storage Account**: Configured with shared key authentication
- **Container Management**: Automated container creation and management

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL hosting
- **Connection Pooling**: Built-in connection management

### Email Services
- **Nodemailer**: Email delivery for password resets and notifications
- **Ethereal Email**: Development email testing

### Development Tools
- **Replit**: Primary development environment
- **TypeScript**: Type safety across frontend/backend
- **ESLint/Prettier**: Code quality and formatting

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20
- **Hot Reload**: Vite dev server with HMR
- **Database**: Neon PostgreSQL development instance
- **File Storage**: Azure Blob Storage development container

### Production Deployment
- **Target**: Google Cloud Run (configured in .replit)
- **Build Process**: Vite build + esbuild for server bundling
- **Environment Variables**: Managed through Replit secrets
- **Database**: Neon PostgreSQL production instance
- **CDN**: Direct Azure Blob Storage access

### Configuration Management
- **Development**: Local .env files and Replit secrets
- **Production**: Environment-specific configuration
- **Database Migrations**: Automated via Drizzle Kit
- **Asset Optimization**: Vite build optimizations

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Recent Changes:
- July 26, 2025. MAJOR SUCCESS: Implemented fully functional Azure-based audio streaming with multi-container search capability
- July 26, 2025. Audio streaming now works seamlessly - files automatically discovered in correct containers (test20072025, user-specific, etc.)
- July 26, 2025. Added robust Azure Storage Service with intelligent container detection and secure direct streaming
- July 26, 2025. Fixed "element has no supported sources" error through proper Azure blob streaming implementation
- July 26, 2025. Enhanced audio evaluation system with immediate playback capability for quality analysts
- July 26, 2025. Fixed excessive SAS URL refresh requests - added debouncing and extended cache times to prevent continuous backend calls
- July 26, 2025. Enhanced audio debug panel with proper rate limiting and manual refresh controls
- July 26, 2025. Improved query caching for audio SAS URLs (15min stale time, 30min cache time, disabled auto-refresh)
- July 26, 2025. Added comprehensive audio debugging tools with debug button (? icon) in development mode
- July 26, 2025. Enhanced error messages with specific guidance to check console and refresh page for new tokens
- July 26, 2025. Created debug-audio-test.js script for manual audio URL testing in browser console
- July 26, 2025. Added detailed console logging for audio element states, network conditions, and SAS URL validation
- July 26, 2025. Fixed hardcoded organization ID bug in Azure storage browser (was using org 39 instead of dynamic user org)
- July 26, 2025. Enhanced audio evaluation with comprehensive format support documentation and error handling
- July 26, 2025. Added AudioFormatInfo component showing supported formats (WAV, MP3, MP4, AAC, WebM, OGG)
- July 26, 2025. Improved audio playback error messages with specific solutions for SAS token expiration and format issues
- July 26, 2025. Created audio-format-support.md documentation with troubleshooting guide
- July 26, 2025. Added dual filter system to certification results: status (all/passed/failed) + evaluation type (all/standard/audio/certification)
- July 26, 2025. Enhanced certification results UI with side-by-side filter dropdowns and evaluation type display
- July 26, 2025. Updated backend API to support type filter parameter alongside existing status filter
- July 26, 2025. Implemented dynamic certification evaluation detection with multiple criteria
- July 26, 2025. Fixed quiz template creation - questions column changed to integer[] array type
- July 26, 2025. Fixed quiz submission - answers column now allows NULL values in quiz_attempts table
- July 25, 2025. Successfully migrated from Replit Agent to standard Replit environment
- July 25, 2025. Database schema pushed with 38 tables created
- July 25, 2025. Server configuration updated to run on port 5000
- July 25, 2025. PostgreSQL database and session store properly initialized
- June 26, 2025. Initial setup