#!/usr/bin/env node

/**
 * Ensure Directories
 * 
 * This script ensures that all required directories exist for the application.
 */

const fs = require('fs');
const path = require('path');

// Define directories to create
const directories = [
  path.join(__dirname, '..', 'data'),
  path.join(__dirname, '..', 'logs')
];

// Create each directory if it doesn't exist
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    console.log(`Directory already exists: ${dir}`);
  }
});

console.log('All directories created successfully.'); 