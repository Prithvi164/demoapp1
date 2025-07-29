// Test script to directly hit the API endpoints for Azure container management
// Use built-in fetch API

const BASE_URL = 'http://localhost:5002/api';

// Step 1: Check if server is running by hitting health endpoint
async function checkServerHealth() {
  try {
    console.log('Checking if server is running...');
    const response = await fetch(`${BASE_URL}/health`);
    
    if (response.ok) {
      console.log('✅ Server is running and healthy');
      return true;
    } else {
      console.log('❌ Server is running but health check failed');
      console.log(`Status: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Server is not running or not accessible:', error.message);
    return false;
  }
}

// Step 2: List current containers
async function listContainers() {
  try {
    console.log('\nListing current containers...');
    const response = await fetch(`${BASE_URL}/azure-containers`);
    
    if (!response.ok) {
      console.log(`❌ Failed to list containers. Status: ${response.status}`);
      return [];
    }
    
    const containers = await response.json();
    console.log(`✅ Found ${containers.length} containers`);
    
    if (containers.length > 0) {
      console.log('Containers:');
      containers.forEach((container, index) => {
        console.log(`  ${index + 1}. ${container.name} (${container.properties?.publicAccess ? 'Public' : 'Private'})`);
      });
    }
    
    return containers;
  } catch (error) {
    console.error('Error listing containers:', error.message);
    return [];
  }
}

// Step 3: Create a new container
async function createContainer(containerName, isPublic = false) {
  try {
    console.log(`\nCreating container "${containerName}" (${isPublic ? 'Public' : 'Private'})...`);
    
    // Create the request data
    const data = { containerName, isPublic };
    
    // Call the API directly
    const response = await fetch(`${BASE_URL}/azure-containers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    // Try to parse the response as JSON
    let responseData;
    try {
      responseData = await response.json();
    } catch (err) {
      responseData = { error: 'Failed to parse response' };
    }
    
    console.log(`API Response status: ${response.status}`);
    console.log('API Response data:', responseData);
    
    if (response.ok) {
      console.log('✅ Container created successfully via API');
    } else {
      console.log('❌ Failed to create container via API');
    }
    
    return { success: response.ok, data: responseData };
  } catch (error) {
    console.error('Error creating container:', error.message);
    return { success: false, error: error.message };
  }
}

// Main test function
async function runTest() {
  console.log('=== Azure Container Management API Test ===');
  
  // Check if server is running
  const isServerRunning = await checkServerHealth();
  if (!isServerRunning) {
    console.error('❌ Server is not running. Cannot proceed with tests.');
    return { success: false, error: 'Server not running' };
  }
  
  // List existing containers
  const existingContainers = await listContainers();
  
  // Generate a unique container name
  const timestamp = Date.now();
  const containerName = `test-api-${timestamp}`;
  
  // Create a new container
  const createResult = await createContainer(containerName);
  
  // If creation was successful, verify by listing containers again
  if (createResult.success) {
    console.log('\nVerifying container creation...');
    const updatedContainers = await listContainers();
    
    const containerExists = updatedContainers.some(container => container.name === containerName);
    if (containerExists) {
      console.log(`✅ Verified container "${containerName}" was created successfully`);
    } else {
      console.log(`❌ Container "${containerName}" was not found in the updated list`);
      createResult.verified = false;
    }
  }
  
  return createResult;
}

// Run the test
runTest()
  .then(result => {
    console.log('\n=== Test Summary ===');
    console.log(`Success: ${result.success ? 'Yes' : 'No'}`);
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    if (result.data && result.data.message) {
      console.log(`Message: ${result.data.message}`);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n=== Unhandled Error ===');
    console.error(error);
    process.exit(1);
  });