/**
 * Run Tests with Cleanup
 * 
 * This script runs Jest tests and ensures proper cleanup of resources.
 * It sets a timeout to force exit after tests complete to prevent hanging.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get command line arguments
const args = process.argv.slice(2);

// Default Jest arguments
const jestArgs = ['--detectOpenHandles', '--forceExit'];

// Add coverage if requested
if (args.includes('--coverage')) {
  jestArgs.push('--coverage');
  // Remove from args to avoid duplication
  const coverageIndex = args.indexOf('--coverage');
  if (coverageIndex !== -1) {
    args.splice(coverageIndex, 1);
  }
}

// Combine all arguments
const allArgs = [...jestArgs, ...args];

console.log(`Running Jest with arguments: ${allArgs.join(' ')}`);

// Run Jest with the specified arguments
const jest = spawn('jest', allArgs, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

// Set a timeout to force exit after tests complete
const exitTimeout = setTimeout(() => {
  console.log('Forcing exit after timeout...');
  process.exit(0);
}, 30000); // 30 seconds timeout

// Handle Jest process exit
jest.on('exit', (code) => {
  console.log(`Jest process exited with code ${code}`);
  
  // Clear the timeout
  clearTimeout(exitTimeout);
  
  // Check if coverage directory exists and wait for it to be fully written
  const waitForCoverage = () => {
    if (args.includes('--coverage')) {
      const coveragePath = path.join(process.cwd(), 'coverage');
      const lcovPath = path.join(coveragePath, 'lcov.info');
      
      // If coverage directory doesn't exist yet, wait a bit
      if (!fs.existsSync(coveragePath)) {
        console.log('Waiting for coverage directory to be created...');
        setTimeout(waitForCoverage, 500);
        return;
      }
      
      // If lcov.info doesn't exist yet, wait a bit
      if (!fs.existsSync(lcovPath)) {
        console.log('Waiting for coverage reports to be written...');
        setTimeout(waitForCoverage, 500);
        return;
      }
      
      // Coverage reports are ready, exit after a short delay
      console.log('Coverage reports generated successfully.');
      setTimeout(() => {
        console.log('Exiting after cleanup...');
        process.exit(code);
      }, 2000); // 2 seconds for cleanup
    } else {
      // No coverage requested, exit after a short delay
      setTimeout(() => {
        console.log('Exiting after cleanup...');
        process.exit(code);
      }, 2000); // 2 seconds for cleanup
    }
  };
  
  // Start waiting for coverage
  waitForCoverage();
});

// Handle errors
jest.on('error', (error) => {
  console.error('Error running Jest:', error);
  clearTimeout(exitTimeout);
  process.exit(1);
}); 