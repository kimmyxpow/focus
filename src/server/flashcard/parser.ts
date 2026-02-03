/**
 * File Parser Module
 * 
 * Parses PDF and DOCX files to extract text content
 */

import { PDFParse, type TextResult } from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Parse PDF file buffer to text
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result: TextResult = await parser.getText();
    
    // Get full text content
    const textContent = result.text || '';
    
    return textContent.trim();
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF file. Please ensure the file is not corrupted or password-protected.');
  }
}

/**
 * Parse DOCX file buffer to text
 */
export async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error('Failed to parse DOCX file. Please ensure the file is not corrupted.');
  }
}

/**
 * Parse file based on type
 */
export async function parseFile(buffer: Buffer, fileType: 'pdf' | 'docx' | 'txt'): Promise<string> {
  switch (fileType) {
    case 'pdf':
      return parsePdf(buffer);
    case 'docx':
      return parseDocx(buffer);
    case 'txt':
      return buffer.toString('utf-8').trim();
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
