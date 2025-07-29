// Use the child_process module to run curl commands
import { exec } from 'child_process';

// Helper function to run shell commands with promises
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.warn(`Command stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

// Helper function to make curl requests
async function curlRequest(url, method = 'GET', data = null) {
  try {
    let command = `curl -s -X ${method} ${url}`;
    
    // Add headers and data for POST requests
    if (method === 'POST' && data) {
      command += ` -H "Content-Type: application/json" -d '${JSON.stringify(data)}'`;
    }
    
    console.log(`Executing: ${command}`);
    const result = await runCommand(command);
    
    try {
      // Try to parse as JSON
      return JSON.parse(result);
    } catch (e) {
      // Return as plain text if not JSON
      return result;
    }
  } catch (error) {
    console.error(`Curl request failed: ${error.message}`);
    return { error: error.message };
  }
}

// Test functions
async function testHealth() {
  console.log('\n=== Testing Health Endpoint ===');
  const result = await curlRequest('http://localhost:5002/api/health');
  console.log('Response:', result);
  return result;
}

async function listContainers() {
  console.log('\n=== Listing Containers ===');
  const result = await curlRequest('http://localhost:5002/api/azure-containers');
  console.log(`Found ${Array.isArray(result) ? result.length : 0} containers`);
  
  if (Array.isArray(result) && result.length > 0) {
    console.log('Container names:');
    result.forEach((container, i) => {
      console.log(`  ${i+1}. ${container.name}`);
    });
  }
  
  return result;
}

async function createContainer() {
  console.log('\n=== Creating Container ===');
  const containerName = `test-curl-${Date.now()}`;
  console.log(`Container name: ${containerName}`);
  
  const data = {
    containerName,
    isPublic: false
  };
  
  const result = await curlRequest('http://localhost:5002/api/azure-containers', 'POST', data);
  console.log('Response:', result);
  
  if (result.success) {
    console.log(`✅ Container "${containerName}" created successfully`);
  } else {
    console.log(`❌ Failed to create container "${containerName}"`);
  }
  
  return { result, containerName };
}

// Main test function
async function runTests() {
  try {
    console.log('=== Starting API Tests with curl ===');
    
    // Test 1: Check server health
    const healthResult = await testHealth();
    if (!healthResult || healthResult.error) {
      console.error('❌ Health check failed. Server may not be running.');
      return false;
    }
    
    // Test 2: List containers
    const containers = await listContainers();
    if (!Array.isArray(containers)) {
      console.error('❌ Failed to list containers. API endpoint may not be working correctly.');
    }
    
    // Test 3: Create a container
    const createResult = await createContainer();
    
    // If container was created, verify it exists in the updated list
    if (createResult.result.success) {
      console.log('\n=== Verifying Container Creation ===');
      const updatedContainers = await listContainers();
      
      if (Array.isArray(updatedContainers)) {
        const containerExists = updatedContainers.some(c => c.name === createResult.containerName);
        if (containerExists) {
          console.log(`✅ Container "${createResult.containerName}" verified in the container list`);
          return true;
        } else {
          console.log(`❌ Container "${createResult.containerName}" not found in the container list despite successful creation response`);
        }
      }
    }
    
    return createResult.result.success === true;
  } catch (error) {
    console.error('Test failed with error:', error.message);
    return false;
  }
}

// Run the tests
runTests()
  .then(success => {
    console.log('\n=== Test Summary ===');
    console.log(`Overall Success: ${success ? 'Yes ✅' : 'No ❌'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n=== Unhandled Error ===');
    console.error(error);
    process.exit(1);
  });