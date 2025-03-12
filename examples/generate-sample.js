#!/usr/bin/env node

/**
 * Generate Sample Excel File
 * 
 * This script generates a sample Excel file with random people data
 * in the French format (matching the structure of 'people sample.xlsx').
 * 
 * Usage: node examples/generate-sample.js [num_records] [language]
 * 
 * Languages supported:
 * - french (default)
 * - english
 * - russian
 * - arabic
 * - chinese
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const numRecords = parseInt(process.argv[2], 10) || 100;
const language = (process.argv[3] || 'french').toLowerCase();

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Header mappings for different languages
const headers = {
  english: {
    external_id: 'ID',
    name: 'Name',
    first_name: 'First Name',
    last_name: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    birth_date: 'Birth Date',
    status: 'Status'
  },
  french: {
    external_id: 'Identifiant',
    name: 'Nom',
    first_name: 'Prénom',
    last_name: 'Nom de famille',
    email: 'Courriel',
    phone: 'Téléphone',
    birth_date: 'Date de naissance',
    status: 'Statut'
  },
  russian: {
    external_id: 'Идентификатор',
    name: 'Имя',
    first_name: 'Имя',
    last_name: 'Фамилия',
    email: 'Электронная почта',
    phone: 'Телефон',
    birth_date: 'Дата рождения',
    status: 'Статус'
  },
  arabic: {
    external_id: 'المعرف',
    name: 'الاسم',
    first_name: 'الاسم الأول',
    last_name: 'اسم العائلة',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    birth_date: 'تاريخ الميلاد',
    status: 'الحالة'
  },
  chinese: {
    external_id: '标识符',
    name: '姓名',
    first_name: '名',
    last_name: '姓',
    email: '电子邮件',
    phone: '电话',
    birth_date: '出生日期',
    status: '状态'
  }
};

// Status values for different languages
const statusValues = {
  english: ['Active', 'Inactive', 'Pending', 'Suspended', 'Archived'],
  french: ['Actif', 'Inactif', 'Suspendu', 'En attente', 'Archivé'],
  russian: ['Активный', 'Неактивный', 'Приостановлено', 'В ожидании', 'Архивировано'],
  arabic: ['نشط', 'غير نشط', 'معلق', 'قيد الانتظار', 'مؤرشف'],
  chinese: ['活跃', '不活跃', '暂停', '等待中', '已归档']
};

// Generate a random ID
function generateId() {
  return Math.random().toString(16).substring(2, 10).toUpperCase();
}

// Generate a random birth date
function generateBirthDate() {
  const year = 1950 + Math.floor(Math.random() * 50);
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  
  // Format: MM-DD-YYYY or DD/MM/YYYY (randomly chosen)
  if (Math.random() > 0.5) {
    return `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}-${year}`;
  } else {
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
  }
}

// Generate a person object
function generatePerson(index, language) {
  const firstName = `${language.charAt(0).toUpperCase() + language.slice(1)}${index}`;
  const lastName = `Person${index}`;
  
  return {
    [headers[language].external_id]: generateId(),
    [headers[language].first_name]: firstName,
    [headers[language].last_name]: lastName,
    [headers[language].birth_date]: generateBirthDate(),
    [headers[language].status]: statusValues[language][index % statusValues[language].length]
  };
}

// Generate sample data
function generateSampleData(count, language = 'english') {
  if (!headers[language]) {
    console.error(`Unsupported language: ${language}`);
    console.error(`Supported languages: ${Object.keys(headers).join(', ')}`);
    process.exit(1);
  }
  
  console.log(`Generating ${count} records in ${language}...`);
  
  const people = [];
  
  for (let i = 0; i < count; i++) {
    people.push(generatePerson(i, language));
  }
  
  return people;
}

// Main function
function main() {
  // Generate the data
  const data = generateSampleData(numRecords, language);
  
  // Create a worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Create a workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'People');
  
  // Write to file
  const outputFile = path.join(dataDir, `sample-${language}-${numRecords}.xlsx`);
  XLSX.writeFile(wb, outputFile);
  
  console.log(`Generated ${numRecords} records in ${language}`);
  console.log(`Output file: ${outputFile}`);
}

// Export functions for use in other scripts
module.exports = {
  generateSampleData,
  generatePerson,
  generateId,
  generateBirthDate
};

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
} 