import * as XLSX from 'xlsx';

// Create a new workbook
const wb = XLSX.utils.book_new();

// Sample data with ONLY the absolutely required fields including the newly required metadata fields
const sampleData = [
  {
    // Base fields (always required)
    filename: 'agent-261-17027502083-4769-SIL_Inbound-2023_12_15_13_45_05-919880769769.wav',
    language: 'english',
    version: '1.0',
    call_date: '2023-12-15',
    
    // Required metadata fields for callMetrics
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
    language: 'spanish',
    version: '1.0',
    call_date: '2023-12-15',
    
    // Required metadata fields for callMetrics
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
  }
];

// Create worksheet and add to workbook
const ws = XLSX.utils.json_to_sheet(sampleData);
XLSX.utils.book_append_sheet(wb, ws, 'Audio Metadata');

// Add column width specifications for better readability
const wscols = [
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
ws['!cols'] = wscols;

// Write to file
XLSX.writeFile(wb, 'minimal-audio-template.xlsx');

console.log('Minimal Excel template created: minimal-audio-template.xlsx');