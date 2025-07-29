// Test script to validate Azure SAS URL generation (ES Module version)
// Run this with: node test-azure-sas.mjs

import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol } from '@azure/storage-blob';

async function testSasGeneration() {
  console.log('Testing Azure SAS URL generation...');
  
  // Get credentials from environment (make sure these are set in Replit secrets)
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  
  if (!accountName || !accountKey) {
    console.error('Azure credentials not found in environment variables');
    console.log('AZURE_STORAGE_ACCOUNT_NAME:', accountName ? 'SET' : 'NOT SET');
    console.log('AZURE_STORAGE_ACCOUNT_KEY:', accountKey ? 'SET' : 'NOT SET');
    return;
  }
  
  console.log('Account Name:', accountName);
  console.log('Account Key Length:', accountKey.length);
  
  try {
    // Create credential
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    console.log('✓ Credential created successfully');
    
    // Create blob service client
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
    console.log('✓ Blob service client created');
    
    // Test container and blob from the actual logs
    const containerName = 'test20072025';
    const blobName = 'agent-261-1702639821-7026-HSIL_Inbound-2023_12_15_17_00_21-918317567741.wav';
    
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    
    console.log('Blob URL:', blobClient.url);
    
    // Generate SAS parameters - exact same as server
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - 5);
    startTime.setMilliseconds(0);
    
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 240);
    expiryTime.setMilliseconds(0);
    
    const sasOptions = {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: expiryTime,
      protocol: SASProtocol.Https,
      startsOn: startTime,
      contentDisposition: "inline",
      contentType: "audio/wav",
      cacheControl: "no-cache"
    };
    
    console.log('SAS Options:', sasOptions);
    
    // Generate SAS token
    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
    console.log('✓ SAS token generated');
    console.log('SAS token length:', sasToken.length);
    console.log('SAS token contains sig:', sasToken.includes('sig='));
    
    // Create full URL
    const sasUrl = `${blobClient.url}?${sasToken}`;
    console.log('✓ Full SAS URL created');
    console.log('Full URL (first 120 chars):', sasUrl.substring(0, 120) + '...');
    
    // Test the URL with a HEAD request
    console.log('Testing URL accessibility...');
    const response = await fetch(sasUrl, { method: 'HEAD' });
    console.log('Response status:', response.status);
    console.log('Response status text:', response.statusText);
    
    if (response.ok) {
      console.log('✓ SAS URL is working correctly!');
      console.log('Content-Type:', response.headers.get('content-type'));
      console.log('Content-Length:', response.headers.get('content-length'));
      console.log('Accept-Ranges:', response.headers.get('accept-ranges'));
    } else {
      console.error('✗ SAS URL failed:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('Error during SAS generation test:', error);
  }
}

testSasGeneration();