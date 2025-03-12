#!/usr/bin/env node

/**
 * Excel to Database CLI Application
 * 
 * This application reads an Excel file and saves the data to a database.
 * It is designed to be used in a Unix-like environment.
 * 
 * Usage: node src/index.js /path/to/file.xlsx
 * 
 * Options:
 * --db-path=<path>       Specify a custom database path (for SQLite)
 * --db-type=<type>       Specify database type (sqlite, mysql, or postgres)
 * --connection-id=<id>   Specify a connection ID (for multiple connections)
 * --chunk-size=<size>    Number of records to process at once (default: 100000)
 * --use-streaming        Force use of streaming mode for Excel parsing
 * --stream               Alias for --use-streaming
 * --stream-threshold=<mb> File size threshold in MB to use streaming (default: 10)
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
 * --pg-pool-size=<size>  PostgreSQL connection pool size (default: 10)
 * 
 * Performance Options:
 * --measure-performance  Measure and output performance metrics
 * --batch-size=<size>    Batch size for database operations (default: 100)
 */

const fs = require('fs');
const path = require('path');
const { parseExcel } = require('./excel-parser');
const { getConnection, closeConnection, saveToDatabase } = require('./database');
const { logger } = require('./logger');

// Load environment variables
require('dotenv').config();

/**
 * Parse command line arguments
 * 
 * @returns {Object} - Parsed command line arguments
 */
function parseArgs() {
  const args = {};
  const positionalArgs = [];
  
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      args[key] = value || true;
    } else {
      positionalArgs.push(arg);
    }
  });
  
  return { args, positionalArgs };
}

/**
 * Measure performance of a function
 * 
 * @param {Function} fn - Function to measure
 * @param {string} label - Label for logging
 * @param {...any} args - Arguments to pass to the function
 * @returns {Promise<Object>} - Result of the function and performance metrics
 */
async function measurePerformance(fn, label, ...args) {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  
  const result = await fn(...args);
  
  const endTime = process.hrtime.bigint();
  const endMemory = process.memoryUsage();
  
  const duration = Number(endTime - startTime) / 1e6; // Convert to milliseconds
  const memoryDiff = {
    rss: (endMemory.rss - startMemory.rss) / (1024 * 1024), // MB
    heapTotal: (endMemory.heapTotal - startMemory.heapTotal) / (1024 * 1024), // MB
    heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / (1024 * 1024), // MB
    external: (endMemory.external - startMemory.external) / (1024 * 1024) // MB
  };
  
  return {
    result,
    performance: {
      operation: label,
      duration: duration,
      durationSeconds: duration / 1000,
      memory: memoryDiff
    }
  };
}

/**
 * Process an Excel file and save the data to the database
 * 
 * @param {string} filePath - Path to the Excel file
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Result of the save operation
 */
async function processExcelFile(filePath, options = {}) {
  try {
    logger.info(`Processing Excel file: ${filePath}`);
    
    // Check file size to determine if we should use streaming
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    const streamThreshold = options.streamThreshold || 10; // Default to 10MB
    
    // Use streaming if explicitly requested or if file is larger than threshold
    const useStreaming = options.useStreaming || fileSizeMB > streamThreshold;
    
    logger.info(`File size: ${fileSizeMB.toFixed(2)} MB, ${useStreaming ? 'using' : 'not using'} streaming mode`);
    
    // Parse the Excel file
    const people = await parseExcel(filePath, { 
      useStreaming, 
      chunkSize: options.chunkSize || 100000 
    });
    
    // Get a database connection
    const db = await getConnection(options.connectionId, options.dbOptions);
    
    // Process data in chunks if needed
    const chunkSize = options.chunkSize || 100000;
    let totalInserted = 0;
    let totalErrors = 0;
    
    // If the data is small enough, process it all at once
    if (people.length <= chunkSize) {
      const result = await saveToDatabase(db, people);
      totalInserted = result.inserted;
      totalErrors = result.errors;
    } else {
      // Process in chunks to avoid memory issues
      logger.info(`Processing ${people.length} records in chunks of ${chunkSize}`);
      
      for (let i = 0; i < people.length; i += chunkSize) {
        const chunk = people.slice(i, i + chunkSize);
        logger.info(`Processing chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(people.length / chunkSize)} (${chunk.length} records)`);
        
        const result = await saveToDatabase(db, chunk);
        totalInserted += result.inserted;
        totalErrors += result.errors;
        
        logger.info(`Chunk processed: ${result.inserted} inserted, ${result.errors} errors`);
        
        // Free memory if possible
        if (global.gc) {
          global.gc();
        }
      }
    }
    
    // Close the database connection
    await closeConnection(options.connectionId);
    
    logger.info(`Successfully saved ${totalInserted} records to the database (${totalErrors} errors)`);
    
    return { inserted: totalInserted, errors: totalErrors };
  } catch (error) {
    logger.error('Error processing Excel file', { error: error.message });
    
    // Make sure to close the database connection even if there's an error
    try {
      await closeConnection(options.connectionId);
    } catch (closeError) {
      logger.error('Error closing database connection', { error: closeError.message });
    }
    
    throw error;
  }
}

