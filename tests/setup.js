/**
 * Jest Setup File
 * 
 * This file contains setup and teardown code for Jest tests.
 * It ensures proper cleanup of database connections and other resources.
 */

const { closeAllConnections } = require('../src/database');

// Set a longer timeout for tests
jest.setTimeout(10000);

// Global teardown after all tests
afterAll(async () => {
  // Force close all database connections
  try {
    await closeAllConnections(true);
    
    // Add a small delay to allow any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error('Error during test cleanup:', error);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

/**
 * Jest setup file
 * 
 * This file is executed before running tests.
 */

// Set NODE_ENV to 'test' to prevent process.exit() calls
process.env.NODE_ENV = 'test';

// Suppress console output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Only suppress console output if not in verbose mode
if (!process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
}

// Restore console functions after tests
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
}); 