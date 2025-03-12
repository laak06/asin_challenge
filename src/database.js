/**
 * Database Module
 * 
 * This module is responsible for database operations including:
 * - Initializing the database and creating tables
 * - Saving people data to the database
 * - Handling database transactions and error recovery
 * - Supporting multiple database connections and types
 */

const path = require('path');
const { logger } = require('./logger');
const sqliteAdapter = require('./adapters/sqlite-adapter');
const mysqlAdapter = require('./adapters/mysql-adapter');
const postgresAdapter = require('./adapters/postgres-adapter');

// Store active database connections
const activeConnections = new Map();

/**
 * Get a database adapter based on the database type
 * 
 * @param {string} dbType - Database type ('sqlite', 'mysql', or 'postgres')
 * @returns {Object} - Database adapter
 */
function getAdapter(dbType) {
  switch (dbType?.toLowerCase()) {
    case 'mysql':
      return mysqlAdapter;
    case 'postgres':
    case 'postgresql':
      return postgresAdapter;
    case 'sqlite':
    default:
      return sqliteAdapter;
  }
}

/**
 * Get a database connection by ID or create a new one
 * 
 * @param {string} connectionId - Optional connection ID (defaults to 'default')
 * @param {Object} options - Database connection options
 * @param {string} options.type - Database type ('sqlite', 'mysql', or 'postgres')
 * @param {string} options.path - Path to SQLite database file (for SQLite only)
 * @param {Object} options.config - Database connection config (for MySQL and PostgreSQL)
 * @returns {Promise<Object>} - Database connection object with adapter methods
 */
async function getConnection(connectionId = 'default', options = {}) {
  // If we already have an active connection with this ID, return it
  if (activeConnections.has(connectionId)) {
    logger.info(`Reusing existing database connection: ${connectionId}`);
    return activeConnections.get(connectionId);
  }
  
  // Determine database type
  const dbType = options.type || process.env.DB_TYPE || 'sqlite';
  logger.info(`Creating new ${dbType} database connection: ${connectionId}`);
  
  // Get the appropriate adapter
  const adapter = getAdapter(dbType);
  
  // Initialize the database connection
  let connection;
  
  if (dbType === 'mysql') {
    // For MySQL, we need a config object
    const config = options.config || {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3308', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'people'
    };
    
    connection = await adapter.initializeDatabase(config);
  } else if (dbType === 'postgres' || dbType === 'postgresql') {
    // For PostgreSQL, we need a config object
    const config = options.config || {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'test_password',
      database: process.env.POSTGRES_DATABASE || 'people',
      poolSize: options.poolSize || process.env.POSTGRES_POOL_SIZE || 10
    };
    
    connection = await adapter.initializeDatabase(config);
  } else {
    // For SQLite, we just need a path
    const dbPath = options.path || process.env.DB_PATH;
    connection = await adapter.initializeDatabase(dbPath);
  }
  
  // Create a connection object that includes the adapter methods
  const connectionObject = {
    connection,
    adapter,
    type: dbType,
    
    // Add adapter methods directly to the connection object
    async saveToDatabase(people) {
      return adapter.saveToDatabase(connection, people);
    },
    
    async close() {
      return adapter.closeDatabase(connection);
    }
  };
  
  // Store the connection
  activeConnections.set(connectionId, connectionObject);
  
  return connectionObject;
}

/**
 * Close a specific database connection
 * 
 * @param {string} connectionId - Connection ID to close (defaults to 'default')
 * @param {boolean} forceClose - Whether to force close the connection (for PostgreSQL, this closes the pool)
 * @returns {Promise<void>}
 */
async function closeConnection(connectionId = 'default', forceClose = false) {
  if (activeConnections.has(connectionId)) {
    const connectionObject = activeConnections.get(connectionId);
    
    // For PostgreSQL, we need to pass the forceClose parameter
    if (connectionObject.type === 'postgres' || connectionObject.type === 'postgresql') {
      await connectionObject.adapter.closeDatabase(connectionObject.connection, forceClose);
    } else {
      await connectionObject.close();
    }
    
    activeConnections.delete(connectionId);
    logger.info(`Closed database connection: ${connectionId}`);
  }
}

/**
 * Close all active database connections
 * 
 * @param {boolean} forceClose - Whether to force close all connections
 * @returns {Promise<void>}
 */
