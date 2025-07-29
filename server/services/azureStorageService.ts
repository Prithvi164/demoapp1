import { BlobServiceClient, StorageSharedKeyCredential, ContainerClient, BlobItem, BlobSASPermissions, generateBlobSASQueryParameters, SASProtocol } from '@azure/storage-blob';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import * as mm from 'music-metadata';

// Define the shape of metadata for audio files
export interface AudioFileMetadata {
  filename: string;      // Name of the file in Azure
  originalFilename?: string; // Original name if different
  language: string;      // Language of the audio
  version: string;       // Version of the recording
  call_date: string;     // Date of the call (YYYY-MM-DD)
  callMetrics: {
    // Standard fields
    callDate: string;    // Call date in readable format (YYYY-MM-DD)
    callId: string;      // Unique call identifier
    callType: string;    // Type of call (e.g., inbound, outbound)
    agentId?: string;    // Agent identifier
    customerSatisfaction?: number; // Customer satisfaction score
    handleTime?: number; // Handle time in seconds
    
    // Required fields from the metadata requirements
    auditRole: string;   // Auto-filled based on logged-in auditor (Quality Analyst)
    OLMSID: string;      // Unique ID for the agent/system
    Name: string;        // Name of the agent being evaluated
    PBXID: string;       // Unique telephony ID
    partnerName: string; // Partner/Client the call belongs to (CloudPoint Technologies)
    customerMobile: string; // For call tracking (Customer Mobile #)
    callDuration: string; // Duration of the call in seconds
    subType: string;     // Further classification (Customer Service, Technical Support, etc.)
    subSubType: string;  // Further granularity (Billing Inquiry, Hardware Issue, etc.)
    VOC: string;         // Captures Voice of Customer (Positive, Negative, Neutral)
    languageOfCall: string; // Language spoken during call (matching standard language codes)
    userRole: string;    // Based on logged-in user's profile (Agent, Senior Agent)
    advisorCategory: string; // E.g., Challenger, Performer
    businessSegment: string; // E.g., Care, Tech Support, Sales
    LOB: string;         // Line of Business (e.g., Prepaid, Postpaid, Enterprise)
    formName: string;    // Select form for evaluation (Evaluation Form 1)
    
    [key: string]: any;  // For additional metrics
  };
  duration?: number;     // Will be populated from audio analysis
  fileSize?: number;     // Will be populated from blob properties
}

export class AzureStorageService {
  public blobServiceClient: BlobServiceClient;
  public accountName: string; // Changed from private to public for debugging
  private accountKey: string;
  
  /**
   * Delete multiple blobs from a container
   * @param containerName Name of the container
   * @param blobNames Array of blob names to delete
   * @returns Object with success count and failed blobs
   */
  async deleteBlobs(containerName: string, blobNames: string[]): Promise<{ 
    successCount: number; 
    failedBlobs: { name: string; error: string }[] 
  }> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const results = {
        successCount: 0,
        failedBlobs: [] as { name: string; error: string }[]
      };
      
      console.log(`Attempting to delete ${blobNames.length} blobs from container ${containerName}`);
      
