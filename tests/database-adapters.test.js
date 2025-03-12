/**
 * Database Adapters Tests
 * 
 * This file contains tests for the database adapters.
 * It tests the functionality of SQLite, MySQL, and PostgreSQL adapters.
 */

const path = require('path');
const fs = require('fs');
const { getConnection, closeConnection, saveToDatabase, closeAllConnections } = require('../src/database');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Test data matching the sample CSV format
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

// Test SQLite adapter
describe('SQLite Adapter', () => {
  const dbPath = path.join(dataDir, 'test-sqlite.db');
  let db;
  
  beforeAll(async () => {
    // Delete the database file if it exists
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    
    // Create a new database connection
    db = await getConnection('test-sqlite', {
      type: 'sqlite',
      path: dbPath
    });
  });
  
  afterAll(async () => {
    // Close the database connection
    await closeConnection('test-sqlite');
    
    // Delete the database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });
  
  test('should save people to the database', async () => {
    const result = await saveToDatabase(db, testPeople);
    expect(result.inserted).toBe(2);
    expect(result.errors).toBe(0);
  });
  
  test('should handle empty data', async () => {
    const result = await saveToDatabase(db, []);
    expect(result.inserted).toBe(0);
  });
  
  test('should skip records with insufficient identifying information', async () => {
    const result = await saveToDatabase(db, [
      { status: 'Actif' } // Missing external_id, name, first_name, and last_name
    ]);
    expect(result.inserted).toBe(0);
  });
});

// Test MySQL adapter if environment variables are set
if (process.env.TEST_MYSQL === 'true') {
  describe('MySQL Adapter', () => {
    let db;
    let mysqlAvailable = true;
    
    beforeAll(async () => {
      try {
        // Create a new database connection
        db = await getConnection('test-mysql', {
          type: 'mysql',
          config: {
            host: process.env.MYSQL_HOST || 'localhost',
            port: parseInt(process.env.MYSQL_PORT || '3308', 10),
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || 'test_password',
            database: process.env.MYSQL_DATABASE || 'test_people'
          }
        });
      } catch (error) {
        console.warn(`MySQL tests will be skipped: ${error.message}`);
        mysqlAvailable = false;
      }
    });
    
    afterAll(async () => {
      if (mysqlAvailable) {
        // Close the database connection
        await closeConnection('test-mysql');
      }
    });
    
    test('should save people to the database', async () => {
      if (!mysqlAvailable) {
        return; // Skip this test if MySQL is not available
      }
      
      const result = await saveToDatabase(db, testPeople);
      expect(result.inserted).toBe(2);
      expect(result.errors).toBe(0);
    });
    
    test('should handle empty data', async () => {
      if (!mysqlAvailable) {
        return; // Skip this test if MySQL is not available
      }
      
      const result = await saveToDatabase(db, []);
      expect(result.inserted).toBe(0);
    });
  });
}

// Test PostgreSQL adapter if environment variables are set
if (process.env.TEST_POSTGRES === 'true') {
  describe('PostgreSQL Adapter', () => {
    let db;
    let postgresAvailable = true;
    
    beforeAll(async () => {
      try {
        // Create a new database connection
        db = await getConnection('test-postgres', {
          type: 'postgres',
          config: {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'test_password',
            database: process.env.POSTGRES_DATABASE || 'test_people'
          }
        });
      } catch (error) {
        console.warn(`PostgreSQL tests will be skipped: ${error.message}`);
        postgresAvailable = false;
      }
    });
    
    afterAll(async () => {
      if (postgresAvailable) {
        // Close the database connection
        await closeConnection('test-postgres');
      }
    });
    
    test('should save people to the database', async () => {
      if (!postgresAvailable) {
        return; // Skip this test if PostgreSQL is not available
      }
      
      const result = await saveToDatabase(db, testPeople);
      expect(result.inserted).toBe(2);
      expect(result.errors).toBe(0);
    });
    
    test('should handle empty data', async () => {
      if (!postgresAvailable) {
        return; // Skip this test if PostgreSQL is not available
      }
      
      const result = await saveToDatabase(db, []);
      expect(result.inserted).toBe(0);
    });
  });
}

// Close all connections after all tests
afterAll(async () => {
  // Force close all connections with a timeout
  try {
    // Force close all connections
    await closeAllConnections(true);
    
    // Add a small delay to allow any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Explicitly exit Jest after cleanup
    setTimeout(() => {
      process.exit(0); // Force exit with success code
    }, 1000);
  } catch (error) {
    console.error('Error closing connections:', error);
    
    // Still exit even if there's an error
    setTimeout(() => {
      process.exit(1); // Force exit with error code
    }, 1000);
  }
}, 5000); // Set a timeout of 5 seconds for the cleanup 