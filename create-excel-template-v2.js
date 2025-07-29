// New, more reliable template generator using simpler methods
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

console.log('Creating Excel template with all required fields...');

try {
  // Create a workbook from scratch
  const wb = XLSX.utils.book_new();

  // Create a worksheet with all the required fields (array of arrays)
  const data = [
    [
      // Base fields
      'filename', 'language', 'version', 'call_date',
      
      // Required metadata fields for callMetrics
      'auditRole', 'OLMSID', 'Name', 'PBXID', 'partnerName', 
      'customerMobile', 'callDuration', 'callType', 'subType', 
      'subSubType', 'VOC', 'languageOfCall', 'userRole', 'advisorCategory', 
      'businessSegment', 'LOB', 'formName',
      
      // Required call identification fields
      'callId', 'callDate'
    ],
    [
      // Base fields with sample values
      'agent-261-17027502083-444.mp3', 'english', '1.0', '2025-04-03', // language can be: english, hindi, tamil, bengali, telugu, etc
      
      // Required metadata fields with sample values
      'Quality Analyst', 'AG123456', 'John Smith', 'PBX987654', 'CloudPoint Technologies',
      '9876543210', '180', 'inbound', 'Customer Service',
      'Billing Inquiry', 'Positive', 'English', 'Agent', 'Challenger',
      'Care', 'Prepaid', 'Evaluation Form 1',
      
      // Required call identification fields
      'CALL-123-25', '2025-04-03'
    ]
  ];

  // Convert data to worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths for better visibility
  ws['!cols'] = [
    { wch: 70 }, // filename (extra wide for the long filenames)
    { wch: 10 }, // language
    { wch: 10 }, // version
    { wch: 12 }, // call_date
    { wch: 15 }, // auditRole
    { wch: 15 }, // OLMSID
    { wch: 20 }, // Name
    { wch: 15 }, // PBXID
    { wch: 25 }, // partnerName
    { wch: 15 }, // customerMobile
    { wch: 15 }, // callDuration
    { wch: 12 }, // callType
    { wch: 15 }, // subType
    { wch: 20 }, // subSubType
    { wch: 15 }, // VOC
    { wch: 15 }, // languageOfCall
    { wch: 15 }, // userRole
    { wch: 20 }, // advisorCategory
    { wch: 20 }, // businessSegment
    { wch: 15 }, // LOB
    { wch: 20 }, // formName
    { wch: 15 }, // callId
    { wch: 15 }  // callDate
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Template');

  // Generate XLSX file (binary string)
  const binaryString = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  
  // Convert binary string to buffer
  const buffer = Buffer.from(new Uint8Array(binaryString.length));
  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i) & 0xFF;
  }
  
  // Write file to disk
  writeFileSync('template.xlsx', buffer);
  console.log('Excel template with all required fields created successfully: template.xlsx');
} catch (error) {
  console.error('Error creating template:', error);
}