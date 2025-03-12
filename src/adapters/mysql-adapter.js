/**
 * MySQL Database Adapter
 * 
 * This module provides MySQL database functionality including:
 * - Initializing the database and creating tables
 * - Saving people data to the database
 * - Handling database transactions and error recovery
 */

const mysql = require('mysql2/promise');
const { logger } = require('../logger');

/**
 * Initialize the MySQL database connection and create tables if they don't exist
 * 
 * @param {Object} config - MySQL connection configuration
 * @returns {Promise<Object>} - Database connection object
 */
async function initializeDatabase(config) {
  try {
    logger.info(`Initializing MySQL database at: ${config.host}:${config.port}/${config.database}`);
    

    logger.info('Connecting to the MySQL database');

    // Create a connection to the MySQL server
    const connection = await mysql.createConnection({
      host: config.host || 'localhost',
      port: config.port || 3308,
      user: config.user || 'root',
      password: config.password || 'test_password',
      database: config.database,
      multipleStatements: true,
      authPlugins: {
        mysql_native_password: () => ({ default: true })
      }
    });
    
    
    // Create the people table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS people (
        id INT AUTO_INCREMENT PRIMARY KEY,
        external_id VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        birth_date VARCHAR(50),
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        additional_data JSON
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    
    logger.info('MySQL database initialized successfully');
    return connection;
  } catch (error) {
    logger.error('Error initializing MySQL database', { error: error.message });
    console.log(error);
    throw new Error(`Failed to initialize MySQL database: ${error.message}`);
  }
}

/**
 * Save people data to the MySQL database
 * 
 * @param {Object} connection - MySQL connection object
 * @param {Array} people - Array of people objects to save
 * @returns {Promise<Object>} - Result of the save operation
 */
async function saveToDatabase(connection, people) {
  try {
    if (!Array.isArray(people) || people.length === 0) {
      logger.warn('No people data to save');
      return { inserted: 0 };
    }
    
    logger.info(`Preparing to save ${people.length} records to MySQL database`);
    
    // Start a transaction
    await connection.beginTransaction();
    
    let inserted = 0;
    let errors = 0;
    
    // Prepare the insert statement
    const stmt = `
      INSERT INTO people (
        external_id, first_name, last_name, birth_date, status, additional_data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    // Process each person in batches
    const batchSize = 100;
    for (let i = 0; i < people.length; i += batchSize) {
      const batch = people.slice(i, i + batchSize);
      const promises = batch.map(async (person) => {
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
          const [result] = await connection.execute(stmt, [
            external_id || '',
            first_name || '',
            last_name || '',
            birth_date || '',
            status || '',
            additionalDataJson
          ]);
          
          inserted++;
        } catch (error) {
          logger.error('Error inserting record', { 
            error: error.message, 
            person: JSON.stringify(person)
          });
          errors++;
        }
      });
      
      await Promise.all(promises);
    }
    
    // Commit the transaction
    await connection.commit();
    
    logger.info(`Successfully saved ${inserted} records to MySQL database (${errors} errors)`);
    return { inserted, errors };
  } catch (error) {
    logger.error('Error saving to MySQL database', { error: error.message });
    
    // Rollback the transaction
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.error('Error rolling back transaction', { error: rollbackError.message });
    }
    
    throw new Error(`Failed to save to MySQL database: ${error.message}`);
  }
}

/**
 * Close the MySQL database connection
 * 
 * @param {Object} connection - MySQL connection object
 * @returns {Promise<void>}
 */
async function closeDatabase(connection) {
  try {
    await connection.end();
    logger.info('MySQL database connection closed');
  } catch (error) {
    logger.error('Error closing MySQL database connection', { error: error.message });
    throw new Error(`Failed to close MySQL database connection: ${error.message}`);
  }
}

/**
 * Close all MySQL connections
 * 
 * @returns {Promise<void>}
 */
async function closeAllConnections() {
  try {
    // Get mysql2 module
    const mysql = require('mysql2/promise');
    
    // If there's a way to access all connections, close them
    if (mysql.connections && Array.isArray(mysql.connections)) {
      for (const connection of mysql.connections) {
        try {
          if (connection && typeof connection.end === 'function') {
            await connection.end();
          }
        } catch (error) {
          logger.error('Error closing MySQL connection', { error: error.message });
        }
      }
    }
    
    logger.info('All MySQL connections closed');
  } catch (error) {
    logger.error('Error closing all MySQL connections', { error: error.message });
    // Don't rethrow to ensure cleanup continues
  }
}

module.exports = {
  initializeDatabase,
  saveToDatabase,
  closeDatabase,
  closeAllConnections
}; 