/**
 * Run Coverage Tests
 * 
 * This script runs Jest tests with coverage and ensures the coverage directory exists.
 * It also handles the cleanup of the coverage directory before running tests.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get the coverage directory path
const coverageDir = path.join(__dirname, '..', 'coverage');

// Clean up the coverage directory if it exists
if (fs.existsSync(coverageDir)) {
  console.log(`Removing existing coverage directory: ${coverageDir}`);
  fs.rmSync(coverageDir, { recursive: true, force: true });
}

// Create the coverage directory
console.log(`Creating coverage directory: ${coverageDir}`);
fs.mkdirSync(coverageDir, { recursive: true });

// Create a test file to verify write access
const testFile = path.join(coverageDir, 'test-write.txt');
try {
  fs.writeFileSync(testFile, 'Test write access to coverage directory');
  console.log(`Successfully wrote test file: ${testFile}`);
  
  // Clean up the test file
  fs.unlinkSync(testFile);
  console.log(`Successfully removed test file: ${testFile}`);
  
  console.log('Coverage directory is ready for use');
} catch (error) {
  console.error(`Error writing to coverage directory: ${error.message}`);
  process.exit(1);
}

// Run Jest with coverage
console.log('Running Jest with coverage...');
try {
  execSync('jest --coverage --detectOpenHandles --forceExit', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('Jest tests completed successfully');
} catch (error) {
  console.error(`Error running Jest tests: ${error.message}`);
  process.exit(1);
}

// Verify that coverage reports were generated
const lcovFile = path.join(coverageDir, 'lcov.info');
if (fs.existsSync(lcovFile)) {
  console.log(`Coverage reports generated successfully: ${lcovFile}`);
} else {
  console.error(`Coverage reports were not generated: ${lcovFile} not found`);
  process.exit(1);
} 