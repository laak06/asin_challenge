#!/usr/bin/env node

/**
 * Check MySQL Connection
 * 
 * This script checks if the MySQL container is running and accessible.
 * It attempts to connect to the MySQL database using the configured credentials.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Connection configuration
const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: 3308, // Explicitly set to 3308 for Docker
  user: 'root', // Explicitly set to root
  password: process.env.MYSQL_PASSWORD || 'test_password',
  database: process.env.MYSQL_DATABASE || 'test_people',
  connectTimeout: 5000, // 5 seconds
  authPlugins: {
    mysql_native_password: () => ({ default: true })
  }
};

console.log('Checking MySQL connection with the following configuration:');
console.log(`Host: ${config.host}`);
console.log(`Port: ${config.port}`);
console.log(`User: ${config.user}`);
console.log(`Database: ${config.database}`);

// Connect to the database
mysql.createConnection(config)
  .then(connection => {
    console.log('Successfully connected to MySQL!');
    return connection.query('SELECT VERSION() as version')
      .then(([rows]) => {
        console.log('MySQL version:', rows[0].version);
        return connection.end();
      });
  })
  .then(() => {
    console.log('Connection closed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error connecting to MySQL:', err.message);
    console.error('Error code:', err.code);
    console.error('Error details:', err);
    
    if (err.code === 'ECONNREFUSED') {
      console.error('The MySQL server is not running or not accessible.');
      console.error('Make sure the Docker container is running:');
      console.error('  docker-compose -f docker-compose.test.yml up -d');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Authentication failed. Check your username and password.');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('Database does not exist. Make sure the database is created.');
    }
    process.exit(1);
  });