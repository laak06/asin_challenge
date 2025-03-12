# Test Logs Directory

This directory contains log files generated during test runs. These logs are used by the test summary script to provide a comprehensive overview of test results.

## Log Files

The following log files are generated:

- `test.log`: Standard test run
- `test_coverage.log`: Test run with coverage
- `test_coverage_clean.log`: Test run with coverage after cleaning the coverage directory
- `test_mysql.log`: Test run with MySQL database
- `test_postgres.log`: Test run with PostgreSQL database
- `test_all.log`: Test run with all databases
- `test_docker.log`: Test run with Docker containers
- `test_env.log`: Test run with environment variables from .env.test

## Viewing Test Summary

To view a summary of all test results, run:

```bash
npm run test:summary
```

This will parse all log files and display a comprehensive overview of test results.

## Note

Log files are excluded from Git by the `.gitignore` file. This README is included to ensure the directory exists in the repository. 