/**
 * Generate a test Excel file with sample data
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Create the examples directory if it doesn't exist
const examplesDir = path.join(__dirname);
if (!fs.existsSync(examplesDir)) {
  fs.mkdirSync(examplesDir, { recursive: true });
}

// Define the output file path
const outputFile = path.join(examplesDir, 'sample-people.xlsx');

// Create a workbook
const workbook = XLSX.utils.book_new();

// Define headers
const headers = [
  'ID', 'First Name', 'Last Name', 'Birth Date', 'Status', 'Email', 'Phone', 'Address', 'City', 'Country'
];

// Generate sample data
const data = [
  headers,
  ['EMP001', 'John', 'Doe', '1980-01-15', 'Active', 'john.doe@example.com', '555-123-4567', '123 Main St', 'New York', 'USA'],
  ['EMP002', 'Jane', 'Smith', '1985-05-20', 'Active', 'jane.smith@example.com', '555-987-6543', '456 Oak Ave', 'Los Angeles', 'USA'],
  ['EMP003', 'Robert', 'Johnson', '1975-11-08', 'Inactive', 'robert.j@example.com', '555-456-7890', '789 Pine Rd', 'Chicago', 'USA'],
  ['EMP004', 'Maria', 'Garcia', '1990-03-25', 'Active', 'maria.g@example.com', '555-789-0123', '321 Elm St', 'Miami', 'USA'],
  ['EMP005', 'David', 'Lee', '1982-07-12', 'Active', 'david.lee@example.com', '555-234-5678', '654 Maple Dr', 'San Francisco', 'USA'],
  ['EMP006', 'Sarah', 'Wilson', '1988-09-30', 'Active', 'sarah.w@example.com', '555-345-6789', '987 Cedar Ln', 'Seattle', 'USA'],
  ['EMP007', 'Michael', 'Brown', '1979-04-18', 'Inactive', 'michael.b@example.com', '555-456-7890', '159 Birch Ave', 'Boston', 'USA'],
  ['EMP008', 'Lisa', 'Taylor', '1992-12-05', 'Active', 'lisa.t@example.com', '555-567-8901', '753 Spruce St', 'Denver', 'USA'],
  ['EMP009', 'James', 'Anderson', '1984-08-22', 'Active', 'james.a@example.com', '555-678-9012', '246 Walnut Rd', 'Austin', 'USA'],
  ['EMP010', 'Jennifer', 'Thomas', '1987-06-14', 'Active', 'jennifer.t@example.com', '555-789-0123', '135 Cherry Ln', 'Portland', 'USA']
];

// Create a worksheet
const worksheet = XLSX.utils.aoa_to_sheet(data);

// Add the worksheet to the workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'People');

// Write the workbook to a file
XLSX.writeFile(workbook, outputFile);

console.log(`Test Excel file created at: ${outputFile}`);

// Generate a larger file for testing streaming
const largeOutputFile = path.join(examplesDir, 'large-sample-people.xlsx');

// Generate a large dataset (5000 records)
const largeData = [headers];

for (let i = 1; i <= 5000; i++) {
  const id = `EMP${String(i).padStart(5, '0')}`;
  const firstName = `FirstName${i}`;
  const lastName = `LastName${i}`;
  const birthDate = `1980-01-${(i % 28) + 1}`;
  const status = i % 10 === 0 ? 'Inactive' : 'Active';
  const email = `person${i}@example.com`;
  const phone = `555-${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  const address = `${i} Main St`;
  const city = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][i % 5];
  const country = 'USA';
  
  largeData.push([id, firstName, lastName, birthDate, status, email, phone, address, city, country]);
}

// Create a worksheet for the large dataset
const largeWorksheet = XLSX.utils.aoa_to_sheet(largeData);

// Add the worksheet to a new workbook
const largeWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(largeWorkbook, largeWorksheet, 'People');

// Write the large workbook to a file
XLSX.writeFile(largeWorkbook, largeOutputFile);

console.log(`Large test Excel file created at: ${largeOutputFile}`); 