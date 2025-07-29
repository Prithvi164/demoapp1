// Use ES modules syntax
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { env } from 'process';

// Get Azure Storage credentials from environment variables and trim any whitespace
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();

console.log('Testing Azure Storage connection with:');
console.log(`Account Name: ${accountName}`);
console.log(`Account Key: ${accountKey ? accountKey.substring(0, 5) + '...' : 'null'}`);

// Create a shared key credential
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

// Create the BlobServiceClient
const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);

async function main() {
  try {
    console.log('Listing existing containers...');
    let i = 1;
    let containers = [];
    
    for await (const container of blobServiceClient.listContainers()) {
      console.log(`Container ${i++}: ${container.name}`);
      containers.push(container.name);
    }
    
    // Create a new test container
    const containerName = `test-container-${Date.now()}`;
    console.log(`\nCreating new container: ${containerName}`);
    
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const createContainerResponse = await containerClient.create();
    
    console.log(`Container created successfully. RequestId: ${createContainerResponse.requestId}`);
    console.log(`Container URL: ${containerClient.url}`);
    
    // List containers again to verify
    console.log('\nListing containers after creation:');
    i = 1;
    for await (const container of blobServiceClient.listContainers()) {
      console.log(`Container ${i++}: ${container.name}`);
    }
    
    return { success: true, containerName };
  } catch (error) {
    console.error('Error in Azure test script:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.details) {
      console.error('Error details:', error.details);
    }
    return { success: false, error: error.message };
  }
}

main()
  .then((result) => {
    console.log('\nTest result:', result);
  })
  .catch((error) => {
    console.error('Unhandled error in main:', error);
  });