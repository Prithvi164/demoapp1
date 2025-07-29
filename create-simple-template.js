import * as XLSX from 'xlsx';

// Create the simplest possible Excel file with a header and one data row
try {
  console.log('Creating ultra-simple Excel template...');
  
  // Create a basic workbook
  const wb = XLSX.utils.book_new();
  
  // Create a worksheet with array-of-arrays method (most reliable)
  // Include all the required fields from the metadata requirements
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
      // Base fields
      'example-file-123.mp3', 'english', '1.0', '2025-04-03',
      
      // Required metadata fields with sample values
      'Quality Analyst', 'AG123456', 'John Smith', 'PBX987654', 'CloudPoint Technologies',
      '9876543210', '180', 'inbound', 'Customer Service',
      'Billing Inquiry', 'Positive', 'English', 'Agent', 'Challenger',
      'Care', 'Prepaid', 'Evaluation Form 1',
      
      // Required call identification fields
      'CALL-123-25', '2025-04-03'
    ]
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Add column widths for better readability
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
  XLSX.utils.book_append_sheet(wb, ws, 'Simple Template');
  
  // Write file to disk
  XLSX.writeFile(wb, 'ultra-simple-template.xlsx');
  
  console.log('Ultra-simple Excel template created successfully: ultra-simple-template.xlsx');
} catch (error) {
  console.error('Error creating simple template:', error);
}