/**
 * Main function to process the Excel file and save to database
 */
async function main() {
  try {
    logger.info('Starting Excel to Database import process');
    const startTime = Date.now();
    
    // Parse command line arguments
    const { args, positionalArgs } = parseArgs();
    
    // Check if a file path was provided
    if (positionalArgs.length === 0) {
      throw new Error('No Excel file path provided. Usage: node src/index.js /path/to/file.xlsx');
    }
    
    const excelFilePath = positionalArgs[0];
    
    // Verify the file exists
    if (!fs.existsSync(excelFilePath)) {
      throw new Error(`Excel file not found: ${excelFilePath}`);
    }
    
    const connectionId = args['connection-id'] || 'default';
    const measurePerf = args['measure-performance'] === true || args['measure-performance'] === 'true';
    const chunkSize = parseInt(args['chunk-size'] || '100000', 10);
    const useStreaming = args['use-streaming'] === true || args['use-streaming'] === 'true' || args['stream'] === true || args['stream'] === 'true';
    const streamThreshold = parseInt(args['stream-threshold'] || '10', 10);
    
    // Database options
    const dbType = args['db-type'] || process.env.DB_TYPE || 'sqlite';
    const dbOptions = { type: dbType };
    
    if (dbType === 'sqlite') {
      dbOptions.path = args['db-path'] || process.env.DB_PATH;
      logger.info(`Using SQLite database${dbOptions.path ? ` at ${dbOptions.path}` : ''}`);
    } else if (dbType === 'mysql') {
      dbOptions.config = {
        host: args['mysql-host'] || process.env.MYSQL_HOST || 'localhost',
        port: parseInt(args['mysql-port'] || process.env.MYSQL_PORT || '3308', 10),
        user: args['mysql-user'] || process.env.MYSQL_USER || 'mysql',
        password: args['mysql-password'] || process.env.MYSQL_PASSWORD || '',
        database: args['mysql-database'] || process.env.MYSQL_DATABASE || 'people'
      };
      logger.info(`Using MySQL database at ${dbOptions.config.host}:${dbOptions.config.port}/${dbOptions.config.database}`);
    } else if (dbType === 'postgres' || dbType === 'postgresql') {
      dbOptions.config = {
        host: args['pg-host'] || process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(args['pg-port'] || process.env.POSTGRES_PORT || '5432', 10),
        user: args['pg-user'] || process.env.POSTGRES_USER || 'postgres',
        password: args['pg-password'] || process.env.POSTGRES_PASSWORD || 'postgres',
        database: args['pg-database'] || process.env.POSTGRES_DATABASE || 'people',
        poolSize: parseInt(args['pg-pool-size'] || process.env.POSTGRES_POOL_SIZE || '10', 10)
      };
      logger.info(`Using PostgreSQL database at ${dbOptions.config.host}:${dbOptions.config.port}/${dbOptions.config.database}`);
    }
    
    logger.info(`Using connection ID: ${connectionId}`);
    
    // Performance metrics
    let parseMetrics = null;
    let dbConnectMetrics = null;
    let saveMetrics = null;
    let result = null;
    
    // Process the Excel file
    if (measurePerf) {
      const processResult = await measurePerformance(
        processExcelFile, 
        'Process Excel File', 
        excelFilePath, 
        { connectionId, dbOptions, chunkSize, useStreaming, streamThreshold }
      );
      result = processResult.result;
      saveMetrics = processResult.performance;
      logger.info(`Processed Excel file in ${saveMetrics.durationSeconds.toFixed(2)} seconds`);
    } else {
      result = await processExcelFile(excelFilePath, { 
        connectionId, 
        dbOptions, 
        chunkSize, 
        useStreaming, 
        streamThreshold 
      });
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Prepare the response
    const response = {
      success: true,
      message: `Successfully imported ${result.inserted} records into the database`,
      duration: `${duration.toFixed(2)} seconds`,
      records: result.inserted,
      connectionId,
      databaseType: dbType,
      sourceFile: excelFilePath
    };
    
    // Add performance metrics if measured
    if (measurePerf) {
      response.performance = {
        total: {
          durationSeconds: duration,
          recordsPerSecond: (result.inserted / duration).toFixed(2)
        },
        process: saveMetrics
      };
    }
    
    // Output the result to stdout
    console.log(JSON.stringify(response, null, 2));
    
    logger.info(`Import completed in ${duration.toFixed(2)} seconds`);
  } catch (error) {
    logger.error('Error in import process', { error: error.message, stack: error.stack });
    console.error(JSON.stringify({
      success: false,
      message: 'Failed to import data',
      error: error.message
    }, null, 2));
    
    // Only exit the process if not in a test environment
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}

// Run the main function only if not being required in a test
if (process.env.NODE_ENV !== 'test') {
  main();
}

// Export functions for testing
module.exports = {
  main,
  processExcelFile
}; 