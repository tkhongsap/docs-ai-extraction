/**
 * File Utility Functions
 * 
 * This module provides reusable functions for file operations
 * used across the application.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { config } from '../config.js';

// Promisify common fs functions
const fsExists = promisify(fs.exists);
const fsMkdir = promisify(fs.mkdir);
const fsUnlink = promisify(fs.unlink);
const fsReadFile = promisify(fs.readFile);
const fsWriteFile = promisify(fs.writeFile);

/**
 * Ensures that a directory exists, creating it if needed
 * 
 * @param dirPath - The directory path to ensure
 * @returns A promise that resolves when the directory exists
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fsMkdir(dirPath, { recursive: true });
    console.log(`Directory ${dirPath} created or already exists.`);
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Safely deletes a file if it exists
 * 
 * @param filePath - The path of the file to delete
 * @returns A promise that resolves to true if the file was deleted, false if it didn't exist
 */
export async function safeDeleteFile(filePath: string): Promise<boolean> {
  try {
    const exists = await fsExists(filePath);
    if (exists) {
      await fsUnlink(filePath);
      console.log(`File deleted: ${filePath}`);
      return true;
    }
    console.log(`File not found for deletion: ${filePath}`);
    return false;
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Gets the absolute upload directory path
 * 
 * @returns The absolute path to the upload directory
 */
export function getUploadDir(): string {
  return path.isAbsolute(config.UPLOAD_DIR) 
    ? config.UPLOAD_DIR 
    : path.join(process.cwd(), config.UPLOAD_DIR);
}

/**
 * Check if a file is a valid PDF by checking its signature
 * 
 * @param filePath - Path to the PDF file
 * @returns Promise resolving to true if valid PDF, false otherwise
 */
export async function isValidPDF(filePath: string): Promise<boolean> {
  try {
    const buffer = await fsReadFile(filePath, { encoding: null, flag: 'r' });
    // Check for PDF signature (%PDF-)
    const isPDF = buffer.slice(0, 5).toString('ascii').startsWith('%PDF-');
    return isPDF;
  } catch (error) {
    console.error(`Error validating PDF file ${filePath}:`, error);
    return false;
  }
}

/**
 * Sanitizes a filename to ensure it's safe for storage
 * 
 * @param filename - The original filename
 * @returns A sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Convert from Buffer if necessary (from latin1 encoding as in multer config)
  const decodedName = typeof filename === 'string' 
    ? filename 
    : Buffer.from(filename, 'latin1').toString('utf8');
  
  // Replace problematic characters with dashes
  return decodedName.replace(/[/\\?%*:|"<>]/g, '-');
}

/**
 * Gets a file's MIME type based on its extension
 * 
 * @param filename - The filename to check
 * @returns The MIME type or null if unknown
 */
export function getMimeTypeFromFilename(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase().substring(1);
  
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp'
  };
  
  return mimeTypes[ext] || null;
} 