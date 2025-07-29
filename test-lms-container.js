// Test container creation functionality similar to LMS app implementation
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';

async function testContainerCreation() {
  console.log('=== LMS Container Creation Test ===');
  
  // Get Azure Storage credentials from environment variables and trim whitespace
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();
  
  // Generate unique container name for testing
  const containerName = `lms-test-container-${Date.now()}`;
  
  console.log(`Azure Storage Account: ${accountName}`);
  console.log(`Container Name: ${containerName}`);
  console.log(`Is Public: false (private access)`);
  
  try {
    // Create service client with the same method as in the app
    console.log('\nCreating Azure Storage service client...');
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
    
    // Get the container client for our test container
    console.log('Getting container client...');
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Check if container exists
    console.log(`Checking if container "${containerName}" already exists...`);
    const exists = await containerClient.exists();
    
    if (exists) {
      console.log(`Container "${containerName}" already exists!`);
      return { success: true, containerName, existed: true };
    }
    
    // Create the container with no public access (same as app's default)
    console.log(`Creating container "${containerName}"...`);
    // Using undefined as access parameter (default = private)
    const createContainerResponse = await containerClient.create();
    
    console.log(`\n✅ Container created successfully!`);
    console.log(`- Request ID: ${createContainerResponse.requestId}`);
    console.log(`- Container URL: ${containerClient.url}`);
    
    // List all containers to verify creation
    console.log('\nListing all containers to verify:');
    let i = 1;
    for await (const container of blobServiceClient.listContainers()) {
      console.log(`  ${i++}. ${container.name}`);
    }
    
    return { success: true, containerName };
  } catch (error) {
    console.error('\n❌ Error creating container:', error.message);
    
    // Detailed error logging
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.details) {
      console.error('Error details:', error.details);
    }
    
    return { success: false, error: error.message };
  }
}

// Run the test
testContainerCreation()
  .then(result => {
    console.log('\n=== Test Result ===');
    console.log(`Success: ${result.success ? 'Yes ✅' : 'No ❌'}`);
    console.log(`Container: ${result.containerName}`);
    
    if (result.existed) {
      console.log('Note: Container already existed');
    }
    if (!result.success && result.error) {
      console.log(`Error: ${result.error}`);
    }
    
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n=== Unhandled Error ===', error);
    process.exit(1);
  });