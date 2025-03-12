#!/usr/bin/env node

/**
 * Database Performance Test
 * 
 * This script tests the performance of different database types with various data sizes.
 * It generates sample data, imports it into each database, and measures the performance.
 * 
 * Usage: node examples/performance-test.js [options]
 * 
 * Options:
 * --record-counts=<counts>  Comma-separated list of record counts to test (default: 100,1000,10000)
 * --db-types=<types>        Comma-separated list of database types to test (default: sqlite,mysql,postgres)
 * --iterations=<num>        Number of iterations for each test (default: 3)
 * --output=<file>           Output file for results (default: performance-results.json)
 * --stress-test             Run stress tests with high concurrency
 * --stress-clients=<num>    Number of concurrent clients for stress test (default: 10)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generateSampleData, generateId, generateBirthDate } = require('./generate-sample');
const { getConnection, closeConnection, saveToDatabase, closeAllConnections } = require('../src/database');

// Parse command line arguments
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      args[key] = value || true;
    }
  });
  return args;
}

// Format duration in seconds with 2 decimal places
function formatDuration(ms) {
  return (ms / 1000).toFixed(2);
}

// Run a single performance test
async function runTest(dbType, recordCount, iteration) {
  console.log(`\nRunning test: ${dbType} with ${recordCount} records (iteration ${iteration + 1})`);
  
  // Generate sample data
  console.log(`Generating ${recordCount} records...`);
  const startGenerate = Date.now();
  const people = generateSampleData(recordCount);
  const generateTime = Date.now() - startGenerate;
  console.log(`Generated ${recordCount} records in ${formatDuration(generateTime)}s`);
  
  // Database options
  const dbOptions = { type: dbType };
  const connectionId = `perf-test-${dbType}-${recordCount}-${iteration}`;
  
  if (dbType === 'mysql') {
    dbOptions.config = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3308', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'test_password',
      database: process.env.MYSQL_DATABASE || 'people'
    };
  } else if (dbType === 'postgres' || dbType === 'postgresql') {
    dbOptions.config = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'test_password',
      database: process.env.POSTGRES_DATABASE || 'people'
    };
  } else {
    // For SQLite, use a temporary database file
    const dbPath = path.join(__dirname, '..', 'data', `perf-test-${recordCount}-${iteration}.db`);
    dbOptions.path = dbPath;
    
    // Delete the database file if it exists
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }
  
  // Connect to the database
  console.log(`Connecting to ${dbType} database...`);
  const startConnect = Date.now();
  const db = await getConnection(connectionId, dbOptions);
  const connectTime = Date.now() - startConnect;
  console.log(`Connected to ${dbType} database in ${formatDuration(connectTime)}s`);
  
  // Save data to the database
  console.log(`Saving ${recordCount} records to ${dbType} database...`);
  const startSave = Date.now();
  const result = await saveToDatabase(db, people);
  const saveTime = Date.now() - startSave;
  console.log(`Saved ${result.inserted} records to ${dbType} database in ${formatDuration(saveTime)}s`);
  
  // Close the database connection
  await closeConnection(connectionId);
  
  // Clean up SQLite database file
  if (dbType === 'sqlite' && dbOptions.path) {
    // Keep the file for now, will be deleted in the next test
  }
  
  // Return performance metrics
  return {
    dbType,
    recordCount,
    iteration: iteration + 1,
    metrics: {
      generateTime,
      connectTime,
      saveTime,
      totalTime: generateTime + connectTime + saveTime,
      recordsPerSecond: Math.round(result.inserted / (saveTime / 1000))
    },
    result
  };
}

// Run stress test with multiple concurrent clients
async function runStressTest(dbType, recordCount, numClients) {
  console.log(`\nRunning stress test: ${dbType} with ${recordCount} records and ${numClients} concurrent clients`);
  
  // Generate sample data once and reuse for all clients
  console.log(`Generating ${recordCount} records...`);
  const startGenerate = Date.now();
  const people = generateSampleData(recordCount);
  const generateTime = Date.now() - startGenerate;
  console.log(`Generated ${recordCount} records in ${formatDuration(generateTime)}s`);
  
  // Database options
  const dbOptions = { type: dbType };
  
  if (dbType === 'mysql') {
    dbOptions.config = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3308', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'test_password',
      database: process.env.MYSQL_DATABASE || 'people'
    };
  } else if (dbType === 'postgres' || dbType === 'postgresql') {
    dbOptions.config = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'test_password',
      database: process.env.POSTGRES_DATABASE || 'people',
      poolSize: numClients + 5 // Add some extra connections for safety
    };
  } else {
    // For SQLite, use a shared database file
    const dbPath = path.join(__dirname, '..', 'data', `stress-test-${recordCount}.db`);
    dbOptions.path = dbPath;
    
    // Delete the database file if it exists
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }
  
  // Create an array of client functions
  const clients = Array.from({ length: numClients }, (_, i) => {
    return async () => {
      const connectionId = `stress-test-${dbType}-${recordCount}-client-${i}`;
      
      // Connect to the database
      const startConnect = Date.now();
      const db = await getConnection(connectionId, dbOptions);
      const connectTime = Date.now() - startConnect;
      
      // Save data to the database
      const startSave = Date.now();
      const result = await saveToDatabase(db, people);
      const saveTime = Date.now() - startSave;
      
      // Close the database connection
      await closeConnection(connectionId);
      
      return {
        clientId: i,
        connectTime,
        saveTime,
        totalTime: connectTime + saveTime,
        recordsPerSecond: Math.round(result.inserted / (saveTime / 1000)),
        result
      };
    };
  });
  
  // Run all clients concurrently
  console.log(`Starting ${numClients} concurrent clients...`);
  const startTime = Date.now();
  const results = await Promise.all(clients.map(client => client()));
  const totalTime = Date.now() - startTime;
  
  // Calculate aggregate metrics
  const totalRecords = results.reduce((sum, r) => sum + r.result.inserted, 0);
  const avgConnectTime = results.reduce((sum, r) => sum + r.connectTime, 0) / numClients;
  const avgSaveTime = results.reduce((sum, r) => sum + r.saveTime, 0) / numClients;
  const avgTotalTime = results.reduce((sum, r) => sum + r.totalTime, 0) / numClients;
  const totalRecordsPerSecond = Math.round(totalRecords / (totalTime / 1000));
  
  console.log(`Stress test completed in ${formatDuration(totalTime)}s`);
  console.log(`Total records: ${totalRecords}, Records/sec: ${totalRecordsPerSecond}`);
  
  // Clean up SQLite database file
  if (dbType === 'sqlite' && dbOptions.path) {
    // Keep the file for now
  }
  
  // Return stress test metrics
  return {
    dbType,
    recordCount,
    numClients,
    metrics: {
      generateTime,
      totalTime,
      avgConnectTime,
      avgSaveTime,
      avgTotalTime,
      totalRecordsPerSecond,
      clientMetrics: results.map(r => ({
        clientId: r.clientId,
        connectTime: r.connectTime,
        saveTime: r.saveTime,
        totalTime: r.totalTime,
        recordsPerSecond: r.recordsPerSecond
      }))
    },
    totalRecords
  };
}

// Main function
async function main() {
  try {
    // Parse command line arguments
    const args = parseArgs();
    
    // Test parameters
    const recordCounts = args['record-counts'] ? 
      args['record-counts'].split(',').map(n => parseInt(n, 10)) : 
      [100, 1000, 10000];
    
    const dbTypes = args['db-types'] ? 
      args['db-types'].split(',') : 
      ['sqlite', 'mysql', 'postgres'];
    
    const iterations = args['iterations'] ? 
      parseInt(args['iterations'], 10) : 
      3;
    
    const outputFile = args['output'] || 'performance-results.json';
    
    const runStress = args['stress-test'] === true || args['stress-test'] === 'true';
    const stressClients = args['stress-clients'] ? 
      parseInt(args['stress-clients'], 10) : 
      10;
    
    console.log('Database Performance Test');
    console.log('========================');
    console.log(`Record counts: ${recordCounts.join(', ')}`);
    console.log(`Database types: ${dbTypes.join(', ')}`);
    console.log(`Iterations: ${iterations}`);
    console.log(`Output file: ${outputFile}`);
    if (runStress) {
      console.log(`Stress test: Yes (${stressClients} clients)`);
    }
    console.log('========================\n');
    
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Run performance tests
    const results = [];
    
    // Regular performance tests
    for (const dbType of dbTypes) {
      for (const recordCount of recordCounts) {
        const dbResults = [];
        
        for (let i = 0; i < iterations; i++) {
          const result = await runTest(dbType, recordCount, i);
          dbResults.push(result);
        }
        
        // Calculate average metrics
        const avgConnectTime = dbResults.reduce((sum, r) => sum + r.metrics.connectTime, 0) / iterations;
        const avgSaveTime = dbResults.reduce((sum, r) => sum + r.metrics.saveTime, 0) / iterations;
        const avgTotalTime = dbResults.reduce((sum, r) => sum + r.metrics.totalTime, 0) / iterations;
        const avgRecordsPerSecond = dbResults.reduce((sum, r) => sum + r.metrics.recordsPerSecond, 0) / iterations;
        
        // Add summary result
        results.push({
          dbType,
          recordCount,
          iterations,
          avgMetrics: {
            connectTime: avgConnectTime,
            saveTime: avgSaveTime,
            totalTime: avgTotalTime,
            recordsPerSecond: avgRecordsPerSecond
          },
          iterationResults: dbResults
        });
        
        console.log(`\nSummary for ${dbType} with ${recordCount} records:`);
        console.log(`  Avg Connect Time: ${formatDuration(avgConnectTime)}s`);
        console.log(`  Avg Save Time: ${formatDuration(avgSaveTime)}s`);
        console.log(`  Avg Total Time: ${formatDuration(avgTotalTime)}s`);
        console.log(`  Avg Records/sec: ${Math.round(avgRecordsPerSecond)}`);
      }
    }
    
    // Stress tests
    if (runStress) {
      const stressResults = [];
      
      for (const dbType of dbTypes) {
        for (const recordCount of recordCounts) {
          const result = await runStressTest(dbType, recordCount, stressClients);
          stressResults.push(result);
          
          console.log(`\nStress test summary for ${dbType} with ${recordCount} records and ${stressClients} clients:`);
          console.log(`  Total Time: ${formatDuration(result.metrics.totalTime)}s`);
          console.log(`  Avg Connect Time: ${formatDuration(result.metrics.avgConnectTime)}s`);
          console.log(`  Avg Save Time: ${formatDuration(result.metrics.avgSaveTime)}s`);
          console.log(`  Total Records/sec: ${result.metrics.totalRecordsPerSecond}`);
        }
      }
      
      // Add stress test results
      results.push({
        testType: 'stress',
        numClients: stressClients,
        stressResults
      });
    }
    
    // Close all database connections
    await closeAllConnections();
    
    // Write results to file
    fs.writeFileSync(
      path.join(__dirname, '..', outputFile),
      JSON.stringify(results, null, 2)
    );
    
    console.log(`\nPerformance test completed. Results saved to ${outputFile}`);
  } catch (error) {
    console.error('Error in performance test:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 