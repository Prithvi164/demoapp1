import pg from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeTraineeStatus() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable not found');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Starting trainee status initialization...');
    
    // Get all user_batch_processes with null trainee_status
    const { rows: userBatchProcesses } = await pool.query(`
      SELECT ubp.id, ubp.batch_id, ob.status as batch_status
      FROM user_batch_processes ubp
      JOIN organization_batches ob ON ubp.batch_id = ob.id
      WHERE ubp.trainee_status IS NULL AND ubp.status = 'active'
    `);
    
    console.log(`Found ${userBatchProcesses.length} trainees with null status`);
    
    let updatedCount = 0;
    
    // Update each user_batch_process to match its batch status
    for (const ubp of userBatchProcesses) {
      await pool.query(`
        UPDATE user_batch_processes
        SET trainee_status = $1, is_manual_status = false
        WHERE id = $2
      `, [ubp.batch_status, ubp.id]);
      updatedCount++;
      
      if (updatedCount % 50 === 0) {
        console.log(`Updated ${updatedCount} of ${userBatchProcesses.length} trainees...`);
      }
    }
    
    console.log(`Initialization complete! Updated ${updatedCount} trainee statuses.`);
    
    // Verify the update
    const { rows: verificationResult } = await pool.query(`
      SELECT 
        count(*) as total_trainees,
        count(trainee_status) as trainees_with_status
      FROM user_batch_processes
      WHERE status = 'active'
    `);
    
    console.log('Verification results:');
    console.log(`- Total active trainees: ${verificationResult[0].total_trainees}`);
    console.log(`- Trainees with status: ${verificationResult[0].trainees_with_status}`);
    
  } catch (error) {
    console.error('Initialization failed with error:', error);
  } finally {
    await pool.end();
  }
}

initializeTraineeStatus();