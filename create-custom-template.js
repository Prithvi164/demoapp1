import * as XLSX from 'xlsx';

// Create a new workbook
const wb = XLSX.utils.book_new();

// Sample data with all required fields - using the actual filenames from your Azure container
// Based on the screenshot you shared earlier, including all the new metadata fields
const sampleData = [
  {
    // Base fields (always required)
    filename: 'agent-261-17027502083-4769-SIL_Inbound-2023_12_15_13_45_05-919880769769.wav',
    originalFilename: 'Customer Call - Billing Issue.wav',
    language: 'english',
    version: '1.0',
    call_date: '2023-12-15',
    
    // All the required callMetrics fields from the table
    auditRole: 'Quality Analyst',
    OLMSID: 'AG123456',
    Name: 'John Smith',
    PBXID: 'PBX987654',
    partnerName: 'CloudPoint Technologies',
    customerMobile: '9876543210',
    callDuration: '180',
    callType: 'inbound',
    subType: 'Customer Service',
    subSubType: 'Billing Inquiry',
    VOC: 'Positive',
    languageOfCall: 'English',
    userRole: 'Agent',
    advisorCategory: 'Challenger',
    businessSegment: 'Care',
    LOB: 'Prepaid',
    formName: 'Evaluation Form 1',
    
    // Required call identification fields
    callId: 'CALL-123-25',
    callDate: '2023-12-15'
  },
  {
    // Base fields (always required)
    filename: 'agent-261-17027502084-1546-SIL_Inbound-2023_12_15_10_35_33-919700514723.wav',
    originalFilename: 'Customer Call - Technical Issue.wav',
    language: 'spanish',
    version: '1.0',
    call_date: '2023-12-15',
    
    // All the required callMetrics fields from the table
    auditRole: 'Quality Analyst',
    OLMSID: 'AG234567',
    Name: 'Jane Doe',
    PBXID: 'PBX123456',
    partnerName: 'CloudPoint Technologies',
    customerMobile: '8765432109',
    callDuration: '240',
    callType: 'outbound',
    subType: 'Technical Support',
    subSubType: 'Hardware Issue',
    VOC: 'Negative',
    languageOfCall: 'Spanish',
    userRole: 'Senior Agent',
    advisorCategory: 'Performer',
    businessSegment: 'Tech Support',
    LOB: 'Postpaid',
    formName: 'Evaluation Form 1',
    
    // Required call identification fields
    callId: 'CALL-456-25',
    callDate: '2023-12-15'
  },
  {
    // Base fields (always required)
    filename: 'agent-261-17027502091-7026-SIL_Inbound-2023_12_15_17_00_21-918317567741.wav', 
    originalFilename: 'Customer Call - Product Inquiry.wav',
    language: 'french',
    version: '1.0',
    call_date: '2023-12-15',
    
    // All the required callMetrics fields from the table
    auditRole: 'Quality Analyst',
    OLMSID: 'AG345678',
    Name: 'Robert Johnson',
    PBXID: 'PBX234567',
    partnerName: 'CloudPoint Technologies',
    customerMobile: '7654321098',
    callDuration: '320',
    callType: 'inbound',
    subType: 'Sales',
    subSubType: 'Product Information',
    VOC: 'Positive',
    languageOfCall: 'French',
    userRole: 'Agent',
    advisorCategory: 'Challenger',
    businessSegment: 'Sales',
    LOB: 'Enterprise',
    formName: 'Evaluation Form 1',
    
    // Required call identification fields
    callId: 'CALL-789-25',
    callDate: '2023-12-15'
  },
  {
    // Base fields (always required)
    filename: 'agent-261-17027502092-7136-SIL_Inbound-2023_12_15_17_10_21-918369128186.wav',
    originalFilename: 'Customer Call - General Inquiry.wav',
    language: 'german',
    version: '1.0',
    call_date: '2023-12-15',
    
    // All the required callMetrics fields from the table
    auditRole: 'Quality Analyst',
    OLMSID: 'AG456789',
    Name: 'Anna Schmidt',
    PBXID: 'PBX345678',
    partnerName: 'CloudPoint Technologies',
    customerMobile: '6543210987',
    callDuration: '150',
    callType: 'inbound',
    subType: 'General',
    subSubType: 'Account Inquiry',
    VOC: 'Neutral',
    languageOfCall: 'German',
    userRole: 'Agent',
    advisorCategory: 'Performer',
    businessSegment: 'Care',
    LOB: 'Corporate',
    formName: 'Evaluation Form 1',
    
    // Required call identification fields
    callId: 'CALL-101-25',
    callDate: '2023-12-15'
  },
  {
    // Base fields (always required)
    filename: 'agent-403-17027502071-7108-SIL_Inbound-2023_12_15_17_46_91-919784897046.wav',
    originalFilename: 'Customer Call - Support Call.wav',
    language: 'english',
    version: '1.0',
    call_date: '2023-12-15',
    
    // All the required callMetrics fields from the table
    auditRole: 'Quality Analyst',
    OLMSID: 'AG567890',
    Name: 'Michael Brown',
    PBXID: 'PBX456789',
    partnerName: 'CloudPoint Technologies',
    customerMobile: '5432109876',
    callDuration: '270',
    callType: 'inbound',
    subType: 'Support',
    subSubType: 'Technical Issue',
    VOC: 'Positive',
    languageOfCall: 'English',
    userRole: 'Senior Agent',
    advisorCategory: 'Challenger',
    businessSegment: 'Tech Support',
    LOB: 'Prepaid',
    formName: 'Evaluation Form 1',
    
    // Required call identification fields
    callId: 'CALL-202-25',
    callDate: '2023-12-15'
  }
];

// Create worksheet and add to workbook
const ws = XLSX.utils.json_to_sheet(sampleData);
XLSX.utils.book_append_sheet(wb, ws, 'Audio Metadata');

// Add column width specifications for better readability
const wscols = [
  { wch: 70 }, // filename (extra wide for the long filenames)
  { wch: 40 }, // originalFilename
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
ws['!cols'] = wscols;

// Write to file
XLSX.writeFile(wb, 'custom-audio-template.xlsx');

console.log('Custom Excel template created: custom-audio-template.xlsx');