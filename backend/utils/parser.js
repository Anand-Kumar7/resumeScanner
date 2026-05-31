const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');

/**
 * Extract plain text from a file buffer based on the file extension/mime type.
 * @param {Buffer} buffer - File contents
 * @param {string} originalName - Original filename with extension
 * @returns {Promise<string>} Extracted text
 */
async function parseResume(buffer, originalName) {
  const extension = path.extname(originalName).toLowerCase();

  switch (extension) {
    case '.pdf':
      return await parsePDF(buffer);
    case '.docx':
      return await parseDOCX(buffer);
    case '.doc':
      return await parseDOC(buffer);
    case '.txt':
      return buffer.toString('utf8');
    default:
      // Fallback: try to convert binary to string or parse as text
      return buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, '');
  }
}

/**
 * Parse PDF text
 */
async function parsePDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF parsing error:', error.message);
    throw new Error('Failed to parse PDF resume.');
  }
}

/**
 * Parse DOCX text using Mammoth
 */
async function parseDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer: buffer });
    return result.value || '';
  } catch (error) {
    console.error('DOCX parsing error:', error.message);
    throw new Error('Failed to parse DOCX resume.');
  }
}

/**
 * Parse DOC text
 * Pure Node.js parsing for old .doc format is complex without native bindings.
 * We will do a robust string extraction filter as a lightweight fallback.
 */
async function parseDOC(buffer) {
  try {
    // Attempt mammoth in case it is actually a DOCX file renamed to .doc
    try {
      const result = await mammoth.extractRawText({ buffer: buffer });
      if (result.value && result.value.trim().length > 100) {
        return result.value;
      }
    } catch (e) {
      // Not a disguised DOCX, continue to extraction
    }

    // Extract ASCII readable strings from OLE file
    const text = buffer.toString('binary');
    // Regex matches sequences of readable characters
    const cleanText = text
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleanText.length < 50) {
      throw new Error('Too little text extracted');
    }
    return cleanText;
  } catch (error) {
    console.warn('DOC parser fallback warning:', error.message);
    return 'Could not parse old binary .doc file fully. Please convert to PDF or DOCX.';
  }
}

module.exports = {
  parseResume
};
