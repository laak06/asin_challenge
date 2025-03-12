#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk'); // For colorful output

// Constants
const logsDir = path.join(__dirname, '..', 'logs');
const MAX_ERROR_LENGTH = 80;

// Get all log files sorted by modification time (newest first)
const getLogFiles = () => {
  try {
    // Sort log files by modification time (newest first)
    const files = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log'))
      .map(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        return {
          file,
          filePath,
          mtime: stats.mtime
        };
      })
      .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first
    
    return files.map(f => f.filePath);
  } catch (error) {
    console.error(`Error reading log directory: ${error.message}`);
    return [];
  }
};

// Parse a single log file
function parseLogFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const fileSize = (fs.statSync(filePath).size / 1024).toFixed(1);
    
    // Extract test name from file name
    const testName = fileName.replace('.log', '');
    
    // Extract test suites information
    const testSuitesMatch = content.match(/Test Suites:\s+(.*)/);
    const testSuites = testSuitesMatch ? testSuitesMatch[1].trim() : 'Unknown';
    
    // Extract tests information
    const testsMatch = content.match(/Tests:\s+(.*)/);
    const tests = testsMatch ? testsMatch[1].trim() : 'Unknown';
    
    // Extract time information
    const timeMatch = content.match(/Time:\s+(.*)/);
    const time = timeMatch ? timeMatch[1].trim() : 'Unknown';
    
    // Extract timestamp
    const timestampMatch = content.match(/{"timestamp":"([^"]+)"/);
    const timestamp = timestampMatch ? 
      new Date(timestampMatch[1]).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) : 'Unknown';
    
    // Extract database type
    let databaseType = 'SQLite'; // Default
    if (content.includes('TEST_MYSQL=true') || content.includes('MySQL database initialized successfully')) {
      databaseType = 'MySQL';
    } else if (content.includes('TEST_POSTGRES=true') || content.includes('PostgreSQL database initialized successfully')) {
      databaseType = 'PostgreSQL';
    }
    
    // Extract error messages
    const errorMatches = content.match(/Error:.*$/gm);
    const errors = errorMatches ? 
      errorMatches.map(error => {
        // Truncate long error messages
        if (error.length > MAX_ERROR_LENGTH) {
          return error.substring(0, MAX_ERROR_LENGTH) + '...';
        }
        return error;
      }).join('\n') : '';
    
    // Extract skipped tests and their reasons
    const skippedTests = [];
    const skippedTestMatches = content.match(/● (.*) › (.*)\s+(.*)$/gm);
    
    if (skippedTestMatches) {
      skippedTestMatches.forEach(match => {
        const parts = match.split(' › ');
        if (parts.length >= 2) {
          const testSuite = parts[0].replace('●', '').trim();
          const testNameAndReason = parts[1].split('\n')[0].trim();
          
          // Extract test name and reason
          const testNameMatch = testNameAndReason.match(/(.*?)(?:\s{2,}|$)/);
          let testName = testNameMatch ? testNameMatch[1].trim() : 'Unknown test';
          
          // Look for reason in the next lines
          const reasonMatch = match.match(/\n\s+(.*)/);
          let reason = reasonMatch ? reasonMatch[1].trim() : '';
          
          // Clean up reason if it contains template literals
          reason = reason.replace(/\${.*?}/g, '').trim();
          
          skippedTests.push({
            suite: testSuite,
            name: testName,
            reason: reason
          });
        }
      });
    }
    
    // Also look for skipped tests in the console output
    const consoleSkipMatches = content.match(/Skipping record with insufficient identifying information/g);
    if (consoleSkipMatches) {
      skippedTests.push({
        suite: 'Database',
        name: 'Record processing',
        reason: 'Insufficient identifying information'
      });
    }
    
    // Look for MySQL and PostgreSQL initialization failures
    if (content.includes('Failed to initialize MySQL database')) {
      skippedTests.push({
        suite: 'Database',
        name: 'MySQL tests',
        reason: 'Failed to initialize MySQL database:'
      });
      
      // Look for more specific error
      const mysqlErrorMatch = content.match(/Failed to initialize MySQL database:([^}]*)/);
      if (mysqlErrorMatch && mysqlErrorMatch[1]) {
        const errorDetail = mysqlErrorMatch[1].trim();
        skippedTests[skippedTests.length - 1].reason += ' ' + errorDetail;
      }
    }
    
    if (content.includes('Failed to initialize PostgreSQL database')) {
      skippedTests.push({
        suite: 'Database',
        name: 'PostgreSQL tests',
        reason: 'Failed to initialize PostgreSQL database:'
      });
      
      // Look for more specific error
      const pgErrorMatch = content.match(/Failed to initialize PostgreSQL database:([^}]*)/);
      if (pgErrorMatch && pgErrorMatch[1]) {
        const errorDetail = pgErrorMatch[1].trim();
        skippedTests[skippedTests.length - 1].reason += ' ' + errorDetail;
      }
    }
    
    // Check for connection errors
    if (content.includes('MySQL') && content.includes('Connection error')) {
      const existingTest = skippedTests.find(t => t.name === 'MySQL tests');
      if (!existingTest) {
        skippedTests.push({
          suite: 'Database',
          name: 'MySQL tests',
          reason: 'Connection error'
        });
      }
    }
    
    if (content.includes('PostgreSQL') && content.includes('Connection error')) {
      const existingTest = skippedTests.find(t => t.name === 'PostgreSQL tests');
      if (!existingTest) {
        skippedTests.push({
          suite: 'Database',
          name: 'PostgreSQL tests',
          reason: 'Connection error'
        });
      }
    }
    
    return {
      testName,
      testSuites,
      tests,
      time,
      timestamp,
      databaseType,
      errors,
      skippedTests,
      fileSize
    };
  } catch (error) {
    console.error(`Error parsing log file ${filePath}: ${error.message}`);
    return {
      testName: path.basename(filePath).replace('.log', ''),
      testSuites: 'Error',
      tests: 'Error',
      time: 'Error',
      timestamp: 'Error',
      databaseType: 'Unknown',
      errors: `Failed to parse log file: ${error.message}`,
      skippedTests: [],
      fileSize: 0
    };
  }
}