      // Delete blobs in parallel for efficiency
      const deletePromises = blobNames.map(async (blobName) => {
        try {
          const blobClient = containerClient.getBlobClient(blobName);
          await blobClient.delete();
          console.log(`Successfully deleted blob: ${blobName}`);
          results.successCount++;
          return { success: true, name: blobName };
        } catch (error) {
          console.error(`Failed to delete blob ${blobName}:`, error);
          results.failedBlobs.push({ 
            name: blobName, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          return { success: false, name: blobName, error };
        }
      });
      
      await Promise.all(deletePromises);
      return results;
    } catch (error) {
      console.error('Error in bulk delete operation:', error);
      throw new Error(`Failed to delete blobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  constructor(
    accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME,
    accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY
  ) {
    // Ensure we trim any whitespace from credentials to prevent URL formation issues
    this.accountName = (accountName || '').trim();
    this.accountKey = (accountKey || '').trim();

    // Check if credentials are available
    if (!this.accountName || !this.accountKey) {
      console.error('Azure Storage credentials not provided. Service will not function properly.');
      // Initialize with placeholder to prevent errors, but functionality will be limited
      this.blobServiceClient = BlobServiceClient.fromConnectionString('DefaultEndpointsProtocol=https;AccountName=placeholder;AccountKey=placeholder;EndpointSuffix=core.windows.net');
      return;
    }

    // Create a SharedKeyCredential object
    const sharedKeyCredential = new StorageSharedKeyCredential(
      this.accountName,
      this.accountKey
    );

    // Create the BlobServiceClient using the credential
    this.blobServiceClient = new BlobServiceClient(
      `https://${this.accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
  }

  /**
   * Get a container client for the specified container
   */
  getContainerClient(containerName: string): ContainerClient {
    return this.blobServiceClient.getContainerClient(containerName);
  }

  /**
   * List all blobs in a container
   */
  async listBlobs(containerName: string, folderPath: string = ''): Promise<BlobItem[]> {
    console.log(`Azure Service: Listing blobs in container "${containerName}" with folderPath "${folderPath}"`);
    
    try {
      const containerClient = this.getContainerClient(containerName);
      
      // Check if the container exists
      const containerExists = await containerClient.exists();
      if (!containerExists) {
        console.log(`Container "${containerName}" does not exist`);
        return [];
      }
      
      const blobs: BlobItem[] = [];

      // Create an async iterator with the prefix (folder path)
      const options = folderPath ? { prefix: folderPath } : undefined;
      console.log(`Iterating through blobs in container "${containerName}" with options:`, options);
      const asyncIterator = containerClient.listBlobsFlat(options);
      let blobItem = await asyncIterator.next();

      // Iterate through all blobs
      while (!blobItem.done) {
        blobs.push(blobItem.value);
        blobItem = await asyncIterator.next();
      }

      console.log(`Found ${blobs.length} blobs in container "${containerName}" with folder path "${folderPath}"`);
      return blobs;
    } catch (error) {
      console.error(`Error listing blobs in container "${containerName}":`, error);
      throw error;
    }
  }
  
  /**
   * List folders/virtual directories in a container
   * Azure Blob Storage doesn't have a formal folder structure, but we can emulate it using prefixes
   */
  async listFolders(containerName: string): Promise<string[]> {
    console.log(`Azure Service: Listing folders in container "${containerName}"`);
    
    try {
      const containerClient = this.getContainerClient(containerName);
      
      // Check if the container exists
      const containerExists = await containerClient.exists();
      if (!containerExists) {
        console.log(`Container "${containerName}" does not exist`);
        return [];
      }
      
      // Folders in Azure Blob are simulated by using delimiters
      const blobs: BlobItem[] = [];
      const asyncIterator = containerClient.listBlobsFlat();
      let blobItem = await asyncIterator.next();
      
      while (!blobItem.done) {
        blobs.push(blobItem.value);
        blobItem = await asyncIterator.next();
      }
      
      // Extract folder names from blob paths (everything before the first slash)
      const folders = new Set<string>();
      
      blobs.forEach(blob => {
        const name = blob.name;
        const slashIndex = name.indexOf('/');
        
        if (slashIndex > 0) {
          // This is a blob in a virtual folder
          const folderName = name.substring(0, slashIndex);
          folders.add(folderName);
        }
      });
      
      // Convert Set to array and sort
      const folderList = Array.from(folders).sort((a, b) => {
        // Try to sort by date if folder names are dates
        const dateA = new Date(a);
        const dateB = new Date(b);
        
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          // Both are valid dates, sort most recent first
          return dateB.getTime() - dateA.getTime();
        }
        
        // Fall back to alphabetical sort if not dates
        return a.localeCompare(b);
      });
      
      console.log(`Found ${folderList.length} folders in container "${containerName}"`);
      return folderList;
    } catch (error) {
      console.error(`Error listing folders in container "${containerName}":`, error);
      throw error;
    }
  }

  /**
   * Generate a SAS URL for a blob to allow direct access
   * SAS = Shared Access Signature
   */
  async generateBlobSasUrl(
    containerName: string,
    blobName: string,
    expiryMinutes: number = 240, // Default to 4 hours for better user experience
    contentType?: string // Optional content type parameter
  ): Promise<string> {
    try {
      console.log(`Generating SAS URL for container: ${containerName}, blob: ${blobName}, expiry: ${expiryMinutes} minutes, contentType: ${contentType || 'not specified'}`);
      
      // Verify all inputs are valid
      if (!containerName || !blobName) {
        console.error('Invalid container or blob name:', { containerName, blobName });
        throw new Error('Container name and blob name are required');
      }
      
      const containerClient = this.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobName);
      
      console.log(`Blob URL before SAS token: ${blobClient.url}`);

      if (!this.accountName || !this.accountKey) {
        console.error('Azure Storage credentials not provided. Cannot generate SAS URL.');
        throw new Error('Azure Storage credentials not properly configured');
      }

      // Calculate expiry date with a more robust approach
      // Start time is slightly in the past to account for clock skew
      const startTime = new Date();
      startTime.setMinutes(startTime.getMinutes() - 5); // 5 minutes in the past
      
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + expiryMinutes);
      
      // Round to seconds and ensure ISO strings are correctly formatted
      startTime.setMilliseconds(0);
      expiryTime.setMilliseconds(0);
      
      console.log(`SAS token start: ${startTime.toISOString()}, will expire at: ${expiryTime.toISOString()}`);

      // Determine appropriate content type based on file extension if not provided
      let detectedContentType = contentType || "audio/mpeg"; // Default to audio/mpeg
      
      if (!contentType) {
        const fileExtension = blobName.split('.').pop()?.toLowerCase();
        if (fileExtension) {
          // Use a more comprehensive mapping of file extensions to content types
          const contentTypeMap: Record<string, string> = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'm4a': 'audio/mp4',
            'aac': 'audio/aac',
            'flac': 'audio/flac',
            'webm': 'audio/webm',
            'mp4': 'audio/mp4', // Some audio files might use mp4 extension
            '3gp': 'audio/3gpp', // Mobile audio format
            'amr': 'audio/amr',  // Adaptive Multi-Rate audio codec
            'wma': 'audio/x-ms-wma' // Windows Media Audio
          };
          
          if (contentTypeMap[fileExtension]) {
            detectedContentType = contentTypeMap[fileExtension];
          }
        }
      }
      
