/**
 * Tests for the Excel Parser module
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { parseExcel } = require('../src/excel-parser');

// Mock the logger to avoid console output during tests
jest.mock('../src/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Excel Parser', () => {
  const testDataDir = path.join(__dirname, 'data');
  const testFilePath = path.join(testDataDir, 'test-people.xlsx');
  
  // Create test data directory if it doesn't exist
  beforeAll(() => {
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });
  
  // Create a test Excel file before each test
  beforeEach(() => {
    // Create a workbook with test data
    const workbook = XLSX.utils.book_new();
    
    // Define test data matching the sample CSV format
    const testData = [
      ['matricule', 'nom', 'prenom', 'datedenaissance', 'status'],
      ['FRSE2X8S', 'Girard', 'David', '1984-09-21', 'Inactif'],
      ['LKSTKRAH', 'Thomas', 'Rachel', '03/13/1971', 'Actif'],
      ['ABC123XY', 'Dupont', 'Jean', '1990-05-15', 'Actif']
    ];
    
    // Create a worksheet from the test data
    const worksheet = XLSX.utils.aoa_to_sheet(testData);
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'People');
    
    // Write the workbook to a file
    XLSX.writeFile(workbook, testFilePath);
  });
  
  // Clean up test files after each test
  afterEach(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });
  
  test('should parse Excel file correctly', async () => {
    // Parse the test Excel file
    const people = await parseExcel(testFilePath);
    
    // Check that the correct number of people were parsed
    expect(people).toHaveLength(3);
    
    // Check that the first person's data is correct
    expect(people[0]).toEqual({
      external_id: 'FRSE2X8S',
      last_name: 'Girard',
      first_name: 'David',
      birth_date: '1984-09-21',
      status: 'Inactif',
      name: 'Girard David'
    });
    
    // Check that the second person's data is correct
    expect(people[1]).toEqual({
      external_id: 'LKSTKRAH',
      last_name: 'Thomas',
      first_name: 'Rachel',
      birth_date: '03/13/1971',
      status: 'Actif',
      name: 'Thomas Rachel'
    });
  });
  
  test('should handle empty rows', async () => {
    // Create a workbook with test data including empty rows
    const workbook = XLSX.utils.book_new();
    
    // Define test data with empty rows
    const testData = [
      ['matricule', 'nom', 'prenom', 'datedenaissance', 'status'],
      ['FRSE2X8S', 'Girard', 'David', '1984-09-21', 'Inactif'],
      [], // Empty row
      ['LKSTKRAH', 'Thomas', 'Rachel', '03/13/1971', 'Actif'],
      ['', '', '', '', ''], // Row with empty cells
      ['ABC123XY', 'Dupont', 'Jean', '1990-05-15', 'Actif']
    ];
    
    // Create a worksheet from the test data
    const worksheet = XLSX.utils.aoa_to_sheet(testData);
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'People');
    
    // Write the workbook to a file
    XLSX.writeFile(workbook, testFilePath);
    
    // Parse the test Excel file
    const people = await parseExcel(testFilePath);
    
    // Check that empty rows were filtered out
    expect(people).toHaveLength(3);
  });
  
  test('should handle missing required headers', async () => {
    // Create a workbook with test data that's missing required headers
    const workbook = XLSX.utils.book_new();
    
    // Define test data with missing headers
    const testData = [
      ['Name', 'Status'], // Missing external_id, birth_date
      ['John Doe', 'Active'],
      ['Jane Smith', 'Inactive']
    ];
    
    // Create a worksheet from the test data
    const worksheet = XLSX.utils.aoa_to_sheet(testData);
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'People');
    
    // Write the workbook to a file
    XLSX.writeFile(workbook, testFilePath);
    
    // The function should now log a warning but not throw an error
    const result = await parseExcel(testFilePath);
    
    // Verify that the data was parsed correctly
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('John Doe');
    expect(result[0].status).toBe('Active');
    
    // Note: The name splitting happens in the database.normalizePersonFields function,
    // not in the parseExcel function, so we don't expect first_name and last_name here
  });
  
  test('should throw error for empty Excel file', async () => {
    // Create an empty workbook
    const workbook = XLSX.utils.book_new();
    
    // Create an empty worksheet
    const worksheet = XLSX.utils.aoa_to_sheet([]);
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'People');
    
    // Write the workbook to a file
    XLSX.writeFile(workbook, testFilePath);
    
    // Expect the parseExcel function to throw an error
    await expect(parseExcel(testFilePath)).rejects.toThrow('Excel file does not contain enough data');
  });
}); 