import * as XLSX from 'xlsx';
import * as fs from 'fs';

// Create a new workbook
const wb = XLSX.utils.book_new();

// Sample data with all required fields
const sampleData = [
  {
    filename: 'agent-261-17027502083-47.mp3', // This should match the actual filename in Azure
    originalFilename: 'Customer Call - Technical Issue.mp3',
    language: 'english', // must be one of: english, spanish, french, hindi, other
    version: '1.0',
    call_date: '2025-04-01', // YYYY-MM-DD format
    callId: '101',
    callType: 'inbound',
    agentId: '249',
    campaignName: 'Support_Inbound',
    duration: 3, // in minutes
    disposition1: 'Issue Resolved',
    disposition2: 'Satisfied',
    customerMobile: '9876543210',
    callTime: '14:30:45',
    subType: 'Technical Support',
    subSubType: 'Login Issue',
    VOC: 'Positive',
    userRole: 'Agent',
    advisorCategory: 'Level 1',
    queryType: 'Technical',
    businessSegment: 'Consumer'
  },
  {
    filename: 'agent-403-17027502071-7108.mp3',
    originalFilename: 'Customer Call - Billing Question.mp3',
    language: 'english',
    version: '1.0',
    call_date: '2025-04-01',
    callId: '102',
    callType: 'inbound',
    agentId: '403',
    campaignName: 'Billing_Support',
    duration: 2,
    disposition1: 'Issue Resolved',
    disposition2: 'Satisfied',
    customerMobile: '8765432109',
    callTime: '15:45:30',
    subType: 'Billing',
    subSubType: 'Payment Issue',
    VOC: 'Neutral',
    userRole: 'Agent',
    advisorCategory: 'Level 1',
    queryType: 'Billing',
    businessSegment: 'Consumer'
  },
  {
    filename: 'agent-403-17027502072-7253.mp3',
    originalFilename: 'Customer Call - Product Inquiry.mp3',
    language: 'english',
    version: '1.0',
    call_date: '2025-04-01',
    callId: '103',
    callType: 'inbound',
    agentId: '403',
    campaignName: 'Sales_Support',
    duration: 4,
    disposition1: 'Interested',
    disposition2: 'Follow-up Required',
    customerMobile: '7654321098',
    callTime: '16:30:15',
    subType: 'Product Inquiry',
    subSubType: 'Feature Question',
    VOC: 'Positive',
    userRole: 'Agent',
    advisorCategory: 'Level 2',
    queryType: 'Sales',
    businessSegment: 'Enterprise'
  }
];

// Create worksheet and add to workbook
const ws = XLSX.utils.json_to_sheet(sampleData);
XLSX.utils.book_append_sheet(wb, ws, 'Audio Metadata');

// Add column width specifications for better readability
const wscols = [
  { wch: 30 }, // filename
  { wch: 40 }, // originalFilename
  { wch: 10 }, // language
  { wch: 10 }, // version
  { wch: 12 }, // call_date
  { wch: 10 }, // callId
  { wch: 10 }, // callType
  { wch: 10 }, // agentId
  { wch: 20 }, // campaignName
  { wch: 10 }, // duration
  { wch: 12 }, // disposition1
  { wch: 12 }, // disposition2
  { wch: 15 }, // customerMobile
  { wch: 10 }, // callTime
  { wch: 15 }, // subType
  { wch: 15 }, // subSubType
  { wch: 10 }, // VOC
  { wch: 12 }, // userRole
  { wch: 15 }, // advisorCategory
  { wch: 12 }, // queryType
  { wch: 18 }  // businessSegment
];
ws['!cols'] = wscols;

// Write to file
XLSX.writeFile(wb, 'audio-metadata-template.xlsx');

console.log('Excel template created: audio-metadata-template.xlsx');