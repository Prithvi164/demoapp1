// Script to analyze Excel file metadata
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Function to analyze Excel file
async function analyzeExcelFile(filePath) {
  try {
    console.log(`Analyzing Excel file: ${filePath}`);
    
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Total rows: ${data.length}`);
    
    // Analyze Partner Name
    const partnerNameCounts = {};
    let partnerNameFieldNames = ['partnerName', 'Partner Name', 'Partner_Name', 'partnername'];
    
    // Count occurrences of each partner name
    data.forEach(row => {
      let partnerName = null;
      
      // Check all possible field names
      for (const fieldName of partnerNameFieldNames) {
        if (row[fieldName]) {
          partnerName = row[fieldName];
          break;
        }
      }
      
      if (partnerName) {
        partnerNameCounts[partnerName] = (partnerNameCounts[partnerName] || 0) + 1;
      }
    });
    
    console.log('Partner Name counts:');
    console.log(partnerNameCounts);
    
    // If CloudSocial is present, get the count
    const cloudSocialCount = partnerNameCounts['CloudSocial'] || 0;
    console.log(`CloudSocial count: ${cloudSocialCount}`);
    
    return {
      totalRows: data.length,
      partnerNameCounts,
      cloudSocialCount
    };
  } catch (error) {
    console.error('Error analyzing Excel file:', error);
    return null;
  }
}

// List files in the attached_assets directory and find Excel files
const assetsDir = 'attached_assets';
const files = fs.readdirSync(assetsDir);
const excelFiles = files.filter(file => file.endsWith('.xlsx'));

console.log(`Found ${excelFiles.length} Excel files in ${assetsDir}`);

// Analyze each Excel file
for (const file of excelFiles) {
  const filePath = path.join(assetsDir, file);
  analyzeExcelFile(filePath)
    .then(result => {
      if (result) {
        console.log(`Analysis complete for ${file}`);
      }
    })
    .catch(err => {
      console.error(`Error analyzing ${file}:`, err);
    });
}