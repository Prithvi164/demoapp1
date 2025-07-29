// Test script that uses the app's Azure storage service directly
import { initAzureStorageService } from './server/services/azureStorageService.ts';

async function testAppService() {
  try {
    console.log('=== Testing App Azure Storage Service ===');
    
    // Initialize the service using the same method as the app
    console.log('Initializing Azure Storage Service...');
    const azureService = initAzureStorageService();
    console.log('Azure Storage Service initialized.');
    
    if (!azureService) {
      console.error('❌ Failed to initialize Azure Storage Service');
      return { success: false, error: 'Service initialization failed' };
    }
    
    // Generate unique container name
    const containerName = `test-app-service-${Date.now()}`;
    console.log(`Container name: ${containerName}`);
    
    // Create container
    console.log('Creating container...');
    const containerClient = await azureService.createContainer(containerName, false);
    console.log('Container creation successful');
    
    // Verify by listing containers
    console.log('\nListing all containers:');
    const containers = azureService.blobServiceClient.listContainers();
    const containerList = [];
    
    for await (const container of containers) {
      containerList.push(container.name);
      console.log(`- ${container.name}`);
    }
    
    // Check if our new container is in the list
    const containerExists = containerList.includes(containerName);
    console.log(`\nContainer "${containerName}" exists in list: ${containerExists ? 'Yes ✅' : 'No ❌'}`);
    
    return { success: true, containerName, verified: containerExists };
  } catch (error) {
    console.error('❌ Error testing app service:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
testAppService()
  .then(result => {
    console.log('\n=== Test Result ===');
    console.log(`Success: ${result.success ? 'Yes ✅' : 'No ❌'}`);
    if (result.containerName) {
      console.log(`Container: ${result.containerName}`);
    }
    if (result.verified) {
      console.log('Container verified in list: Yes ✅');
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