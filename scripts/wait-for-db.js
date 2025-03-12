#!/usr/bin/env node

/**
 * Wait for Database
 * 
 * This script waits for the database to be ready before proceeding.
 * It attempts to connect to the database repeatedly until it succeeds or times out.
 */

const { Client } = require('pg');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const dbType = args[0] || 'postgres';
const maxAttempts = parseInt(args[1] || '30', 10);
const delay = parseInt(args[2] || '1000', 10);

// Configuration for PostgreSQL
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'test_password',
  database: process.env.POSTGRES_DATABASE || 'test_people',
  connectionTimeoutMillis: 5000,
};

// Configuration for MySQL
const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3308', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'test_password',
  database: process.env.MYSQL_DATABASE || 'test_people',
  connectTimeout: 5000,
  authPlugins: {
    mysql_native_password: () => ({ default: true })
  }
};

// Function to wait for PostgreSQL
async function waitForPostgres() {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Attempt ${attempts}/${maxAttempts} to connect to PostgreSQL...`);
    console.log(`Attempting to connect to PostgreSQL at ${pgConfig.host}:${pgConfig.port}`);
    
    try {
      const client = new Client(pgConfig);
      await client.connect();
      console.log('PostgreSQL is ready!');
      await client.end();
      return true;
    } catch (err) {
      console.log(`PostgreSQL not ready yet: ${err.message}`);
      console.log('Error code:', err.code);
      console.log('Error details:', err);
      
      if (attempts < maxAttempts) {
        console.log(`Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error('Timed out waiting for PostgreSQL to be ready.');
  return false;
}

// Function to wait for MySQL
async function waitForMysql() {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Attempt ${attempts}/${maxAttempts} to connect to MySQL...`);
    
    try {
      console.log(`Attempting to connect to MySQL at ${mysqlConfig.host}:${mysqlConfig.port}`);
      
      const connection = await mysql.createConnection(mysqlConfig);
      console.log('MySQL is ready!');
      await connection.end();
      return true;
    } catch (err) {
      console.log(`MySQL not ready yet: ${err.message}`);
      console.log('Error code:', err.code);
      
      if (attempts < maxAttempts) {
        console.log(`Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error('Timed out waiting for MySQL to be ready.');
  return false;
}

// Main function
async function main() {
  console.log(`Waiting for ${dbType} to be ready...`);
  
  let success = false;
  
  if (dbType === 'postgres') {
    success = await waitForPostgres();
  } else if (dbType === 'mysql') {
    success = await waitForMysql();
  } else {
    console.error(`Unsupported database type: ${dbType}`);
    process.exit(1);
  }
  
  if (success) {
    console.log(`${dbType} is ready!`);
    process.exit(0);
  } else {
    console.error(`Timed out waiting for ${dbType} to be ready.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 