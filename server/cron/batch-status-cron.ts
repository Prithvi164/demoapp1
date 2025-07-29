import { CronJob } from 'cron';
import { updateBatchStatuses, resetEmptyBatches } from '../services/batch-status-service';

// Run the job every minute for testing purposes
const batchStatusJob = new CronJob(
  '* * * * *',  // Runs every minute
  async () => {
    console.log('Running batch status update cron job');
    
    // First, reset any batches that incorrectly have no enrolled users
    await resetEmptyBatches();
    
    // Then, handle regular batch phase transitions for valid batches
    await updateBatchStatuses();
  },
  null, // onComplete
  false, // start
  'UTC'  // timezone
);

export const startBatchStatusCron = () => {
  console.log('Starting batch status cron job');
  batchStatusJob.start();
};
