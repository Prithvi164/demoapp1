#!/usr/bin/env node

/**
 * Database Schema Setup Script
 * This script helps you replicate the database schema in a new instance
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

function logStep(step, message) {
  console.log(`\n🔄 Step ${step}: ${message}`);
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message) {
  console.log(`❌ ${message}`);
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

async function checkPrerequisites() {
  logStep(1, 'Checking prerequisites...');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    logError('DATABASE_URL environment variable is not set');
    console.log('Please set your DATABASE_URL environment variable:');
    console.log('export DATABASE_URL="postgresql://username:password@host:port/database"');
    process.exit(1);
  }
  
  logSuccess('DATABASE_URL is set');
  
  // Check if schema file exists
  if (!existsSync('shared/schema.ts')) {
    logError('Schema file not found at shared/schema.ts');
    console.log('Please make sure you have copied the schema file to your project');
    process.exit(1);
  }
  
  logSuccess('Schema file found');
  
  // Check if drizzle config exists
  if (!existsSync('drizzle.config.ts')) {
    logError('Drizzle config file not found at drizzle.config.ts');
    console.log('Please make sure you have copied the drizzle.config.ts file to your project');
    process.exit(1);
  }
  
  logSuccess('Drizzle config file found');
}

async function installDependencies() {
  logStep(2, 'Installing required dependencies...');
  
  try {
    execSync('npm list drizzle-orm @neondatabase/serverless drizzle-kit', { stdio: 'ignore' });
    logSuccess('All dependencies are already installed');
  } catch (error) {
    logInfo('Installing missing dependencies...');
    try {
      execSync('npm install drizzle-orm @neondatabase/serverless drizzle-kit', { stdio: 'inherit' });
      logSuccess('Dependencies installed successfully');
    } catch (installError) {
      logError('Failed to install dependencies');
      console.log('Please run: npm install drizzle-orm @neondatabase/serverless drizzle-kit');
      process.exit(1);
    }
  }
}

async function testDatabaseConnection() {
  logStep(3, 'Testing database connection...');
  
  try {
    const testScript = `
      import { Pool } from '@neondatabase/serverless';
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const client = await pool.connect();
      console.log('Database connection successful');
      client.release();
      await pool.end();
    `;
    
    execSync(`node -e "${testScript}"`, { stdio: 'inherit' });
    logSuccess('Database connection test passed');
  } catch (error) {
    logError('Database connection test failed');
    console.log('Please verify your DATABASE_URL is correct and the database is accessible');
    process.exit(1);
  }
}

async function pushSchema() {
  logStep(4, 'Pushing schema to database...');
  
  const answer = await askQuestion('Do you want to push the schema to the database? This will create all tables. (y/n): ');
  
  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    logInfo('Schema push cancelled by user');
    return;
  }
  
  try {
    // First, generate the schema
    logInfo('Generating schema...');
    execSync('npx drizzle-kit generate', { stdio: 'inherit' });
    
    // Then push to database
    logInfo('Pushing schema to database...');
    execSync('npx drizzle-kit push', { stdio: 'inherit' });
    
    logSuccess('Schema pushed successfully');
  } catch (error) {
    logError('Schema push failed');
    console.log('You can try running the commands manually:');
    console.log('1. npx drizzle-kit generate');
    console.log('2. npx drizzle-kit push');
    process.exit(1);
  }
}

async function verifySchema() {
  logStep(5, 'Verifying schema...');
  
  try {
    const verifyScript = `
      import { Pool } from '@neondatabase/serverless';
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      // Check if main tables exist
      const tables = [
        'organizations', 'users', 'organization_batches', 'audio_files', 
        'quiz_templates', 'evaluation_templates', 'questions'
      ];
      
      for (const table of tables) {
        const result = await pool.query(
          'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)',
          [table]
        );
        
        if (result.rows[0].exists) {
          console.log('✅ Table ' + table + ' exists');
        } else {
          console.log('❌ Table ' + table + ' missing');
        }
      }
      
      await pool.end();
    `;
    
    execSync(`node -e "${verifyScript}"`, { stdio: 'inherit' });
    logSuccess('Schema verification completed');
  } catch (error) {
    logError('Schema verification failed');
    console.log('Manual verification: Check your database for the required tables');
  }
}

async function createInitialData() {
  logStep(6, 'Creating initial data...');
  
  const answer = await askQuestion('Do you want to create initial organization and admin user? (y/n): ');
  
  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    logInfo('Initial data creation skipped');
    return;
  }
  
  const orgName = await askQuestion('Enter organization name: ');
  const adminUsername = await askQuestion('Enter admin username: ');
  const adminEmail = await askQuestion('Enter admin email: ');
  const adminPassword = await askQuestion('Enter admin password: ');
  
  try {
    const initScript = `
      import { Pool } from '@neondatabase/serverless';
      import bcrypt from 'bcryptjs';
      
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      // Create organization
      const orgResult = await pool.query(
        'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
        ['${orgName}']
      );
      
      const orgId = orgResult.rows[0].id;
      console.log('Organization created with ID:', orgId);
      
      // Hash password
      const hashedPassword = await bcrypt.hash('${adminPassword}', 10);
      
      // Create admin user
      const userResult = await pool.query(
        'INSERT INTO users (username, password, full_name, employee_id, role, email, organization_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['${adminUsername}', hashedPassword, 'Admin User', 'ADMIN001', 'admin', '${adminEmail}', orgId]
      );
      
      console.log('Admin user created with ID:', userResult.rows[0].id);
      
      // Create organization settings
      await pool.query(
        'INSERT INTO organization_settings (organization_id, feature_type, weekly_off_days, user_limit) VALUES ($1, $2, $3, $4)',
        [orgId, 'BOTH', ['Saturday', 'Sunday'], 400]
      );
      
      console.log('Organization settings created');
      
      await pool.end();
    `;
    
    execSync(`node -e "${initScript}"`, { stdio: 'inherit' });
    logSuccess('Initial data created successfully');
  } catch (error) {
    logError('Initial data creation failed');
    console.log('You can create initial data manually later');
  }
}

async function showNextSteps() {
  console.log('\n🎉 Database setup completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Start your application: npm run dev');
  console.log('2. Open Drizzle Studio to view your database: npx drizzle-kit studio');
  console.log('3. Check the DATABASE_SCHEMA_SETUP.md file for detailed documentation');
  console.log('4. Configure your Azure Storage settings for audio file management');
  console.log('5. Set up your session secret and other environment variables');
  
  console.log('\nUseful commands:');
  console.log('- View database: npx drizzle-kit studio');
  console.log('- Push schema changes: npx drizzle-kit push');
  console.log('- Generate migrations: npx drizzle-kit generate');
  
  console.log('\nFor support, refer to the DATABASE_SCHEMA_SETUP.md file');
}

async function main() {
  console.log('🚀 Training Management System - Database Setup');
  console.log('This script will help you set up the database schema in your new instance\n');
  
  try {
    await checkPrerequisites();
    await installDependencies();
    await testDatabaseConnection();
    await pushSchema();
    await verifySchema();
    await createInitialData();
    await showNextSteps();
  } catch (error) {
    logError('Setup failed: ' + error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the setup
main().catch(console.error);