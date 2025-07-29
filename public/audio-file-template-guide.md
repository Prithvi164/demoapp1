# Audio File Template Guide

This guide explains the different template options available for importing audio file metadata.

## Why Use Templates?

Templates help you structure your data correctly for import into the system. Each template comes pre-formatted with:

- Required column headers
- Properly formatted sample data
- Column widths optimized for readability

## Available Template Types

We offer several templates to meet different needs:

### 1. Standard Template

- Most comprehensive option
- Includes all possible metadata fields
- Best for detailed audio file catalogs

### 2. Minimal Template

- Simplified version with only essential fields
- Easier to fill out quickly
- Good for basic imports

### 3. Custom Template

- Tailored to your specific needs
- Contact support to customize fields
- Useful for specific workflows

### 4. Ultra-Simple Template

- Absolute minimum required fields only
- Most reliable format across Excel versions 
- Recommended if other templates cause opening errors

## Required Fields

All templates must include these essential fields:

| Field | Description | Example |
|-------|-------------|---------|
| filename | Exact filename as stored in Azure (case-sensitive) | agent-261-17027502083-444.mp3 |
| language | Language of the audio recording | english |  
| version | Version identifier | 1.0 |
| call_date | Date the call was recorded | 2025-04-03 |

## Troubleshooting Template Issues

If you encounter Excel file opening errors:

1. Try using the Ultra-Simple template first
2. Download the `ultra-simple-template.xlsx` file from the system
3. Manually enter your data in that file following the provided example

## Important Notes

- Filenames must exactly match those in Azure storage
- Date formats should be YYYY-MM-DD for best compatibility
- Don't modify column headers as they are required for import
- Save files as .xlsx format
- Avoid special characters in the data cells