/**
 * Excel Parser Module
 * 
 * This module is responsible for parsing Excel files and converting them
 * to a structured format that can be saved to the database.
 * It supports multiple languages including French, English, Russian, Arabic, and Chinese.
 */

const XLSX = require('xlsx');
const { logger } = require('./logger');

/**
 * Map of common header names in different languages to standardized field names
 */
const HEADER_MAPPINGS = {
  // French
  'matricule': 'external_id',
  'identifiant': 'external_id',
  'id_fr': 'external_id',
  'nom': 'last_name',
  'prenom': 'first_name',
  'nom et prenom': 'name',
  'nom_et_prenom': 'name',
  'datedenaissance': 'birth_date',
  'date de naissance': 'birth_date',
  'date_de_naissance': 'birth_date',
  'courriel': 'email',
  'adresse courriel': 'email',
  'adresse_courriel': 'email',
  'telephone': 'phone',
  'numero de telephone': 'phone',
  'numero_de_telephone': 'phone',
  'adresse': 'address',
  'ville': 'city',
  'etat': 'state',
  'code_postal': 'zip',
  'pays': 'country',
  'entreprise': 'company',
  'titre': 'job_title',
  'departement': 'department',
  'status_fr': 'status',
  'statut': 'status',
  
  // English
  'id': 'external_id',
  'identifier': 'external_id',
  'name': 'name',
  'full name': 'name',
  'fullname': 'name',
  'full_name': 'name',
  'first name': 'first_name',
  'first_name': 'first_name',
  'firstname': 'first_name',
  'last name': 'last_name',
  'last_name': 'last_name',
  'lastname': 'last_name',
  'email': 'email',
  'email address': 'email',
  'email_address': 'email',
  'phone': 'phone',
  'phone number': 'phone',
  'phone_number': 'phone',
  'address': 'address',
  'city': 'city',
  'state': 'state',
  'zip': 'zip',
  'zip code': 'zip',
  'zip_code': 'zip',
  'postal code': 'zip',
  'postal_code': 'zip',
  'country': 'country',
  'company': 'company',
  'job title': 'job_title',
  'job_title': 'job_title',
  'department': 'department',
  'birth date': 'birth_date',
  'birth_date': 'birth_date',
  'date of birth': 'birth_date',
  'date_of_birth': 'birth_date',
  'status': 'status',
  
  // Additional English variations with different casing
  'ID': 'external_id',
  'Id': 'external_id',
  'Name': 'name',
  'Full Name': 'name',
  'FullName': 'name',
  'First Name': 'first_name',
  'FirstName': 'first_name',
  'Last Name': 'last_name',
  'LastName': 'last_name',
  'Email': 'email',
  'Email Address': 'email',
  'Phone': 'phone',
  'Phone Number': 'phone',
  'Address': 'address',
  'City': 'city',
  'State': 'state',
  'Zip': 'zip',
  'Zip Code': 'zip',
  'Postal Code': 'zip',
  'Country': 'country',
  'Company': 'company',
  'Job Title': 'job_title',
  'Department': 'department',
  'Birth Date': 'birth_date',
  'BirthDate': 'birth_date',
  'Date of Birth': 'birth_date',
  'DOB': 'birth_date',
  'Status': 'status',
  
  // Russian
  'идентификатор': 'external_id',
  'фамилия': 'last_name',
  'имя': 'first_name',
  'полное имя': 'name',
  'полное_имя': 'name',
  'дата рождения': 'birth_date',
  'дата_рождения': 'birth_date',
  'электронная почта': 'email',
  'электронная_почта': 'email',
  'телефон': 'phone',
  'номер телефона': 'phone',
  'номер_телефона': 'phone',
  'адрес': 'address',
  'город': 'city',
  'область': 'state',
  'почтовый индекс': 'zip',
  'почтовый_индекс': 'zip',
  'страна': 'country',
  'компания': 'company',
  'должность': 'job_title',
  'отдел': 'department',
  'статус': 'status',
  
  // Arabic
  'رقم_التعريف': 'external_id',
  'معرف': 'external_id',
  'اسم_العائلة': 'last_name',
  'الاسم_الأول': 'first_name',
  'الاسم_الكامل': 'name',
  'تاريخ_الميلاد': 'birth_date',
  'البريد_الإلكتروني': 'email',
  'هاتف': 'phone',
  'رقم_الهاتف': 'phone',
  'عنوان': 'address',
  'مدينة': 'city',
  'ولاية': 'state',
  'الرمز_البريدي': 'zip',
  'بلد': 'country',
  'شركة': 'company',
  'المسمى_الوظيفي': 'job_title',
  'قسم': 'department',
  'الحالة': 'status',
  
  // Chinese
  '标识符': 'external_id',
  '姓': 'last_name',
  '名': 'first_name',
  '全名': 'name',
  '出生日期': 'birth_date',
  '电子邮件': 'email',
  '电话': 'phone',
  '电话号码': 'phone',
  '地址': 'address',
  '城市': 'city',
  '州': 'state',
  '邮政编码': 'zip',
  '国家': 'country',
  '公司': 'company',
  '职位': 'job_title',
  '部门': 'department',
  '状态': 'status'
};

