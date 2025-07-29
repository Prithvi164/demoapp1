import { sql } from 'drizzle-orm';
import { pgEnum, pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { db } from './server/db';
import { evaluations, users } from './shared/schema';

// Main function to run all updates
async function updateSchema() {
  console.log('Starting schema update...');
  
  try {
    // First, create the evaluation_feedback_status enum if it doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evaluation_feedback_status') THEN
          CREATE TYPE evaluation_feedback_status AS ENUM ('pending', 'accepted', 'rejected');
        END IF;
      END
      $$;
    `);
    console.log('Created evaluation_feedback_status enum if needed');
    
    // Create the evaluation_feedback table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS evaluation_feedback (
        id SERIAL PRIMARY KEY,
        evaluation_id INTEGER NOT NULL REFERENCES evaluations(id),
        agent_id INTEGER NOT NULL REFERENCES users(id),
        reporting_head_id INTEGER NOT NULL REFERENCES users(id),
        status evaluation_feedback_status NOT NULL DEFAULT 'pending',
        agent_response TEXT,
        reporting_head_response TEXT,
        agent_response_date TIMESTAMP,
        reporting_head_response_date TIMESTAMP,
        rejection_reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Created evaluation_feedback table if needed');

    // Add feedback_threshold column to evaluation_templates table if it doesn't exist
    await db.execute(sql`
      ALTER TABLE evaluation_templates
      ADD COLUMN IF NOT EXISTS feedback_threshold INTEGER;
    `);
    console.log('Added feedback_threshold to evaluation_templates table if needed');

    console.log('Schema update completed successfully');
  } catch (error) {
    console.error('Error updating schema:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the update
updateSchema();