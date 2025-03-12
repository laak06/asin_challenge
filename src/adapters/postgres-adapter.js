/**
 * PostgreSQL Database Adapter
 * 
 * This module provides PostgreSQL database functionality including:
 * - Initializing the database and creating tables
 * - Saving people data to the database
 * - Handling database transactions and error recovery
 */

const { Pool } = require('pg');
const { logger } = require('../logger');

// Store connection pools to reuse them
const pools = new Map();

/**
 * Initialize the PostgreSQL database connection and create tables if they don't exist
 * 
 * @param {Object} config - PostgreSQL connection configuration
 * @returns {Promise<Object>} - Database connection object
 */
async function initializeDatabase(config) {
  try {
    const password = config.password || 'test_password';
    const port = config.port || 5433;
    const connectionString = config.connectionString || 
      `postgresql://${config.user}:${password}@${config.host}:${port}/${config.database}`;
    
    logger.info(`Initializing PostgreSQL database at: ${config.host}:${config.port}/${config.database}`);
    
    // Create or reuse a connection pool
    let pool;
    if (pools.has(connectionString)) {
      pool = pools.get(connectionString);
      logger.info('Reusing existing PostgreSQL connection pool');
    } else {
      pool = new Pool({
        connectionString,
        max: config.poolSize || 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      pools.set(connectionString, pool);
      logger.info('Created new PostgreSQL connection pool');
    }
    
    // Get a client from the pool
    const client = await pool.connect();
    
    try {
      // Create the people table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS people (
          id SERIAL PRIMARY KEY,
          external_id VARCHAR(255),
          first_name VARCHAR(255),
          last_name VARCHAR(255),
          birth_date VARCHAR(50),
          status VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          additional_data JSONB
        )
      `);
      
      logger.info('PostgreSQL database initialized successfully');
      
      // Return the client and pool for later use
      return { client, pool };
    } catch (error) {
      client.release();
      throw error;
    }
  } catch (error) {
    logger.error('Error initializing PostgreSQL database', { error: error.message });
    logger.error(error);
    throw new Error(`Failed to initialize PostgreSQL database: ${error.message}`);
  }
}

/**
 * Save people data to the PostgreSQL database
 * 
 * @param {Object} connection - PostgreSQL connection object { client, pool }
 * @param {Array} people - Array of people objects to save
 * @returns {Promise<Object>} - Result of the save operation
 */
async function saveToDatabase(connection, people) {
  const { client, pool } = connection;
  
  try {
    if (!Array.isArray(people) || people.length === 0) {
      logger.warn('No people data to save');
      return { inserted: 0 };
    }
    
    logger.info(`Preparing to save ${people.length} records to PostgreSQL database`);
    
    // Start a transaction
    await client.query('BEGIN');
    
    let inserted = 0;
    let errors = 0;
    
    // Prepare the insert statement
    const insertQuery = `
      INSERT INTO people (
        external_id, first_name, last_name, birth_date, status, additional_data
      ) VALUES ($1, $2, $3, $4, $5, $6)
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
          await client.query(insertQuery, [
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
    await client.query('COMMIT');
    
    logger.info(`Successfully saved ${inserted} records to PostgreSQL database (${errors} errors)`);
    return { inserted, errors };
  } catch (error) {
    logger.error('Error saving to PostgreSQL database', { error: error.message });
    
    // Rollback the transaction
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Error rolling back transaction', { error: rollbackError.message });
    }
    
    throw new Error(`Failed to save to PostgreSQL database: ${error.message}`);
  }
}

/**
 * Close the database connection
 * 
 * @param {Object} db - Database connection
 * @param {boolean} forceClose - Whether to force close the connection
 * @returns {Promise<void>}
 */
async function closeDatabase(db, forceClose = false) {
  try {
    if (!db) {
      logger.warn('No PostgreSQL connection to close');
      return;
    }

    // If we have a client, end it
    if (db.client) {
      try {
        await db.client.end();
        logger.info('PostgreSQL client connection closed');
      } catch (error) {
        logger.error('Error closing PostgreSQL client connection', { error: error.message });
      }
    }

    // If we have a pool and forceClose is true, end the pool
    if (db.pool && forceClose) {
      try {
        await db.pool.end();
        logger.info('PostgreSQL connection pool closed');
      } catch (error) {
        logger.error('Error closing PostgreSQL connection pool', { error: error.message });
      }
    }

    logger.info('PostgreSQL database connection closed');
  } catch (error) {
    logger.error('Error closing PostgreSQL database connection', { error: error.message });
    // Don't rethrow to ensure cleanup continues
  }
}

/**
 * Close all PostgreSQL connection pools
 * 
 * @returns {Promise<void>}
 */
async function closeAllPools() {
  try {
    // Get all pools from pg module
    const { pools } = require('pg');
    
    if (!pools || pools.length === 0) {
      logger.info('No PostgreSQL connection pools to close');
      return;
    }
    
    // End all pools
    const closePromises = [];
    for (const pool of pools) {
      if (pool && typeof pool.end === 'function') {
        closePromises.push(pool.end());
      }
    }
    
    await Promise.all(closePromises);
    logger.info('All PostgreSQL connection pools closed');
  } catch (error) {
    logger.error('Error closing PostgreSQL connection pools', { error: error.message });
    // Don't rethrow to ensure cleanup continues
  }
}

/**
 * Terminate all PostgreSQL connection pools
 * 
 * @returns {Promise<void>}
 */
async function terminateAllPools() {
  try {
    // Get pg module
    const pg = require('pg');
    
    // Clear all pools
    if (pg.pools) {
      pg.pools.clear();
    }
    
    logger.info('All PostgreSQL connection pools terminated');
  } catch (error) {
    logger.error('Error terminating PostgreSQL connection pools', { error: error.message });
    // Don't rethrow to ensure cleanup continues
  }
}

module.exports = {
  initializeDatabase,
  saveToDatabase,
  closeDatabase,
  closeAllPools,
  terminateAllPools
}; 