/**
 * Tests for the Database module
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { getConnection, closeConnection, saveToDatabase, closeAllConnections } = require('../src/database');
const database = require('../src/database');
const sqliteAdapter = require('../src/adapters/sqlite-adapter');
const { logger } = require('../src/logger');

// Mock the logger to avoid console output during tests
jest.mock('../src/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Database Module', () => {
  const testDbPath = path.join(__dirname, 'data', 'test-people.db');
  let db;
  
  // Set up test environment
  beforeAll(() => {
    // Create the test data directory if it doesn't exist
    const testDataDir = path.dirname(testDbPath);
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });
  
  // Set up before each test
  beforeEach(async () => {
    // Delete the test database file if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Initialize the database
    db = await getConnection('test-db', {
      type: 'sqlite',
      path: testDbPath
    });
  });
  
  // Clean up after each test
  afterEach(async () => {
    // Close the database connection
    await closeConnection('test-db');
    
    // Delete the test database file if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
  
  test('should initialize database successfully', async () => {
    // Check that the database connection is valid
    expect(db).toBeDefined();
    expect(db.connection instanceof sqlite3.Database).toBe(true);
  });
  
  test('should save people data to database', async () => {
    // Define test data matching the sample CSV format
    const testPeople = [
      {
        external_id: 'FRSE2X8S',
        last_name: 'Girard',
        first_name: 'David',
        birth_date: '1984-09-21',
        status: 'Inactif',
        name: 'Girard David'
      },
      {
        external_id: 'LKSTKRAH',
        last_name: 'Thomas',
        first_name: 'Rachel',
        birth_date: '03/13/1971',
        status: 'Actif',
        name: 'Thomas Rachel'
      }
    ];
    
    // Save the test data to the database
    const result = await saveToDatabase(db, testPeople);
    
    // Check that the correct number of records were inserted
    expect(result.inserted).toBe(2);
    expect(result.errors).toBe(0);
    
    // Query the database to verify the data was saved
    const people = await new Promise((resolve, reject) => {
      db.connection.all('SELECT * FROM people', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
    
    // Check that the correct number of records are in the database
    expect(people).toHaveLength(2);
    
    // Check that the first person's data is correct
    expect(people[0].external_id).toBe('FRSE2X8S');
    expect(people[0].last_name).toBe('Girard');
    expect(people[0].first_name).toBe('David');
    expect(people[0].birth_date).toBe('1984-09-21');
    expect(people[0].status).toBe('Inactif');
  });
  
  test('should handle additional data fields', async () => {
    // Define test data with additional fields
    const testPeople = [
      {
        external_id: 'FRSE2X8S',
        last_name: 'Girard',
        first_name: 'David',
        birth_date: '1984-09-21',
        status: 'Inactif',
        name: 'Girard David',
        custom_field1: 'Custom Value 1',
        custom_field2: 'Custom Value 2'
      }
    ];
    
    // Save the test data to the database
    const result = await saveToDatabase(db, testPeople);
    
    // Check that the record was inserted
    expect(result.inserted).toBe(1);
    
    // Query the database to verify the data was saved
    const people = await new Promise((resolve, reject) => {
      db.connection.all('SELECT * FROM people', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
    
    // Check that the additional data was saved as JSON
    expect(people).toHaveLength(1);
    expect(people[0].external_id).toBe('FRSE2X8S');
    
    // Parse the additional_data JSON
    const additionalData = JSON.parse(people[0].additional_data);
    expect(additionalData.custom_field1).toBe('Custom Value 1');
    expect(additionalData.custom_field2).toBe('Custom Value 2');
  });
  
  test('should handle empty people array', async () => {
    // Save an empty array to the database
    const result = await saveToDatabase(db, []);
    
    // Check that no records were inserted
    expect(result.inserted).toBe(0);
  });
  
  test('should skip records without identifying information', async () => {
    // Define test data with a record missing identifying information
    const testPeople = [
      {
        external_id: 'FRSE2X8S',
        last_name: 'Girard',
        first_name: 'David',
        birth_date: '1984-09-21',
        status: 'Inactif',
        name: 'Girard David'
      },
      {
        // Missing external_id, first_name, last_name, and name
        status: 'Actif'
      }
    ];
    
    // Save the test data to the database
    const result = await saveToDatabase(db, testPeople);
    
    // Check that only one record was inserted
    expect(result.inserted).toBe(1);
    
    // Query the database to verify the data was saved
    const people = await new Promise((resolve, reject) => {
      db.connection.all('SELECT * FROM people', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
    
    // Check that only the record with identifying information was saved
    expect(people).toHaveLength(1);
    expect(people[0].external_id).toBe('FRSE2X8S');
  });
});

describe('Field Normalization', () => {
  test('should normalize field names correctly', () => {
    const person = {
      'ID': '12345',
      'First Name': 'John',
      'Last Name': 'Doe',
      'Birth Date': '1980-01-01',
      'Status': 'Active'
    };
    
    const normalized = database.normalizePersonFields(person);
    
    expect(normalized).toEqual({
      'external_id': '12345',
      'first_name': 'John',
      'last_name': 'Doe',
      'birth_date': '1980-01-01',
      'status': 'Active',
      'name': 'Doe John'
    });
  });
  
  test('should handle mixed case field names', () => {
    const person = {
      'id': '12345',
      'firstName': 'John',
      'lastName': 'Doe',
      'birthDate': '1980-01-01',
      'status': 'Active'
    };
    
    const normalized = database.normalizePersonFields(person);
    
    expect(normalized).toEqual({
      'external_id': '12345',
      'first_name': 'John',
      'last_name': 'Doe',
      'birth_date': '1980-01-01',
      'status': 'Active',
      'name': 'Doe John'
    });
  });
  
  test('should extract name components if only full name is provided', () => {
    const person = {
      'ID': '12345',
      'Name': 'Doe John',
      'Status': 'Active'
    };
    
    const normalized = database.normalizePersonFields(person);
    
    // Check that the ID and Status were normalized
    expect(normalized.external_id).toBe('12345');
    expect(normalized.status).toBe('Active');
    
    // Check that the name was preserved
    expect(normalized.name).toBe('Doe John');
    
    // Check that first_name and last_name were extracted
    // Note: The exact behavior depends on the implementation
    expect(normalized.first_name).toBeDefined();
    expect(normalized.last_name).toBeDefined();
  });
  
  test('should preserve fields that do not have mappings', () => {
    const person = {
      'ID': '12345',
      'First Name': 'John',
      'Last Name': 'Doe',
      'Custom Field': 'Custom Value'
    };
    
    const normalized = database.normalizePersonFields(person);
    
    expect(normalized).toEqual({
      'external_id': '12345',
      'first_name': 'John',
      'last_name': 'Doe',
      'Custom Field': 'Custom Value',
      'name': 'Doe John'
    });
  });
});

// Clean up after all tests
afterAll(async () => {
  try {
    // Force close all connections
    await closeAllConnections(true);
    
    // Add a small delay to allow any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Delete the test database file if it exists
    const testDbPath = path.join(__dirname, 'data', 'test-people.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  
  // Clear any remaining timeouts
  jest.useRealTimers();
}, 2000); // Set a timeout of 2 seconds for the cleanup 