      console.log(`Using content type: ${detectedContentType} for blob: ${blobName}`);

      // Create a fresh credential for each SAS generation to avoid any staleness
      // Ensure credentials are properly trimmed and validated
      const cleanAccountName = this.accountName.trim();
      const cleanAccountKey = this.accountKey.trim();
      
      if (!cleanAccountName || !cleanAccountKey) {
        console.error('Azure credentials are empty after cleaning:', { 
          accountNameLength: cleanAccountName.length, 
          accountKeyLength: cleanAccountKey.length 
        });
        throw new Error('Invalid Azure Storage credentials');
      }
      
      console.log(`Using Azure account: ${cleanAccountName} for SAS generation`);
      
      const sharedKeyCredential = new StorageSharedKeyCredential(
        cleanAccountName,
        cleanAccountKey
      );

      // Set permissions for the SAS URL with more explicit options
      const sasOptions = {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse('r'), // Read only access
        expiresOn: expiryTime,
        protocol: SASProtocol.Https, // Force HTTPS for security
        startsOn: startTime,
        contentDisposition: "inline", // Make it playable in browser
        contentType: detectedContentType, // Use the detected or provided content type
        cacheControl: "no-cache" // Prevent caching for better refresh handling
      };

      // Generate SAS query parameters using the shared key credential
      const sasToken = generateBlobSASQueryParameters(
        sasOptions,
        sharedKeyCredential
      ).toString();
      
