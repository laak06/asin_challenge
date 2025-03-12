#! /bin/bash

mkdir -p logs

# Run tests with environment variables
npm run test:env > logs/test_env.log 2>&1

# Run Jest tests
npm run test > logs/jest.log 2>&1

# Run tests
npm run test > logs/test.log 2>&1

# Run tests with coverage
npm run test:coverage > logs/test_coverage.log 2>&1

# Clean coverage directory and run tests with coverage
npm run test:coverage:clean > logs/test_coverage_clean.log 2>&1

# Run tests with coverage for all databases
npm run test:coverage:all > logs/test_coverage_all.log 2>&1

# Run tests with coverage for MySQL database
npm run test:coverage:mysql > logs/test_coverage_mysql.log 2>&1

# Run tests with coverage for PostgreSQL database
npm run test:coverage:postgres > logs/test_coverage_postgres.log 2>&1

# Run tests with coverage for all databases
npm run test:coverage:full > logs/test_coverage_full.log 2>&1

# Run tests with Docker containers for databases
npm run test:docker > logs/test_docker.log 2>&1

# Run tests with MySQL database
npm run test:mysql > logs/test_mysql.log 2>&1

# Run tests with PostgreSQL database
npm run test:postgres > logs/test_postgres.log 2>&1

# Run tests with all databases
npm run test:all > logs/test_all.log 2>&1

# Run tests with summary
npm run test:summary

