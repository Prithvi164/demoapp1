import * as XLSX from 'xlsx';
import { join } from 'path';

// Create workbook
const wb = XLSX.utils.book_new();

// Define headers with role added
const headers = [
  'username',
  'fullName',
  'email',
  'employeeId',
  'phoneNumber',
  'dateOfJoining',
  'dateOfBirth',
  'education',
  'password',
  'role' // Valid roles: manager, team_lead, quality_analyst, trainer, advisor
];

// Create example data row with role
const exampleData = [
  'john.doe',
  'John Doe',
  'john.doe@example.com',
  'EMP123',
  '+1234567890',
  '2025-03-06', // Format: YYYY-MM-DD
  '1990-01-01', // Format: YYYY-MM-DD
  'Bachelor\'s Degree',
  'Password123!', // Will be hashed on upload
  'advisor' // Example role (can be: manager, team_lead, quality_analyst, trainer, advisor)
];

// Create worksheet with headers and example data
const ws = XLSX.utils.aoa_to_sheet([headers, exampleData]);

// Add column widths for better readability
ws['!cols'] = [
  { wch: 15 }, // username
  { wch: 20 }, // fullName
  { wch: 25 }, // email
  { wch: 12 }, // employeeId
  { wch: 15 }, // phoneNumber
  { wch: 15 }, // dateOfJoining
  { wch: 15 }, // dateOfBirth
  { wch: 20 }, // education
  { wch: 15 }, // password
  { wch: 15 }  // role
];

// Add styling to headers
for (let i = 0; i < headers.length; i++) {
  const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
  if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headers[i] };
  ws[cellRef].s = { font: { bold: true } };
}

// Add note for role column
const roleCell = XLSX.utils.encode_cell({ r: 1, c: 9 }); // Column J, Row 2 (example data)
ws[roleCell].c = [{
  a: "Author",
  t: "Valid roles: manager, team_lead, quality_analyst, trainer, advisor"
}];

// Add the worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Trainees');

// Write to file
const templatePath = join(process.cwd(), 'public', 'templates', 'trainee-upload-template.xlsx');
XLSX.writeFile(wb, templatePath);

console.log('Template created successfully at:', templatePath);