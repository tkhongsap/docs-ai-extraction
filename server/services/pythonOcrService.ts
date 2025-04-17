/**
 * Python OCR Service
 * 
 * Handles communication with the Python OCR API Server
 * and provides a fallback mechanism for document processing.
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { spawn } from 'child_process';

// Python OCR API base URL from config
const PYTHON_OCR_API_URL = config.PYTHON_OCR_API_URL;

// Flag to track if we've tried starting the Python OCR server
let hasPythonServerStartAttempt = false;

/**
 * Start the Python OCR server if it's not already running
 * @returns Promise that resolves when server startup is attempted
 */
export async function ensurePythonOcrServerRunning(): Promise<boolean> {
  // Don't try to start more than once per session
  if (hasPythonServerStartAttempt) {
    return true;
  }
  
  try {
    // First, check if server is already running
    console.log('Checking if Python OCR server is running...');
    
    try {
      const response = await axios.get(`${PYTHON_OCR_API_URL}/health`, { timeout: 2000 });
      if (response.status === 200) {
        console.log('Python OCR server is already running.');
        hasPythonServerStartAttempt = true;
        return true;
      }
    } catch (error) {
      console.log('Python OCR server is not running, attempting to start it...');
    }
    
    // Start Python OCR server
    const pythonProcess = spawn('bash', [path.join(process.cwd(), 'start_python_ocr.sh')], {
      detached: true, // Allow the process to run independently
      stdio: 'ignore', // Detach stdio
    });
    
    // Don't wait for process to exit
    pythonProcess.unref();
    
    console.log('Python OCR server starting in background...');
    
    // Wait a few seconds for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Mark that we've attempted to start the server
    hasPythonServerStartAttempt = true;
    
    // Try to verify the server started
    try {
      const healthResponse = await axios.get(`${PYTHON_OCR_API_URL}/health`, { timeout: 2000 });
      if (healthResponse.status === 200) {
        console.log('Python OCR server started successfully.');
        return true;
      } else {
        console.log('Python OCR server may not have started correctly.');
        return false;
      }
    } catch (error) {
      console.log('Could not verify Python OCR server started, but we did attempt to start it.');
      return false;
    }
  } catch (error) {
    console.error('Error starting Python OCR server:', error);
    return false;
  }
}

/**
 * Process a document using the Python OCR API
 * @param filePath Path to document file
 * @param service OCR service to use (openai, mistral, or ms-document-intelligence)
 * @returns OCR result
 */
export async function processPythonOcr(filePath: string, service: string = 'openai'): Promise<any> {
  // Ensure Python OCR server is running
  await ensurePythonOcrServerRunning();
  
  console.log(`Processing document with ${service} via Python OCR API`);
  
  try {
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    const mimeType = getMimeType(fileExtension);
    
    // Create form data with file
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: mimeType
    });
    
    // Determine endpoint based on service
    let endpoint = '';
    switch(service) {
      case 'openai':
        endpoint = `${PYTHON_OCR_API_URL}/openai-ocr`;
        break;
      case 'mistral':
        endpoint = `${PYTHON_OCR_API_URL}/mistral-ocr`;
        break;
      case 'ms-document-intelligence':
        endpoint = `${PYTHON_OCR_API_URL}/ms-azure-ocr`;
        break;
      default:
        endpoint = `${PYTHON_OCR_API_URL}/openai-ocr`; // Default to OpenAI
    }
    
    console.log(`Sending document to Python OCR API at: ${endpoint}`);
    
    // Send request to Python API
    const response = await axios.post(endpoint, formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000 // 60 second timeout
    });
    
    console.log(`Received response from OCR API for ${service} service`);
    return response.data;
  } catch (error: any) {
    console.error(`Error processing document with ${service}:`, error);
    
    // Enhance error message with service-specific details
    if (error.response) {
      throw new Error(`OCR service error (${service}): ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error(`Network error when connecting to OCR service (${service}). Is the Python API running?`);
    }
    
    throw error;
  }
}

// Helper function to get MIME type from file extension
function getMimeType(extension: string): string {
  const ext = extension.toLowerCase().replace('.', '');
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'tiff': return 'image/tiff';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default: return 'application/octet-stream';
  }
}

export default {
  processPythonOcr,
  ensurePythonOcrServerRunning
};