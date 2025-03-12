#!/usr/bin/env node

/**
 * Test SQLite Database
 * 
 * This script tests the SQLite database connection and performs basic operations.
 */

const { getConnection, closeConnection, saveToDatabase } = require('../src/database');

async function main() {
  try {
    console.log('Testing SQLite database connection...');
    
    // Database options
    const dbOptions = { 
      type: 'sqlite',
      path: './data/test-sqlite.db'
    };
    
    // Connect to the database
    console.log('Connecting to SQLite database...');
    const db = await getConnection('test-sqlite', dbOptions);
    console.log('Connected to SQLite database');
    
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
    console.log('Saving data to SQLite database...');
    const result = await saveToDatabase(db, people);
    console.log(`Saved ${result.inserted} records to SQLite database`);
    
    // Close the database connection
    await closeConnection('test-sqlite');
    console.log('SQLite database connection closed');
    
    console.log('SQLite test completed successfully');
  } catch (error) {
    console.error('Error in SQLite test:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 