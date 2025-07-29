// Test script to directly test user limit update API

// Using native fetch (available in Node.js)
async function testUserLimitUpdate() {
  try {
    console.log('Testing user limit update API...');
    
    // Make the request to update user limit
    const response = await fetch('http://localhost:5002/api/organizations/1/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'userLimit', // Server expects camelCase "userLimit", not lowercase
        value: 400
      })
    });
    
    // Log response status
    console.log('Response status:', response.status);
    
    // Parse and log response body
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    console.log('Test complete.');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testUserLimitUpdate();