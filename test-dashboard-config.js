// Test script for dashboard configurations API

const axios = require('axios');

// Replace with your actual login credentials
const loginData = {
  username: 'admin',
  password: 'admin'
};

// The base URL for the API
const baseURL = 'http://localhost:5001';

// Dashboard configuration data
const dashboardConfig = {
  name: "My Test Dashboard",
  description: "A test dashboard configuration",
  layout: {
    sections: [
      {
        id: "section1",
        title: "Attendance",
        widgets: [
          {
            id: "widget1",
            type: "attendanceOverview",
            title: "Attendance Overview",
            span: 6,
            height: 250
          },
          {
            id: "widget2",
            type: "attendanceTrends",
            title: "Attendance Trends",
            span: 6,
            height: 250
          }
        ]
      },
      {
        id: "section2",
        title: "Performance",
        widgets: [
          {
            id: "widget3",
            type: "performanceDistribution",
            title: "Performance Distribution",
            span: 6,
            height: 250
          },
          {
            id: "widget4",
            type: "phaseCompletion",
            title: "Phase Completion",
            span: 6,
            height: 250
          }
        ]
      }
    ],
    activeSection: "section1"
  },
  isDefault: true
};

// Helper function for authenticated requests
async function authenticatedRequest(method, url, data = null) {
  try {
    // Login first to get cookies
    const loginResponse = await axios.post(`${baseURL}/api/login`, loginData, {
      withCredentials: true
    });
    
    console.log('Login successful:', loginResponse.data);
    
    // Make the authenticated request
    const config = {
      method,
      url: `${baseURL}${url}`,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Test creating a new dashboard configuration
async function testCreateDashboardConfig() {
  try {
    const result = await authenticatedRequest('post', '/api/dashboard-configurations', dashboardConfig);
    console.log('Created dashboard configuration:', result);
    return result;
  } catch (error) {
    console.error('Failed to create dashboard configuration');
  }
}

// Test getting all dashboard configurations
async function testGetAllDashboardConfigs() {
  try {
    const result = await authenticatedRequest('get', '/api/dashboard-configurations');
    console.log('All dashboard configurations:', result);
    return result;
  } catch (error) {
    console.error('Failed to get dashboard configurations');
  }
}

// Test getting default dashboard configuration
async function testGetDefaultDashboardConfig() {
  try {
    const result = await authenticatedRequest('get', '/api/dashboard-configurations/default');
    console.log('Default dashboard configuration:', result);
    return result;
  } catch (error) {
    console.error('Failed to get default dashboard configuration');
  }
}

// Test getting a specific dashboard configuration
async function testGetDashboardConfig(id) {
  try {
    const result = await authenticatedRequest('get', `/api/dashboard-configurations/${id}`);
    console.log('Dashboard configuration:', result);
    return result;
  } catch (error) {
    console.error(`Failed to get dashboard configuration with id ${id}`);
  }
}

// Test updating a dashboard configuration
async function testUpdateDashboardConfig(id, updates) {
  try {
    const result = await authenticatedRequest('put', `/api/dashboard-configurations/${id}`, updates);
    console.log('Updated dashboard configuration:', result);
    return result;
  } catch (error) {
    console.error(`Failed to update dashboard configuration with id ${id}`);
  }
}

// Test deleting a dashboard configuration
async function testDeleteDashboardConfig(id) {
  try {
    await authenticatedRequest('delete', `/api/dashboard-configurations/${id}`);
    console.log(`Deleted dashboard configuration with id ${id}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete dashboard configuration with id ${id}`);
  }
}

// Run a test workflow
async function runTests() {
  try {
    // Create a new dashboard configuration
    const newConfig = await testCreateDashboardConfig();
    if (!newConfig) return;
    
    // Get all dashboard configurations
    await testGetAllDashboardConfigs();
    
    // Get the default dashboard configuration
    await testGetDefaultDashboardConfig();
    
    // Get the specific dashboard configuration
    await testGetDashboardConfig(newConfig.id);
    
    // Update the dashboard configuration
    const updates = {
      name: "Updated Dashboard",
      description: "This dashboard has been updated"
    };
    await testUpdateDashboardConfig(newConfig.id, updates);
    
    // Delete the dashboard configuration
    await testDeleteDashboardConfig(newConfig.id);
    
    // Verify it's deleted by getting all configurations again
    await testGetAllDashboardConfigs();
    
  } catch (error) {
    console.error('Test workflow failed:', error);
  }
}

// Uncomment to run the tests
// runTests();