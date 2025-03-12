/**
 * Logger Module
 * 
 * This module provides a consistent logging interface for the application.
 * It supports different log levels and formats log messages in a structured way.
 */

// Define log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Get the configured log level from environment variables or default to 'info'
const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentLogLevel = LOG_LEVELS[configuredLevel] !== undefined 
  ? LOG_LEVELS[configuredLevel] 
  : LOG_LEVELS.info;

/**
 * Format a log message with timestamp and additional data
 * 
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to include in the log
 * @returns {string} - Formatted log message
 */
function formatLogMessage(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...data
  };
  
  return JSON.stringify(logData);
}

/**
 * Logger object with methods for different log levels
 */
const logger = {
  /**
   * Log an error message
   * 
   * @param {string} message - Error message
   * @param {Object} data - Additional data
   */
  error: (message, data = {}) => {
    if (currentLogLevel >= LOG_LEVELS.error) {
      console.error(formatLogMessage('error', message, data));
    }
  },
  
  /**
   * Log a warning message
   * 
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warn: (message, data = {}) => {
    if (currentLogLevel >= LOG_LEVELS.warn) {
      console.warn(formatLogMessage('warn', message, data));
    }
  },
  
  /**
   * Log an info message
   * 
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info: (message, data = {}) => {
    if (currentLogLevel >= LOG_LEVELS.info) {
      console.info(formatLogMessage('info', message, data));
    }
  },
  
  /**
   * Log a debug message
   * 
   * @param {string} message - Debug message
   * @param {Object} data - Additional data
   */
  debug: (message, data = {}) => {
    if (currentLogLevel >= LOG_LEVELS.debug) {
      console.debug(formatLogMessage('debug', message, data));
    }
  }
};

module.exports = {
  logger
}; 