      // Debug: Check if sasToken is complete
      console.log(`SAS token length: ${sasToken.length}`);
      console.log(`SAS token contains signature: ${sasToken.includes('sig=')}`);
      
      // Construct the SAS URL
      const sasUrl = `${blobClient.url}?${sasToken}`;
      
      // Enhanced logging to debug signature truncation
      const sigIndex = sasUrl.indexOf('sig=');
      if (sigIndex !== -1) {
        const sigPart = sasUrl.substring(sigIndex, sigIndex + 50); // Show more of signature
        console.log(`Signature part: ${sigPart}...`);
      }
      
      // Log a truncated version of the URL for debugging (hide most of the token)
      const truncatedUrl = sasUrl.substring(0, Math.min(sasUrl.indexOf('sig=') + 15, sasUrl.length)) + '...';
      console.log(`Generated SAS URL: ${truncatedUrl}`);
      
      // Validate the generated URL format
      if (!sasUrl.includes('sig=') || sasUrl.length < 100) {
        console.error('Generated SAS URL appears to be incomplete or malformed');
        throw new Error('SAS URL generation resulted in malformed URL');
      }
      
      return sasUrl;
    } catch (error) {
      console.error('Error generating SAS URL:', error);
      if (error instanceof Error) {
        throw new Error(`SAS URL generation failed: ${error.message}`);
      }
      throw new Error('SAS URL generation failed for unknown reason');
    }
  }

  /**
   * Get audio file details from Azure blob
   */
  async getAudioFileDetails(containerName: string, blobName: string): Promise<{
    duration: number;
    fileSize: number;
  }> {
    const containerClient = this.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    const properties = await blobClient.getProperties();
    
    // Download the blob to extract audio metadata
    const downloadResponse = await blobClient.download(0);
    const readableStream = downloadResponse.readableStreamBody as Readable;
    
    // Parse audio metadata
    let duration = 0;
    try {
      // Use parseBuffer for Node.js compatibility
      const chunks: Uint8Array[] = [];
      for await (const chunk of readableStream) {
        chunks.push(chunk as Uint8Array);
      }
      const buffer = Buffer.concat(chunks);
      
      const metadata = await mm.parseBuffer(buffer, {
        mimeType: properties.contentType || 'audio/mpeg',
        size: properties.contentLength
      });
      
      duration = metadata.format.duration || 0;
    } catch (error) {
      console.error(`Error parsing audio metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      duration,
      fileSize: properties.contentLength || 0
    };
  }

  /**
   * Check if a blob exists in the container
   */
  async blobExists(containerName: string, blobName: string): Promise<boolean> {
    const containerClient = this.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    
    try {
      await blobClient.getProperties();
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get a blob client and basic information about a blob
   */
  async getBlobClient(containerName: string, blobName: string): Promise<{ name: string, url: string } | null> {
    try {
      const containerClient = this.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobName);
      
      // Check if the blob exists by trying to get its properties
      await blobClient.getProperties();
      
      // Return basic information about the blob
      return {
        name: blobName,
        url: blobClient.url
      };
    } catch (error) {
      console.error(`Error getting blob client for ${blobName}:`, error);
      return null;
    }
  }
  
  /**
   * List all containers in the storage account
   */
  async listContainers(): Promise<string[]> {
    try {
      console.log('Listing all containers in the storage account');
      
      // Get a reference to all containers
      const containerIterator = this.blobServiceClient.listContainers();
      
      // Extract container names
      const containers: string[] = [];
      for await (const container of containerIterator) {
        containers.push(container.name);
      }
      
      console.log(`Found ${containers.length} containers in the storage account`);
      return containers;
    } catch (error) {
      console.error('Error listing containers:', error);
      throw error;
    }
  }
  
  /**
   * Create a new container in the Azure Storage account
   * @param containerName Name of the container to create
   * @param isPublic Whether the container should have public access (optional, default: false)
   * @returns The created ContainerClient if successful
   */
  async createContainer(containerName: string, isPublic: boolean = false): Promise<any> {
    try {
      console.log(`Creating new container: "${containerName}" with public access: ${isPublic}`);
      
      if (!containerName) {
        throw new Error('Container name is required');
      }
      
      // Validate container name according to Azure requirements
      // Container names must be between 3-63 characters, start with a letter or number
      // and can contain only lowercase letters, numbers, and the dash (-) character
      const containerNameRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
      if (!containerNameRegex.test(containerName)) {
        throw new Error('Container name must be 3-63 characters, start with a letter or number, and contain only lowercase letters, numbers, and dashes');
      }
      
      // Get a reference to the container
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      
      // Check if the container already exists
      const exists = await containerClient.exists();
      if (exists) {
        console.log(`Container "${containerName}" already exists`);
        return containerClient;
      }
      
      // Create the container with the appropriate access level
      // PublicAccessType can be 'blob' or 'container'
      // 'blob' means public read access for blobs only
      // 'container' means public read access for container and blobs
      
      // Log detailed information about our connection and attempt
      console.log(`Creating container "${containerName}" in account "${this.accountName}"`);
      console.log(`Container client URL: ${containerClient.url}`);
      
      // Set public or private access - needs to be exactly "blob", "container", or undefined according to SDK
      if (isPublic) {
        // For public access (container level)
        // The access property must be a specific union type: "container" | "blob" | undefined
        const publicAccessType: "container" | "blob" = "container";
        console.log(`Setting container to public access with access type: ${publicAccessType}`);
        
        // Create the container with public access
        console.log(`Sending create request to Azure for container: ${containerName}`);
        const createContainerResponse = await containerClient.create({ access: publicAccessType });
        console.log(`Container "${containerName}" created successfully: ${createContainerResponse.requestId}`);
      } else {
        // For private access
        console.log(`Setting container to private access (undefined options)`);
        
        // Create the container with private access (no options)
        console.log(`Sending create request to Azure for container: ${containerName}`);
        const createContainerResponse = await containerClient.create();
        console.log(`Container "${containerName}" created successfully: ${createContainerResponse.requestId}`);
      }
      
      return containerClient;
    } catch (error) {
      console.error(`Error creating container "${containerName}":`, error);
      throw error;
    }
  }
  
  /**
   * Upload a file to a container in Azure Blob Storage
   * @param containerName Name of the container
   * @param blobName Name to give the blob (file) in Azure
   * @param fileBuffer Buffer containing the file data
   * @param contentType MIME type of the file (optional)
   * @param metadata Additional metadata for the blob (optional)
   * @returns Information about the uploaded blob
   */
  async uploadFile(
    containerName: string, 
    blobName: string, 
    fileBuffer: Buffer,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<{
    name: string;
    url: string;
    etag: string;
    contentType: string;
    contentLength: number;
    lastModified: Date;
  }> {
    try {
      console.log(`Uploading file to container "${containerName}" as "${blobName}"`);
      
      if (!containerName || !blobName || !fileBuffer) {
        throw new Error('Container name, blob name, and file data are required');
      }
      
      // Get the container client
      const containerClient = this.getContainerClient(containerName);
      
      // Check if the container exists
      const containerExists = await containerClient.exists();
      if (!containerExists) {
        console.error(`Container "${containerName}" does not exist`);
        throw new Error(`Container "${containerName}" does not exist`);
      }
      
      // Get the blob client for this file
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      // Determine content type from file extension if not provided
      if (!contentType) {
        const fileExtension = blobName.split('.').pop()?.toLowerCase();
        if (fileExtension) {
          const contentTypeMap: Record<string, string> = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'm4a': 'audio/mp4',
            'aac': 'audio/aac',
            'flac': 'audio/flac',
            'webm': 'audio/webm',
            'mp4': 'audio/mp4',
            '3gp': 'audio/3gpp',
            'amr': 'audio/amr',
            'wma': 'audio/x-ms-wma'
          };
          
          contentType = contentTypeMap[fileExtension] || 'application/octet-stream';
        } else {
          contentType = 'application/octet-stream';
        }
      }
      
      // Set upload options including content type and metadata
      const options = {
        blobHTTPHeaders: {
          blobContentType: contentType
        },
        metadata: metadata || {}
      };
      
      // Upload the file
      const uploadResponse = await blockBlobClient.uploadData(fileBuffer, options);
      console.log(`File uploaded successfully: ${blobName}, ETag: ${uploadResponse.etag}`);
      
      // Get properties of the uploaded blob
      const properties = await blockBlobClient.getProperties();
      
      // Return information about the uploaded blob
      return {
        name: blobName,
        url: blockBlobClient.url,
        etag: properties.etag || '',
        contentType: properties.contentType || contentType,
        contentLength: properties.contentLength || fileBuffer.length,
        lastModified: properties.lastModified || new Date()
      };
    } catch (error) {
      console.error(`Error uploading file to container "${containerName}":`, error);
      throw error;
    }
  }
  
  /**
   * Get properties of a specific blob
   */
  async getBlobProperties(containerName: string, blobName: string): Promise<any> {
    try {
      console.log(`Getting properties for blob "${blobName}" in container "${containerName}"`);
      
      // Get a reference to the blob
      const containerClient = this.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobName);
      
      // Get the blob's properties
      const properties = await blobClient.getProperties();
      
      // Return the properties and URL
      return {
        url: blobClient.url,
        name: blobName,
        properties: {
          contentType: properties.contentType,
          contentLength: properties.contentLength,
          createdOn: properties.createdOn,
          lastModified: properties.lastModified
        }
      };
    } catch (error) {
      console.error(`Error getting properties for blob "${blobName}" in container "${containerName}":`, error);
      return null;
    }
  }

  /**
   * Download an Excel file from Azure blob storage and parse its contents
   */
  async parseMetadataExcel(containerName: string, excelBlobName: string): Promise<any[]> {
    const containerClient = this.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(excelBlobName);
    
    try {
      // Download the Excel file
      const downloadResponse = await blobClient.download(0);
      const chunks: Uint8Array[] = [];
      
      // Read the data
      const readableStream = downloadResponse.readableStreamBody;
      if (!readableStream) {
        throw new Error('Could not read Excel file stream');
      }
      
      // Convert stream to buffer
      for await (const chunk of readableStream) {
        chunks.push(chunk as Uint8Array);
      }
      
      const buffer = Buffer.concat(chunks);
      
      // Parse Excel data
      const workbook = XLSX.read(buffer as Buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);
      
      // Transform Excel data to our metadata format
      return (rows as any[]).map((row: Record<string, any>): any => {
        // Extract base metadata
        const baseMetadata = {
          filename: row.filename || row.Filename || row.FileName || row.file_name || '',
          originalFilename: row.originalFilename || row.OriginalFilename || row.original_filename || row.filename || row.Filename || '',
          language: (row.language || row.Language || 'english').toLowerCase(),
          version: row.version || row.Version || '1.0',
          call_date: row.call_date || row.CallDate || row.Date || new Date().toISOString().split('T')[0],
        };
        
        // Extract callMetrics with all the required properties
        const callMetrics: Record<string, any> = {
          // Standard required fields
          callDate: row.callDate || row.CallDate || new Date().toISOString().split('T')[0],
          callId: row.callId || row.CallId || row.Call_ID || 'unknown',
          callType: row.callType || row.CallType || row.Type || 'unknown',
          
          // Optional fields with defaults
          agentId: row.agentId || row.AgentId || row.Agent_ID || '',
          customerSatisfaction: parseFloat(row.csat || row.CSAT || row.satisfaction || '0') || 0,
          handleTime: parseInt(row.handleTime || row.HandleTime || row.handle_time || '0') || 0,
          
          // New fields from requirements
          auditRole: row.auditRole || row.AuditRole || '',
          OLMSID: row.OLMSID || row.olmsid || row.OlmsId || '',
          Name: row.Name || row.name || '',
          PBXID: row.PBXID || row.pbxid || row.PbxId || '',
          partnerName: row.partnerName || row.PartnerName || row.Partner_Name || '',
          customerMobile: row.customerMobile || row.CustomerMobile || row.customer_mobile || '',
          subType: row.subType || row.SubType || row.sub_type || '',
          subSubType: row.subSubType || row.SubSubType || row.sub_sub_type || '',
          VOC: row.VOC || row.voc || row.Voc || '',
          userRole: row.userRole || row.UserRole || row.user_role || '',
          advisorCategory: row.advisorCategory || row.AdvisorCategory || row.advisor_category || '',
          businessSegment: row.businessSegment || row.BusinessSegment || row.business_segment || '',
          LOB: row.LOB || row.lob || row.LineOfBusiness || '',
          formName: row.formName || row.FormName || row.form_name || '',
          
          // New fields from updated requirements
          callDuration: row.callDuration || row.CallDuration || row.call_duration || '',
          languageOfCall: row.languageOfCall || row.LanguageOfCall || row.language_of_call || row.language || ''
        };
        
        // Add any additional metrics that might be in the Excel
        Object.keys(row).forEach(key => {
          const lowerKey = key.toLowerCase();
          // Skip keys that we've already processed
          if (!['filename', 'originalfilename', 'language', 'version', 'call_date',
               'calldate', 'callid', 'calltype', 'agentid', 'csat',
               'satisfaction', 'handletime', 'auditrole', 'olmsid', 'name',
               'pbxid', 'partnername', 'customermobile', 'subtype', 'subsubtype',
               'voc', 'userrole', 'advisorcategory', 'businesssegment', 'lob',
               'formname', 'callduration', 'languageofcall'].includes(lowerKey)) {
            callMetrics[key] = row[key];
          }
        });
        
        return {
          ...baseMetadata,
          callMetrics
        };
      }).filter((item: any) => item.filename); // Filter out entries without filenames
    } catch (error) {
      console.error(`Error parsing Excel metadata from Azure: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Match audio files from Azure with metadata from Excel
   */
  async matchAudioFilesWithMetadata(
    containerName: string,
    metadataItems: any[]
  ): Promise<any[]> {
    const blobs = await this.listBlobs(containerName);
    const blobMap = new Map<string, BlobItem>();
    
    // Create a map of blob names for faster lookup
    blobs.forEach(blob => {
      blobMap.set(blob.name, blob);
    });
    
    // For each metadata item, find matching blob and enhance with audio details
    const enhancedMetadata: any[] = [];
    
    for (const metadata of metadataItems) {
      // Skip items without filename
      if (!metadata.filename) continue;
      
      const blob = blobMap.get(metadata.filename);
      
      if (blob) {
        try {
          // Get audio details (duration, file size)
          const audioDetails = await this.getAudioFileDetails(containerName, metadata.filename);
          
          // Enhance metadata with audio details
          enhancedMetadata.push({
            ...metadata,
            fileSize: audioDetails.fileSize,
            duration: audioDetails.duration
          });
        } catch (error) {
          console.error(`Error processing audio file ${metadata.filename}: ${error}`);
          // Still include the metadata even if we couldn't get audio details
          enhancedMetadata.push(metadata);
        }
      } else {
        console.warn(`Metadata references file ${metadata.filename} that doesn't exist in container ${containerName}`);
      }
    }
    
    return enhancedMetadata;
  }

  /**
   * Get container client for a specific user's audio files
   * Creates the container if it doesn't exist
   */
  async getUserAudioContainer(username: string): Promise<ContainerClient> {
    // Sanitize username for Azure naming rules
    const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const containerName = `${sanitizedUsername}-audiofile`;
    
    // Get container client
    const containerClient = this.blobServiceClient.getContainerClient(containerName);
    
    // Create container if it doesn't exist (private container)
    if (!(await containerClient.exists())) {
      await containerClient.create();
      console.log(`Created private audio container: ${containerName}`);
    }
    
    return containerClient;
  }

  /**
   * Get file stream from Azure Blob Storage for streaming to client - searches multiple containers
   * This method provides efficient streaming without downloading the entire file
   */
  async getFileStreamFromAzure(filename: string, username: string): Promise<NodeJS.ReadableStream> {
    // Try different container patterns (same as getAudioFileProperties)
    const possibleContainers = [
      `${username}-audiofile`,  // Current expected pattern
      'test20072025',           // Found in debugging - common test container
      'audiofiles',             // Common pattern
      username,                 // Just username
      'audio'                   // Simple audio container
    ];
    
    for (const containerName of possibleContainers) {
      try {
        const containerClient = this.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(filename);
        
        // Check if blob exists
        if (!(await blockBlobClient.exists())) {
          continue;
        }
        
        // Download as stream (starts from position 0)
        const downloadResponse = await blockBlobClient.download(0);
        
        if (!downloadResponse.readableStreamBody) {
          throw new Error('Failed to get readable stream from Azure blob');
        }
        
        console.log(`Streaming audio file '${filename}' from container '${containerName}' for user '${username}'`);
        
        // Return readable stream
        return downloadResponse.readableStreamBody;
      } catch (error) {
        // Continue to next container
        console.log(`Cannot stream ${filename} from container ${containerName}`);
        continue;
      }
    }
    
    throw new Error(`Audio file '${filename}' not found in any expected containers for streaming: ${possibleContainers.join(', ')}`);
  }

  /**
   * Get audio file properties for HTTP headers - searches multiple containers
   */
  async getAudioFileProperties(filename: string, username: string): Promise<{
    contentType: string;
    contentLength: number;
    originalName: string;
    containerName: string;
  }> {
    // Try different container patterns
    const possibleContainers = [
      `${username}-audiofile`,  // Current expected pattern
      'test20072025',           // Found in debugging - common test container
      'audiofiles',             // Common pattern
      username,                 // Just username
      'audio'                   // Simple audio container
    ];
    
    for (const containerName of possibleContainers) {
      try {
        const containerClient = this.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(filename);
        
        // Check if blob exists first
        if (!(await blockBlobClient.exists())) {
          continue;
        }
        
        // Get blob properties
        const properties = await blockBlobClient.getProperties();
        
        console.log(`Found audio file ${filename} in container: ${containerName}`);
        
        return {
          contentType: properties.contentType || 'audio/wav',
          contentLength: properties.contentLength || 0,
          originalName: filename,
          containerName
        };
      } catch (error) {
        // Continue to next container if file not found
        console.log(`File ${filename} not found in container ${containerName}`);
        continue;
      }
    }
    
    throw new Error(`Audio file ${filename} not found in any expected containers: ${possibleContainers.join(', ')}`);
  }
}

export const initAzureStorageService = (): AzureStorageService | null => {
  try {
    // Check for required environment variables and trim whitespace
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();
    
    if (!accountName || !accountKey) {
      console.error('Missing Azure Storage credentials. Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY environment variables.');
      return null;
    }

    console.log('Initializing Azure Storage Service with account:', accountName);
    
    const service = new AzureStorageService(
      accountName,
      accountKey
    );
    
    // Verify service is correctly initialized
    console.log('Azure Storage Service initialized. Testing connection...');
    
    // Return the initialized service
    return service;
  } catch (error) {
    console.error('Failed to initialize Azure Storage Service:', error);
    return null;
  }
};