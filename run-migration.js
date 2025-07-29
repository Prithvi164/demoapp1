import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable not found');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Read the SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'add_trainee_status.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration completed successfully!');

    // Verify that the columns were added
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_batch_processes' 
      AND column_name IN ('trainee_status', 'is_manual_status')
    `);
    
    console.log(`Verification: Found ${result.rows.length} of 2 expected columns`);
    result.rows.forEach(row => {
      console.log(`- Column '${row.column_name}' exists`);
    });

  } catch (error) {
    console.error('Migration failed with error:', error);
  } finally {
    await pool.end();
  }
}

runMigration();