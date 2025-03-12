#!/usr/bin/env node

/**
 * Release Script
 * 
 * This script helps with creating new releases by:
 * 1. Updating the version in package.json
 * 2. Creating a git tag
 * 3. Pushing the tag to trigger the CI/CD pipeline
 * 
 * Usage: node scripts/create-release.js [major|minor|patch]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get the release type from command line arguments
const releaseType = process.argv[2] || 'patch';

if (!['major', 'minor', 'patch'].includes(releaseType)) {
  console.error('Invalid release type. Use: major, minor, or patch');
  process.exit(1);
}

try {
  // Read the current package.json
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Parse the current version
  const [major, minor, patch] = packageJson.version.split('.').map(Number);
  
  // Calculate the new version
  let newVersion;
  if (releaseType === 'major') {
    newVersion = `${major + 1}.0.0`;
  } else if (releaseType === 'minor') {
    newVersion = `${major}.${minor + 1}.0`;
  } else {
    newVersion = `${major}.${minor}.${patch + 1}`;
  }
  
  // Update the version in package.json
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  
  console.log(`Updated version in package.json to ${newVersion}`);
  
  // Commit the changes
  execSync('git add package.json');
  execSync(`git commit -m "Bump version to ${newVersion}"`);
  console.log(`Committed changes to git`);
  
  // Create a tag
  execSync(`git tag v${newVersion}`);
  console.log(`Created tag v${newVersion}`);
  
  // Push the changes and tag
  console.log('Ready to push changes and tag. Run:');
  console.log(`git push origin main && git push origin v${newVersion}`);
  
  console.log('\nThis will trigger the CI/CD pipeline to create a release.');
} catch (error) {
  console.error('Error creating release:', error.message);
  process.exit(1);
} 