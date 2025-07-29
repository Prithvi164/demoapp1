import { updateBatchStatuses } from '../services/batch-status-service';

// Run the batch status update immediately
const runBatchStatusUpdate = async () => {
  console.log('Running batch status update test');
  
  try {
    await updateBatchStatuses();
    console.log('Batch status update completed successfully');
  } catch (error) {
    console.error('Error during batch status update:', error);
  }
};

// Execute the function
runBatchStatusUpdate().then(() => {
  console.log('Test finished');
  process.exit(0);
}).catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});