/**
 * Parse an Excel file and extract people data
 * 
 * @param {string} filePath - Path to the Excel file
 * @param {Object} options - Options for parsing
 * @param {boolean} options.useStreaming - Whether to use streaming for large files
 * @param {number} options.chunkSize - Size of chunks when processing large files
 * @returns {Promise<Array>} - Array of people objects
 */
async function parseExcel(filePath, options = {}) {
  try {
    logger.info(`Parsing Excel file: ${filePath}`);
    
    // For very large files, use the streaming approach
    if (options.useStreaming) {
      return await parseExcelStreaming(filePath, options);
    }
    
    // Read the Excel file with options to minimize memory usage
    const workbook = XLSX.readFile(filePath, {
      cellFormula: false, // Don't parse formulas
      cellHTML: false,    // Don't parse HTML
      cellStyles: false,  // Don't parse styles
      cellDates: true,    // Convert dates
      dense: true,        // Use dense array format (uses less memory)
      sheetStubs: false   // Don't create stubs for empty cells
    });
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert the sheet to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (rawData.length < 2) {
      throw new Error('Excel file does not contain enough data. Expected at least a header row and one data row.');
    }
    
    // Extract headers (first row)
    const originalHeaders = rawData[0].map(header => 
      header ? header.toString().trim() : ''
    );
    
    // Create a case-insensitive mapping function
    const mapHeader = (header) => {
      // First try exact match
      if (HEADER_MAPPINGS[header]) {
        return HEADER_MAPPINGS[header];
      }
      
      // Try lowercase match
      const lowerHeader = header.toLowerCase();
      if (HEADER_MAPPINGS[lowerHeader]) {
        return HEADER_MAPPINGS[lowerHeader];
      }
      
      // Try lowercase with spaces replaced by underscores
      const normalizedHeader = lowerHeader.replace(/\s+/g, '_');
      if (HEADER_MAPPINGS[normalizedHeader]) {
        return HEADER_MAPPINGS[normalizedHeader];
      }
      
      // If no mapping found, use the normalized header
      return normalizedHeader;
    };
    
    // Map headers to standardized field names
    const mappedHeaders = originalHeaders.map(mapHeader);
    
    logger.debug('Original headers:', { headers: originalHeaders });
    logger.debug('Mapped headers:', { headers: mappedHeaders });
    
    // Check for required headers based on the sample CSV format
    const requiredHeaders = ['external_id', 'last_name', 'first_name', 'birth_date', 'status'];
    const missingHeaders = requiredHeaders.filter(header => !mappedHeaders.includes(header));
    
    if (missingHeaders.length > 0) {
      logger.warn(`Excel file missing some standard headers: ${missingHeaders.join(', ')}`);
      logger.info('Will attempt to process with available fields');
    }
    
    // Check if we have enough information to identify a person
    // We need at least one of: name, first_name+last_name, email, or external_id
    const hasName = mappedHeaders.includes('name');
    const hasFirstName = mappedHeaders.includes('first_name');
    const hasLastName = mappedHeaders.includes('last_name');
    const hasEmail = mappedHeaders.includes('email');
    const hasId = mappedHeaders.includes('external_id');
    
    const hasNameComponents = hasFirstName && hasLastName;
    
    if (!hasName && !hasNameComponents && !hasEmail && !hasId) {
      throw new Error('Excel file does not contain enough information to identify people. Need at least one of: name, first_name+last_name, email, or external_id.');
    }
    
    // Process data rows (skip header row)
    const people = rawData.slice(1)
      .filter(row => row.length > 0 && row.some(cell => cell !== undefined && cell !== null && cell !== ''))
      .map(row => {
        const person = {};
        
        // Map each cell to its corresponding standardized header
        mappedHeaders.forEach((header, index) => {
          if (index < row.length && header) {
            person[header] = row[index] !== undefined ? row[index].toString() : '';
          }
        });
        
        // Combine first and last name if we have both but no full name
        if (!person.name && person.first_name && person.last_name) {
          person.name = `${person.last_name} ${person.first_name}`.trim();
        }
        
        // Special case for French format: if we have both 'nom' and 'prenom' columns mapped to last_name and first_name
        if (!hasName && hasFirstName && hasLastName) {
          const lastNameIndex = mappedHeaders.indexOf('last_name');
          const firstNameIndex = mappedHeaders.indexOf('first_name');
          
          if (lastNameIndex >= 0 && firstNameIndex >= 0 && lastNameIndex < row.length && firstNameIndex < row.length) {
            const lastName = row[lastNameIndex] !== undefined ? row[lastNameIndex].toString() : '';
            const firstName = row[firstNameIndex] !== undefined ? row[firstNameIndex].toString() : '';
            person.name = `${lastName} ${firstName}`.trim();
          }
        }
        
        return person;
      });
    
    logger.info(`Successfully parsed ${people.length} records from Excel file`);
    return people;
  } catch (error) {
    logger.error('Error parsing Excel file', { error: error.message });
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
}

/**
 * Parse an Excel file using a streaming approach for large files
 * 
 * @param {string} filePath - Path to the Excel file
 * @param {Object} options - Options for parsing
 * @returns {Promise<Array>} - Array of people objects
 */
async function parseExcelStreaming(filePath, options = {}) {
  try {
    logger.info(`Parsing Excel file using streaming approach: ${filePath}`);
    
    // First, read the file headers to get the column mappings
    const headerWorkbook = XLSX.readFile(filePath, {
      sheetRows: 1, // Only read the first row (headers)
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      cellDates: true,
      dense: true,
      sheetStubs: false
    });
    
    const sheetName = headerWorkbook.SheetNames[0];
    const headerWorksheet = headerWorkbook.Sheets[sheetName];
    const headerRow = XLSX.utils.sheet_to_json(headerWorksheet, { header: 1 })[0];
    
    // Map headers
    const originalHeaders = headerRow.map(header => 
      header ? header.toString().trim() : ''
    );
    
    // Create a case-insensitive mapping function
    const mapHeader = (header) => {
      // First try exact match
      if (HEADER_MAPPINGS[header]) {
        return HEADER_MAPPINGS[header];
      }
      
      // Try lowercase match
      const lowerHeader = header.toLowerCase();
      if (HEADER_MAPPINGS[lowerHeader]) {
        return HEADER_MAPPINGS[lowerHeader];
      }
      
      // Try lowercase with spaces replaced by underscores
      const normalizedHeader = lowerHeader.replace(/\s+/g, '_');
      if (HEADER_MAPPINGS[normalizedHeader]) {
        return HEADER_MAPPINGS[normalizedHeader];
      }
      
      // If no mapping found, use the normalized header
      return normalizedHeader;
    };
    
    const mappedHeaders = originalHeaders.map(mapHeader);
    
    logger.debug('Original headers:', { headers: originalHeaders });
    logger.debug('Mapped headers:', { headers: mappedHeaders });
    
    // Check for required headers
    const requiredHeaders = ['external_id', 'last_name', 'first_name', 'birth_date', 'status'];
    const missingHeaders = requiredHeaders.filter(header => !mappedHeaders.includes(header));
    
    if (missingHeaders.length > 0) {
      logger.warn(`Excel file missing some standard headers: ${missingHeaders.join(', ')}`);
      logger.info('Will attempt to process with available fields');
    }
    
    // Check if we have enough information to identify a person
    const hasName = mappedHeaders.includes('name');
    const hasFirstName = mappedHeaders.includes('first_name');
    const hasLastName = mappedHeaders.includes('last_name');
    const hasEmail = mappedHeaders.includes('email');
    const hasId = mappedHeaders.includes('external_id');
    
    const hasNameComponents = hasFirstName && hasLastName;
    
    if (!hasName && !hasNameComponents && !hasEmail && !hasId) {
      throw new Error('Excel file does not contain enough information to identify people. Need at least one of: name, first_name+last_name, email, or external_id.');
    }
    
    // Now read the data in chunks
    const chunkSize = options.chunkSize || 1000;
    const people = [];
    
    // Function to process a chunk of rows
    const processChunk = (startRow, endRow) => {
      const chunkWorkbook = XLSX.readFile(filePath, {
        sheetRows: endRow,
        cellFormula: false,
        cellHTML: false,
        cellStyles: false,
        cellDates: true,
        dense: true,
        sheetStubs: false
      });
      
      const chunkSheetName = chunkWorkbook.SheetNames[0];
      const chunkWorksheet = chunkWorkbook.Sheets[chunkSheetName];
      const chunkData = XLSX.utils.sheet_to_json(chunkWorksheet, { header: 1 });
      
      // Skip the header row and any rows before startRow
      const rowsToProcess = chunkData.slice(startRow);
      
      return rowsToProcess
        .filter(row => row.length > 0 && row.some(cell => cell !== undefined && cell !== null && cell !== ''))
        .map(row => {
          const person = {};
          
          // Map each cell to its corresponding standardized header
          mappedHeaders.forEach((header, index) => {
            if (index < row.length && header) {
              person[header] = row[index] !== undefined ? row[index].toString() : '';
            }
          });
          
          // Combine first and last name if we have both but no full name
          if (!person.name && person.first_name && person.last_name) {
            person.name = `${person.last_name} ${person.first_name}`.trim();
          }
          
          // Special case for French format
          if (!hasName && hasFirstName && hasLastName) {
            const lastNameIndex = mappedHeaders.indexOf('last_name');
            const firstNameIndex = mappedHeaders.indexOf('first_name');
            
            if (lastNameIndex >= 0 && firstNameIndex >= 0 && lastNameIndex < row.length && firstNameIndex < row.length) {
              const lastName = row[lastNameIndex] !== undefined ? row[lastNameIndex].toString() : '';
              const firstName = row[firstNameIndex] !== undefined ? row[firstNameIndex].toString() : '';
              person.name = `${lastName} ${firstName}`.trim();
            }
          }
          
          return person;
        });
    };
    
    // Get the total number of rows
    const infoWorkbook = XLSX.readFile(filePath, {
      sheetRows: 0, // Just get sheet info, not the data
      cellFormula: false,
      cellHTML: false,
      cellStyles: false
    });
    
    const sheetRef = infoWorkbook.Sheets[sheetName]['!ref'];
    const range = XLSX.utils.decode_range(sheetRef);
    const totalRows = range.e.r + 1;
    
    logger.info(`Excel file has ${totalRows} rows, processing in chunks of ${chunkSize}`);
    
    // Process in chunks
    for (let startRow = 1; startRow < totalRows; startRow += chunkSize) {
      const endRow = Math.min(startRow + chunkSize, totalRows);
      logger.info(`Processing rows ${startRow} to ${endRow}`);
      
      const chunk = processChunk(startRow, endRow);
      people.push(...chunk);
      
      // Free memory
      if (global.gc) {
        global.gc();
      }
    }
    
    logger.info(`Successfully parsed ${people.length} records from Excel file using streaming approach`);
    return people;
  } catch (error) {
    logger.error('Error parsing Excel file with streaming', { error: error.message });
    throw new Error(`Failed to parse Excel file with streaming: ${error.message}`);
  }
}

module.exports = {
  parseExcel,
  parseExcelStreaming,
  HEADER_MAPPINGS // Export for testing
}; 