// Main function to parse all logs
function parseAllLogs() {
  const logFiles = getLogFiles();
  const results = logFiles.map(file => parseLogFile(file));
  
  // Sort results by test name
  results.sort((a, b) => a.testName.localeCompare(b.testName));
  
  // Calculate summary statistics
  const totalTestRuns = results.length;
  let totalTestsPassed = 0;
  let totalTestsSkipped = 0;
  let totalTestsFailed = 0;
  let totalRunTime = 0;
  let testRunsWithErrors = 0;
  let totalLogSize = 0;
  
  // Database usage stats
  const databaseUsage = {
    SQLite: 0,
    MySQL: 0,
    PostgreSQL: 0
  };
  
  // Collect unique skipped tests by reason
  const skippedTestsByReason = {};
  
  results.forEach(result => {
    // Extract numbers from test results
    const passedMatch = result.tests.match(/(\d+) passed/);
    const skippedMatch = result.tests.match(/(\d+) skipped/);
    const failedMatch = result.tests.match(/(\d+) failed/);
    
    if (passedMatch) totalTestsPassed += parseInt(passedMatch[1]);
    if (skippedMatch) totalTestsSkipped += parseInt(skippedMatch[1]);
    if (failedMatch) totalTestsFailed += parseInt(failedMatch[1]);
    
    // Extract run time
    const timeMatch = result.time.match(/([\d.]+)\s*s/);
    if (timeMatch) totalRunTime += parseFloat(timeMatch[1]);
    
    // Count test runs with errors
    if (result.errors) testRunsWithErrors++;
    
    // Add to log size
    totalLogSize += parseFloat(result.fileSize);
    
    // Count database usage
    if (result.databaseType) {
      databaseUsage[result.databaseType]++;
    }
    
    // Collect skipped tests by reason
    result.skippedTests.forEach(test => {
      const cleanReason = test.reason.replace(/\${.*?}/g, '').trim();
      if (!skippedTestsByReason[cleanReason]) {
        skippedTestsByReason[cleanReason] = [];
      }
      
      // Only add if not already in the list
      const exists = skippedTestsByReason[cleanReason].some(t => 
        t.name === test.name && t.suite === test.suite
      );
      
      if (!exists) {
        skippedTestsByReason[cleanReason].push({
          name: test.name,
          suite: test.suite
        });
      }
    });
  });
  
  // Find most recent test
  const mostRecent = [...results].sort((a, b) => {
    const dateA = a.timestamp !== 'Unknown' ? new Date(a.timestamp) : new Date(0);
    const dateB = b.timestamp !== 'Unknown' ? new Date(b.timestamp) : new Date(0);
    return dateB - dateA;
  })[0];
  
  // Print results table
  console.log('\nTest Results Summary:');
  console.log('===================\n');
  
  // Print header
  console.log(
    chalk.bold('Test Name'.padEnd(20)) +
    chalk.bold('Test Suites'.padEnd(20)) +
    chalk.bold('Tests'.padEnd(35)) +
    chalk.bold('Time'.padEnd(25)) +
    chalk.bold('Size')
  );
  
  console.log('\n' + chalk.bold('Last Run'.padEnd(20)) + chalk.bold('Databases'));
  console.log('-'.repeat(105) + '\n' + '-'.repeat(40));
  
  // Print each test result
  results.forEach(result => {
    console.log(
      chalk.cyan(result.testName.padEnd(20)) +
      result.testSuites.padEnd(20) +
      result.tests.padEnd(35) +
      result.time.padEnd(25) +
      `${result.fileSize} KB`
    );
    
    console.log('\n' + result.timestamp.padEnd(20) + chalk.yellow(result.databaseType));
    
    // Print skipped tests if any
    if (result.skippedTests.length > 0) {
      console.log('                     ' + chalk.yellow('Skipped Tests: '));
      result.skippedTests.forEach(test => {
        console.log(`                       ${chalk.yellow('•')} ${test.name}: ${test.reason}`);
      });
    }
    
    // Print errors if any
    if (result.errors) {
      console.log('                     ' + chalk.red('Errors: ') + result.errors);
    }
  });
  
  // Print summary
  console.log('\nSummary:');
  console.log('--------------------------------------------------');
  console.log(`Total Test Runs: ${chalk.cyan(totalTestRuns)}`);
  console.log(`Total Tests Passed: ${chalk.green(totalTestsPassed)}`);
  console.log(`Total Tests Skipped: ${chalk.yellow(totalTestsSkipped)}`);
  console.log(`Total Tests Failed: ${chalk.red(totalTestsFailed)}`);
  console.log(`Test Runs With Errors: ${chalk.red(testRunsWithErrors)}`);
  console.log(`Average Run Time: ${chalk.cyan((totalRunTime / totalTestRuns).toFixed(2))} seconds`);
  console.log(`Total Log Size: ${chalk.cyan(totalLogSize.toFixed(1))} KB`);
  
  // Print database usage
  console.log('\nDatabase Usage:');
  console.log('--------------------------------------------------');
  Object.keys(databaseUsage).forEach(db => {
    const count = databaseUsage[db];
    const percentage = ((count / totalTestRuns) * 100).toFixed(1);
    if (count > 0) {
      console.log(`${db}: Used in ${chalk.cyan(count)} test runs (${chalk.yellow(percentage)}%)`);
    }
  });
  
  // Print most recent test
  console.log('\nMost Recent Test:');
  console.log('--------------------------------------------------');
  console.log(`Test: ${chalk.cyan(mostRecent.testName)}`);
  console.log(`Run at: ${chalk.cyan(mostRecent.timestamp)}`);
  console.log(`Result: ${mostRecent.errors ? chalk.red('Failed') : chalk.green('Passed')}`);
  
  // Print skipped tests by reason
  console.log('\nSkipped Tests:');
  console.log('--------------------------------------------------');
  Object.keys(skippedTestsByReason).forEach(reason => {
    console.log(`Reason: ${chalk.yellow(reason)}`);
    skippedTestsByReason[reason].forEach(test => {
      console.log(`  ${chalk.yellow('•')} ${test.name}`);
    });
    console.log('');
  });
  
  console.log('\n');
}

// Parse all log files
parseAllLogs(); 