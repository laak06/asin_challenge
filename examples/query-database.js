#!/usr/bin/env node

/**
 * Query Database
 * 
 * This script queries the database to verify the data was imported correctly.
 * Supports SQLite, MySQL, and PostgreSQL databases.
 * 
 * Usage: node examples/query-database.js [limit] [offset] [options]
 * 
 * Options:
 * --db-type=<type>       Specify database type (sqlite, mysql, or postgres)
 * --db-path=<path>       Specify a custom database path (for SQLite)
 * 
 * MySQL Options:
 * --mysql-host=<host>    MySQL host (default: localhost)
 * --mysql-port=<port>    MySQL port (default: 3308)
 * --mysql-user=<user>    MySQL user (default: mysql)
 * --mysql-password=<pwd> MySQL password
 * --mysql-database=<db>  MySQL database name (default: people)
 * 
 * PostgreSQL Options:
 * --pg-host=<host>       PostgreSQL host (default: localhost)
 * --pg-port=<port>       PostgreSQL port (default: 5432)
 * --pg-user=<user>       PostgreSQL user (default: postgres)
 * --pg-password=<pwd>    PostgreSQL password (default: postgres)
 * --pg-database=<db>     PostgreSQL database name (default: people)
 */

const sqlite3 = require('sqlite3');
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

/**
 * Parse command line arguments
 * 
 * @returns {Object} - Parsed command line arguments
 */
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      args[key] = value || true;
    } else if (!isNaN(parseInt(arg, 10))) {
      // Store positional arguments as numbers
      if (!args.positional) {
        args.positional = [];
      }
      args.positional.push(parseInt(arg, 10));
    }
  });
  return args;
}

// Parse arguments
const args = parseArgs();
const limit = args.positional?.[0] || 10;
const offset = args.positional?.[1] || 0;

// Determine database type
const dbType = args['db-type'] || process.env.DB_TYPE || 'sqlite';

async function main() {
  try {
    if (dbType === 'mysql') {
      await queryMySql();
    } else if (dbType === 'postgres' || dbType === 'postgresql') {
      await queryPostgres();
    } else {
      await querySqlite();
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function querySqlite() {
  // Get the database path
  const dbPath = args['db-path'] || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'people.db');
  console.log(`Querying SQLite database at: ${dbPath}`);
  
  return new Promise((resolve, reject) => {
    // Open the database
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        return reject(new Error(`Error opening database: ${err.message}`));
      }
      
      console.log('Connected to the database');
      
      // Get the total number of records
      db.get('SELECT COUNT(*) as count FROM people', (err, row) => {
        if (err) {
          return reject(new Error(`Error counting records: ${err.message}`));
        }
        
        console.log(`Total records in database: ${row.count}`);
        
        // Query the records with offset
        db.all(`SELECT * FROM people LIMIT ${limit} OFFSET ${offset}`, (err, rows) => {
          if (err) {
            return reject(new Error(`Error querying records: ${err.message}`));
          }
          
          displayResults(rows);
          
          // Close the database
          db.close((err) => {
            if (err) {
              return reject(new Error(`Error closing database: ${err.message}`));
            }
            
            console.log('\nDatabase connection closed');
            resolve();
          });
        });
      });
    });
  });
}

async function queryMySql() {
  // MySQL connection config
  const config = {
    host: args['mysql-host'] || process.env.MYSQL_HOST || 'localhost',
    port: parseInt(args['mysql-port'] || process.env.MYSQL_PORT || '3308', 10),
    user: args['mysql-user'] || process.env.MYSQL_USER || 'mysql',
    password: args['mysql-password'] || process.env.MYSQL_PASSWORD || '',
    database: args['mysql-database'] || process.env.MYSQL_DATABASE || 'people'
  };
  
  console.log(`Querying MySQL database at: ${config.host}:${config.port}/${config.database}`);
  
  try {
    // Create a connection
    const connection = await mysql.createConnection(config);
    console.log('Connected to the database');
    
    // Get the total number of records
    const [countRows] = await connection.execute('SELECT COUNT(*) as count FROM people');
    console.log(`Total records in database: ${countRows[0].count}`);
    
    // Query the records with offset
    const [rows] = await connection.execute(`SELECT * FROM people LIMIT ${offset}, ${limit}`);
    
    displayResults(rows);
    
    // Close the connection
    await connection.end();
    console.log('\nDatabase connection closed');
  } catch (error) {
    throw new Error(`MySQL error: ${error.message}`);
  }
}

async function queryPostgres() {
  // PostgreSQL connection config
  const config = {
    host: args['pg-host'] || process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(args['pg-port'] || process.env.POSTGRES_PORT || '5432', 10),
    user: args['pg-user'] || process.env.POSTGRES_USER || 'postgres',
    password: args['pg-password'] || process.env.POSTGRES_PASSWORD || 'postgres',
    database: args['pg-database'] || process.env.POSTGRES_DATABASE || 'people'
  };
  
  console.log(`Querying PostgreSQL database at: ${config.host}:${config.port}/${config.database}`);
  
  try {
    // Create a connection pool
    const pool = new Pool(config);
    console.log('Connected to the database');
    
    // Get a client from the pool
    const client = await pool.connect();
    
    try {
      // Get the total number of records
      const countResult = await client.query('SELECT COUNT(*) as count FROM people');
      console.log(`Total records in database: ${countResult.rows[0].count}`);
      
      // Query the records with offset
      const result = await client.query(`SELECT * FROM people LIMIT ${limit} OFFSET ${offset}`);
      
      displayResults(result.rows);
    } finally {
      // Release the client back to the pool
      client.release();
    }
    
    // Close the pool
    await pool.end();
    console.log('\nDatabase connection closed');
  } catch (error) {
    throw new Error(`PostgreSQL error: ${error.message}`);
  }
}

function displayResults(rows) {
  console.log(`Records ${offset+1} to ${offset+rows.length}:`);
  
  rows.forEach((row, i) => {
    console.log(`\nRecord #${offset + i + 1}:`);
    
    // Display basic fields
    for (const key of Object.keys(row)) {
      // Skip null values, empty values, and additional_data (handled separately)
      if (row[key] !== null && row[key] !== '' && key !== 'additional_data' && key !== 'id') {
        console.log(`  ${key}: ${row[key]}`);
      }
    }
    
    // Parse and display additional data if it exists
    if (row.additional_data) {
      try {
        const additionalData = typeof row.additional_data === 'string' 
          ? JSON.parse(row.additional_data) 
          : row.additional_data;
          
        console.log('  Additional Data:');
        Object.keys(additionalData).forEach(key => {
          if (additionalData[key] !== null && additionalData[key] !== '') {
            console.log(`    ${key}: ${additionalData[key]}`);
          }
        });
      } catch (e) {
        console.log(`  Additional Data: ${row.additional_data}`);
      }
    }
  });
}

// Run the main function
main(); 