async function closeAllConnections(forceClose = true) {
  const closePromises = [];
  
  // First, try to close each connection individually
  for (const [connectionId, connectionObject] of activeConnections.entries()) {
    try {
      // For PostgreSQL, we need to pass the forceClose parameter
      if (connectionObject.type === 'postgres' || connectionObject.type === 'postgresql') {
        closePromises.push(
          connectionObject.adapter.closeDatabase(connectionObject.connection, forceClose)
            .then(() => {
              logger.info(`Closed database connection: ${connectionId}`);
            })
            .catch(err => {
              logger.error(`Error closing database connection: ${connectionId}`, { error: err.message });
            })
        );
      } else {
        closePromises.push(
          connectionObject.close()
            .then(() => {
              logger.info(`Closed database connection: ${connectionId}`);
            })
            .catch(err => {
              logger.error(`Error closing database connection: ${connectionId}`, { error: err.message });
            })
        );
      }
    } catch (error) {
      logger.error(`Error initiating close for connection: ${connectionId}`, { error: error.message });
    }
  }
  
  // Wait for all close operations to complete
  try {
    await Promise.allSettled(closePromises);
  } catch (error) {
    logger.error('Error closing some database connections', { error: error.message });
  }
  
  // Clear the active connections map
  activeConnections.clear();
  
  // Close all PostgreSQL connection pools
  if (postgresAdapter.closeAllPools) {
    try {
      await postgresAdapter.closeAllPools();
    } catch (error) {
      logger.error('Error closing PostgreSQL connection pools', { error: error.message });
    }
  }
  
  // Forcefully terminate all PostgreSQL connection pools if requested
  if (forceClose && postgresAdapter.terminateAllPools) {
    try {
      await postgresAdapter.terminateAllPools();
    } catch (error) {
      logger.error('Error terminating PostgreSQL connection pools', { error: error.message });
    }
  }
  
  // Close any MySQL connections that might still be open
  if (forceClose && mysqlAdapter.closeAllConnections) {
    try {
      await mysqlAdapter.closeAllConnections();
    } catch (error) {
      logger.error('Error closing MySQL connections', { error: error.message });
    }
  }
  
  logger.info('All database connections closed');
}

/**
 * Save people data to the database
 * 
 * @param {Object} db - Database connection object
 * @param {Array} people - Array of people objects to save
 * @returns {Promise<Object>} - Result of the save operation
 */
async function saveToDatabase(db, people) {
  // Normalize field names for all people
  const normalizedPeople = people.map(normalizePersonFields);
  
  if (db.saveToDatabase) {
    return db.saveToDatabase(normalizedPeople);
  }
  
  // Fallback for backward compatibility
  const adapter = db.adapter || sqliteAdapter;
  return adapter.saveToDatabase(db.connection || db, normalizedPeople);
}

/**
 * Normalize person field names to ensure consistency
 * 
 * @param {Object} person - Person object with potentially inconsistent field names
 * @returns {Object} - Person object with normalized field names
 */
function normalizePersonFields(person) {
  const normalized = { ...person };
  
  // Map of common field name variations to standardized names
  const fieldMappings = {
    // External ID variations
    'id': 'external_id',
    'ID': 'external_id',
    'identifier': 'external_id',
    'Identifier': 'external_id',
    'External ID': 'external_id',
    'External Id': 'external_id',
    'EXTERNAL_ID': 'external_id',
    
    // Name variations
    'Name': 'name',
    'NAME': 'name',
    
    // First name variations
    'First Name': 'first_name',
    'FirstName': 'first_name',
    'firstname': 'first_name',
    'firstName': 'first_name',
    'FIRST_NAME': 'first_name',
    'prenom': 'first_name',
    
    // Last name variations
    'Last Name': 'last_name',
    'LastName': 'last_name',
    'lastname': 'last_name',
    'lastName': 'last_name',
    'LAST_NAME': 'last_name',
    'nom': 'last_name',
    
    // Birth date variations
    'Birth Date': 'birth_date',
    'BirthDate': 'birth_date',
    'birthdate': 'birth_date',
    'birthDate': 'birth_date',
    'BIRTH_DATE': 'birth_date',
    'date_of_birth': 'birth_date',
    'Date of Birth': 'birth_date',
    'DOB': 'birth_date',
    
    // Status variations
    'Status': 'status',
    'STATUS': 'status',
    'statut': 'status'
  };
  
  // Apply mappings
  Object.entries(person).forEach(([key, value]) => {
    // If this key has a mapping, use the standardized field name
    if (fieldMappings[key]) {
      normalized[fieldMappings[key]] = value;
      // Only delete the original key if it's different from the mapped key
      if (key !== fieldMappings[key]) {
        delete normalized[key];
      }
    }
  });
  
  // Handle special case: if we have name but not first_name and last_name
  if (normalized.name && (!normalized.first_name || !normalized.last_name)) {
    const nameParts = normalized.name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      if (!normalized.last_name) {
        normalized.last_name = nameParts[0];
      }
      if (!normalized.first_name) {
        normalized.first_name = nameParts.slice(1).join(' ');
      }
    }
  }
  
  // Handle special case: if we have first_name and last_name but not name
  if (!normalized.name && normalized.first_name && normalized.last_name) {
    normalized.name = `${normalized.last_name} ${normalized.first_name}`.trim();
  }
  
  return normalized;
}

module.exports = {
  getConnection,
  closeConnection,
  closeAllConnections,
  saveToDatabase,
  normalizePersonFields // Export for testing
}; 