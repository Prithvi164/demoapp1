// Minimal standalone script to test Azure container creation
// This script doesn't rely on the server - it directly uses the Azure SDK

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';

// Get Azure Storage credentials from environment variables and trim any whitespace
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();

// Generate a unique container name with timestamp
const containerName = `test-minimal-${Date.now()}`;

async function createContainerDirect() {
  console.log('=== Direct Azure Container Creation Test ===');
  console.log(`Azure Storage Account: ${accountName}`);
  console.log(`Container Name: ${containerName}`);
  
  try {
    console.log('\nInitializing BlobServiceClient...');
    
    // Create a shared key credential - ensure we trim any whitespace from credentials
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    
    // Create the BlobServiceClient with a cleanly formed URL
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
    
    // Get container client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Check if container already exists
    console.log(`Checking if container "${containerName}" already exists...`);
    const exists = await containerClient.exists();
    
    if (exists) {
      console.log(`Container "${containerName}" already exists!`);
      return { success: true, containerName, existed: true };
    }
    
    // Create the container
    console.log(`Creating container "${containerName}" via Azure SDK...`);
    const createContainerResponse = await containerClient.create();
    
    console.log(`\n✅ Container created successfully!`);
    console.log(`- Request ID: ${createContainerResponse.requestId}`);
    console.log(`- Container URL: ${containerClient.url}`);
    
    // List containers to verify
    console.log('\nListing all containers to verify:');
    let i = 1;
    for await (const container of blobServiceClient.listContainers()) {
      console.log(`  ${i++}. ${container.name}`);
    }
    
    return { success: true, containerName };
  } catch (error) {
    console.error('\n❌ Error creating container:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.details) {
      console.error('Error details:', error.details);
    }
    
    return { success: false, error: error.message, errorCode: error.code };
  }
}

// Run the test
createContainerDirect()
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