#!/usr/bin/env node

import { initAzureStorageService } from './server/services/azureStorageService.ts';

async function debugAzureContainers() {
  console.log('🔍 Debugging Azure Storage Containers and Audio Files\n');
  
  try {
    // Initialize Azure Storage Service
    const azureStorage = initAzureStorageService();
    
    if (!azureStorage) {
      console.error('❌ Azure Storage Service initialization failed');
      return;
    }
    
    console.log('✅ Azure Storage Service initialized successfully');
    
    // List all containers
    console.log('\n📋 Listing all containers:');
    const containers = await azureStorage.listContainers();
    
    if (containers.length === 0) {
      console.log('   No containers found in storage account');
    } else {
      containers.forEach((container, index) => {
        console.log(`   ${index + 1}. ${container}`);
      });
    }
    
    // Check all containers for files
    console.log('\n🎵 Looking for audio files in all containers:');
    
    for (const container of containers) {
      console.log(`   📁 Container: ${container}`);
      
      try {
        // List files in this container
        const containerClient = azureStorage.getContainerClient(container);
        const blobs = containerClient.listBlobsFlat();
        
        let fileCount = 0;
        for await (const blob of blobs) {
          const sizeKB = Math.round(blob.properties.contentLength / 1024);
          console.log(`      🎧 ${blob.name} (${sizeKB} KB)`);
          fileCount++;
        }
        
        if (fileCount === 0) {
          console.log('      (empty container)');
        }
      } catch (error) {
        console.log(`      ❌ Error listing files: ${error.message}`);
      }
    }
    
    // Check if specific file exists
    const testFilename = 'agent-261-1702639821-7026-HSIL_Inbound-2023_12_15_17_00_21-918317567741.wav';
    const testUsername = 'adoe2';
    const testContainer = `${testUsername}-audiofile`;
    
    console.log(`\n🔍 Checking for specific file: ${testFilename}`);
    console.log(`   In container: ${testContainer}`);
    
    try {
      const exists = await azureStorage.blobExists(testContainer, testFilename);
      console.log(`   File exists: ${exists ? '✅ YES' : '❌ NO'}`);
      
      if (!exists) {
        console.log('\n💡 Possible solutions:');
        console.log('   1. Upload the audio file to Azure Blob Storage');
        console.log('   2. Update the database with the correct filename');
        console.log('   3. Check if the file is in a different container');
      }
    } catch (error) {
      console.log(`   ❌ Error checking file: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Debug script failed:', error);
  }
}

// Run the debug function
debugAzureContainers()
  .then(() => {
    console.log('\n🏁 Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });