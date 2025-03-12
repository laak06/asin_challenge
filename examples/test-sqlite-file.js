#!/usr/bin/env node

/**
 * Test SQLite Database with File Output
 * 
 * This script tests the SQLite database connection and performs basic operations.
 * The output is written to a file.
 */

const fs = require('fs');
const path = require('path');
const { getConnection, closeConnection, saveToDatabase } = require('../src/database');

async function main() {
  const logFile = path.join(__dirname, '..', 'sqlite-test-output.log');
  const log = (message) => {
    fs.appendFileSync(logFile, message + '\n');
    console.log(message);
  };

  try {
    // Clear the log file
    fs.writeFileSync(logFile, '');
    
    log('Testing SQLite database connection...');
    
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      log(`Created data directory: ${dataDir}`);
    }
    
    // Database options
    const dbOptions = { 
      type: 'sqlite',
      path: path.join(dataDir, 'test-sqlite.db')
    };
    
    log(`SQLite database path: ${dbOptions.path}`);
    
    // Connect to the database
    log('Connecting to SQLite database...');
    const db = await getConnection('test-sqlite', dbOptions);
    log('Connected to SQLite database');
    
    // Generate sample data
    const people = [];
    for (let i = 0; i < 10; i++) {
      people.push({
        external_id: `TEST-${i}`,
        name: `Test Person ${i}`,
        first_name: 'Test',
        last_name: `Person ${i}`,
        email: `test${i}@example.com`,
        birth_date: '01-01-2000',
        status: 'Active'
      });
    }
    
    // Save data to the database
    log('Saving data to SQLite database...');
    const result = await saveToDatabase(db, people);
    log(`Saved ${result.inserted} records to SQLite database`);
    
    // Close the database connection
    await closeConnection('test-sqlite');
    log('SQLite database connection closed');
    
    log('SQLite test completed successfully');
    log(`Check the log file for details: ${logFile}`);
  } catch (error) {
    fs.appendFileSync(logFile, `Error in SQLite test: ${error.stack || error}\n`);
    console.error('Error in SQLite test:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 