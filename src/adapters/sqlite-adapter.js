/**
 * SQLite Database Adapter
 * 
 * This module provides SQLite database functionality including:
 * - Initializing the database and creating tables
 * - Saving people data to the database
 * - Handling database transactions and error recovery
 */

const sqlite3 = require('sqlite3');
const path = require('path');
const { logger } = require('../logger');

/**
 * Initialize the SQLite database connection and create tables if they don't exist
 * 
 * @param {string} dbPath - Path to the SQLite database file
 * @returns {Promise<Object>} - Database connection object
 */
async function initializeDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    try {
      const finalDbPath = dbPath || process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'people.db');
      logger.info(`Initializing SQLite database at: ${finalDbPath}`);
      
      // Create a new database connection
      const db = new sqlite3.Database(finalDbPath, (err) => {
        if (err) {
          logger.error('Error connecting to SQLite database', { error: err.message });
          return reject(new Error(`Failed to connect to SQLite database: ${err.message}`));
        }
        
        logger.info('Connected to the SQLite database');
        
        // Check if the people table exists
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='people'", (err, row) => {
          if (err) {
            logger.error('Error checking if table exists', { error: err.message });
            return reject(new Error(`Failed to check if table exists: ${err.message}`));
          }
          
          if (row) {
            // Table exists, check if we need to add new columns
            logger.info('People table already exists, checking for schema updates');
            
            // Get the current table schema
            db.all("PRAGMA table_info(people)", (err, columns) => {
              if (err) {
                logger.error('Error getting table schema', { error: err.message });
                return reject(new Error(`Failed to get table schema: ${err.message}`));
              }
              
              // Check which columns we need to add
              const existingColumns = columns.map(col => col.name);
              const requiredColumns = [
                'external_id', 'first_name', 'last_name', 'birth_date', 'status', 'created_at', 'additional_data'
              ];
              
              const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
              
              if (missingColumns.length === 0) {
                logger.info('Table schema is up to date');
                return resolve(db);
              }
              
              logger.info(`Adding ${missingColumns.length} missing columns to people table`);
              
              // Add each missing column
              const addColumnPromises = missingColumns.map(column => {
                return new Promise((resolveColumn, rejectColumn) => {
                  let type = 'TEXT';
                  if (column === 'created_at') {
                    type = 'TEXT DEFAULT CURRENT_TIMESTAMP';
                  }
                  
                  const sql = `ALTER TABLE people ADD COLUMN ${column} ${type}`;
                  db.run(sql, (err) => {
                    if (err) {
                      logger.error(`Error adding column ${column}`, { error: err.message });
                      return rejectColumn(err);
                    }
                    logger.info(`Added column ${column} to people table`);
                    resolveColumn();
                  });
                });
              });
              
              // Execute all column additions
              Promise.all(addColumnPromises)
                .then(() => {
                  logger.info('Table schema updated successfully');
                  resolve(db);
                })
                .catch(err => {
                  logger.error('Error updating table schema', { error: err.message });
                  reject(new Error(`Failed to update table schema: ${err.message}`));
                });
            });
          } else {
            // Table doesn't exist, create it
            logger.info('Creating people table');
            
            db.run(`
              CREATE TABLE IF NOT EXISTS people (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                external_id TEXT,
                first_name TEXT,
                last_name TEXT,
                birth_date TEXT,
                status TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                additional_data TEXT
              )
            `, (err) => {
              if (err) {
                logger.error('Error creating people table', { error: err.message });
                return reject(new Error(`Failed to create people table: ${err.message}`));
              }
              
              logger.info('SQLite database initialized successfully');
              resolve(db);
            });
          }
        });
      });
    } catch (error) {
      logger.error('Unexpected error initializing SQLite database', { error: error.message });
      reject(new Error(`Failed to initialize SQLite database: ${error.message}`));
    }
  });
}

/**
 * Save people data to the SQLite database
 * 
 * @param {Object} db - SQLite database connection object
 * @param {Array} people - Array of people objects to save
 * @returns {Promise<Object>} - Result of the save operation
 */
async function saveToDatabase(db, people) {
  return new Promise((resolve, reject) => {
    try {
      if (!Array.isArray(people) || people.length === 0) {
        logger.warn('No people data to save');
        return resolve({ inserted: 0 });
      }
      
      logger.info(`Preparing to save ${people.length} records to SQLite database`);
      
      // Start a transaction
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Prepare the insert statement
        const stmt = db.prepare(`
          INSERT INTO people (
            external_id, first_name, last_name, birth_date, status, additional_data
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        let inserted = 0;
        let errors = 0;
        
        // Insert each person
        people.forEach((person) => {
          try {
            // Extract known fields
            const {
              external_id,
              first_name,
              last_name,
              birth_date,
              status,
              ...additionalData
            } = person;
            
            // Skip records that don't have enough identifying information
            if (!birth_date && !external_id && !(first_name && last_name)) {
              logger.warn('Skipping record with insufficient identifying information');
              logger.info(person);
              return;
            }
            
            // Store any additional fields as JSON
            const additionalDataJson = Object.keys(additionalData).length > 0 
              ? JSON.stringify(additionalData) 
              : null;
            
            // Execute the insert
            stmt.run(
              external_id || '',
              first_name || '',
              last_name || '',
              birth_date || '',
              status || '',
              additionalDataJson,
              function(err) {
                if (err) {
                  logger.error('Error inserting record', { 
                    error: err.message, 
                    person: JSON.stringify(person)
                  });
                  errors++;
                } else {
                  inserted++;
                }
              }
            );
          } catch (error) {
            logger.error('Error processing record for insert', { 
              error: error.message,
              person: JSON.stringify(person)
            });
            errors++;
          }
        });
        
        // Finalize the statement
        stmt.finalize();
        
        // Commit the transaction
        db.run('COMMIT', function(err) {
          if (err) {
            logger.error('Error committing transaction', { error: err.message });
            db.run('ROLLBACK');
            return reject(new Error(`Failed to commit transaction: ${err.message}`));
          }
          
          logger.info(`Successfully saved ${inserted} records to SQLite database (${errors} errors)`);
          resolve({ inserted, errors });
        });
      });
    } catch (error) {
      logger.error('Unexpected error saving to SQLite database', { error: error.message });
      db.run('ROLLBACK');
      reject(new Error(`Failed to save to SQLite database: ${error.message}`));
    }
  });
}

/**
 * Close the SQLite database connection
 * 
 * @param {Object} db - SQLite database connection object
 * @returns {Promise<void>}
 */
async function closeDatabase(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        logger.error('Error closing SQLite database connection', { error: err.message });
        return reject(new Error(`Failed to close SQLite database connection: ${err.message}`));
      }
      
      logger.info('SQLite database connection closed');
      resolve();
    });
  });
}

module.exports = {
  initializeDatabase,
  saveToDatabase,
  closeDatabase
}; 