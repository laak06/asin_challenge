#!/usr/bin/env node

/**
 * Check PostgreSQL Connection
 * 
 * This script checks if the PostgreSQL container is running and accessible.
 * It attempts to connect to the PostgreSQL database using the configured credentials.
 */

const { Client } = require('pg');
require('dotenv').config();

// Connection configuration
const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'test_password',
  database: process.env.POSTGRES_DATABASE || 'test_people',
  connectionTimeoutMillis: 5000, // 5 seconds
};

console.log('Checking PostgreSQL connection with the following configuration:');
console.log(`Host: ${config.host}`);
console.log(`Port: ${config.port}`);
console.log(`User: ${config.user}`);
console.log(`Database: ${config.database}`);
console.log(`Password: ${config.password}`);

// Connect to the database
const client = new Client(config);
client.connect()
  .then(() => {
    console.log('Successfully connected to PostgreSQL!');
    return client.query('SELECT version()');
  })
  .then(result => {
    console.log('PostgreSQL version:', result.rows[0].version);
    return client.end();
  })
  .then(() => {
    console.log('Connection closed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error connecting to PostgreSQL:', err.message);
    console.error('Error code:', err.code);
    console.error('Error details:', err);
    
    if (err.code === 'ECONNREFUSED') {
      console.error('The PostgreSQL server is not running or not accessible.');
      console.error('Make sure the Docker container is running:');
      console.error('  docker-compose -f docker-compose.test.yml up -d');
    } else if (err.code === '28P01') {
      console.error('Authentication failed. Check your username and password.');
    } else if (err.code === '3D000') {
      console.error('Database does not exist. Make sure the database is created.');
    }
    process.exit(1);
  }); 