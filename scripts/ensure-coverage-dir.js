/**
 * Ensure Coverage Directory
 * 
 * This script ensures that the coverage directory exists and is writable.
 * It's used before running tests with coverage to make sure the directory is available.
 */

const fs = require('fs');
const path = require('path');

// Get the coverage directory path
const coverageDir = path.join(__dirname, '..', 'coverage');

// Create the coverage directory if it doesn't exist
if (!fs.existsSync(coverageDir)) {
  console.log(`Creating coverage directory: ${coverageDir}`);
  fs.mkdirSync(coverageDir, { recursive: true });
} else {
  console.log(`Coverage directory already exists: ${coverageDir}`);
}

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