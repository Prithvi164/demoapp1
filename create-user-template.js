// User template generator with multiple process support
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

console.log('Creating Excel template for bulk user upload with multiple processes support...');

try {
  // Create a workbook from scratch
  const wb = XLSX.utils.book_new();

  // Create a worksheet with all the required fields (array of arrays)
  const data = [
    [
      // Required user fields
      'username', 'password', 'fullName', 'email', 'employeeId',
      'phoneNumber', 'role', 'manager', 'location', 'process',
      'dateOfJoining', 'dateOfBirth', 'education'
    ],
    [
      // First example - single process
      'john.doe', 'Password123', 'John Doe', 'john.doe@example.com', 'EMP001',
      '9876543210', 'trainee', 'jane.smith', 'Mumbai', 'Customer Support',
      '2023-01-15', '1990-05-20', 'Bachelors in Business'
    ],
    [
      // Second example - multiple processes
      'jane.smith', 'Password123', 'Jane Smith', 'jane.smith@example.com', 'EMP002',
      '9876543211', 'trainer', 'robert.jones', 'Delhi', 'Customer Support, Technical Support, Billing Support',
      '2022-10-10', '1988-07-12', 'Masters in Management'
    ],
    [
      // Third example - another multiple processes
      'robert.jones', 'Password123', 'Robert Jones', 'robert.jones@example.com', 'EMP003',
      '9876543212', 'manager', '', 'Bangalore', 'Sales Process, Customer Retention',
      '2021-05-22', '1985-03-18', 'MBA'
    ]
  ];

  // Add notes about multiple processes
  const notes = [
    ['IMPORTANT NOTES:'],
    ['1. For the "process" field, you can specify multiple processes separated by commas.'],
    ['2. The system will automatically map each process to its correct Line of Business.'],
    ['3. All the processes listed for a user must exist in the system.'],
    ['4. Example: "Customer Support, Technical Support, Billing Support"'],
    [''],
    ['Valid roles: trainee, trainer, advisor, manager, team_lead, quality_analyst, admin']
  ];

  // Convert data to worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Add notes at the bottom (starting at row 6)
  notes.forEach((note, index) => {
    XLSX.utils.sheet_add_aoa(ws, [note], { origin: { r: 6 + index, c: 0 } });
  });

  // Set column widths for better visibility
  ws['!cols'] = [
    { wch: 15 }, // username
    { wch: 15 }, // password
    { wch: 20 }, // fullName
    { wch: 25 }, // email
    { wch: 15 }, // employeeId
    { wch: 15 }, // phoneNumber
    { wch: 15 }, // role
    { wch: 15 }, // manager
    { wch: 15 }, // location
    { wch: 50 }, // process (wide for multiple entries)
    { wch: 15 }, // dateOfJoining
    { wch: 15 }, // dateOfBirth
    { wch: 25 }  // education
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Bulk User Upload');

  // Generate XLSX file (binary string)
  const binaryString = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  
  // Convert binary string to buffer
  const buffer = Buffer.from(new Uint8Array(binaryString.length));
  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i) & 0xFF;
  }
  
  // Write file to disk
  writeFileSync('user-bulk-upload-template.xlsx', buffer);
  console.log('Excel template for bulk user upload created successfully: user-bulk-upload-template.xlsx');
} catch (error) {
  console.error('Error creating template:', error);
}