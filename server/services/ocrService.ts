/**
 * OCR Service
 * 
 * Main service for document processing and text extraction.
 * Supports multiple OCR engines via Python FastAPI endpoints.
 */

import { LineItem, HandwrittenNote } from '@shared/schema';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { FieldConfidence, LayoutPosition, ProcessingMetadata } from '@shared/schema';

// Default interface for OCR result
import llamaparseWrapperService from './llamaparseWrapperService';

// Get API keys from config for logging
const { OPENAI_API_KEY, AZURE_DOC_INTELLIGENCE_KEY, MISTRAL_API_KEY } = config;

// Log API keys status for debugging (but don't abort startup)
console.log(`OPENAI_API_KEY ${OPENAI_API_KEY ? 'is set' : 'is not set'}`);
console.log(`AZURE_DOC_INTELLIGENCE_KEY ${AZURE_DOC_INTELLIGENCE_KEY ? 'is set' : 'is not set'}`);
console.log(`MISTRAL_API_KEY ${MISTRAL_API_KEY ? 'is set' : 'is not set'}`);

// Export the LlamaParse result interface for compatibility
export type { LlamaParseResult } from './llamaparseWrapperService';

// Python OCR API base URL from config
const PYTHON_OCR_API_URL = config.PYTHON_OCR_API_URL;

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

// Type for OCR result
export interface OCRResult {
  // Basic invoice fields
  vendorName?: string;
  vendorAddress?: string;
  vendorContact?: string;
  clientName?: string;
  clientAddress?: string;
  invoiceNumber?: string;
  invoiceDate?: Date;
  dueDate?: Date;
  totalAmount?: number;
  subtotalAmount?: number;
  taxAmount?: number;
  discountAmount?: number;
  currency?: string;
  paymentTerms?: string;
  paymentMethod?: string;
  
  // Structured data
  lineItems: any[];
  handwrittenNotes: HandwrittenNote[];
  
  // Additional information extracted
  additionalInfo?: string;
  
  // Metadata
  confidenceScores: any;
  layoutData: any[];
  processingMetadata: any;
  
  // Export formats
  markdownOutput?: string;
  jsonOutput?: string;
}

// Function to normalize results from different OCR services to a common format
function normalizeOCRResult(rawResult: any, service: string): OCRResult {
  // Default confidence scores
  const defaultConfidenceScores = {
    overall: 80,
    vendorInfo: 80,
    invoiceDetails: 80,
    lineItems: 80,
    totals: 80,
    handwrittenNotes: 50,
    fieldSpecific: {}
  };

  // Default processing metadata
  const processingMetadata = {
    ocrEngine: service,
    processingTime: 0,
    processingTimestamp: new Date().toISOString(),
    documentClassification: 'invoice'
  };

  // Initialize normalized result with default values
  const normalized: OCRResult = {
    vendorName: rawResult.vendorName || '',
    vendorAddress: rawResult.vendorAddress || '',
    vendorContact: rawResult.vendorContact || '',
    clientName: rawResult.clientName || '',
    clientAddress: rawResult.clientAddress || '',
    invoiceNumber: rawResult.invoiceNumber || '',
    invoiceDate: rawResult.invoiceDate ? new Date(rawResult.invoiceDate) : undefined,
    dueDate: rawResult.dueDate ? new Date(rawResult.dueDate) : undefined,
    totalAmount: typeof rawResult.totalAmount === 'number' ? rawResult.totalAmount : 
                 (typeof rawResult.totalAmount === 'string' ? parseFloat(rawResult.totalAmount) : undefined),
    subtotalAmount: typeof rawResult.subtotalAmount === 'number' ? rawResult.subtotalAmount : 
                   (typeof rawResult.subtotalAmount === 'string' ? parseFloat(rawResult.subtotalAmount) : undefined),
    taxAmount: typeof rawResult.taxAmount === 'number' ? rawResult.taxAmount : 
               (typeof rawResult.taxAmount === 'string' ? parseFloat(rawResult.taxAmount) : undefined),
    discountAmount: rawResult.discountAmount,
    currency: rawResult.currency || '',
    paymentTerms: rawResult.paymentTerms || '',
    paymentMethod: rawResult.paymentMethod || '',
    
    // Ensure lineItems is always an array
    lineItems: Array.isArray(rawResult.lineItems) ? rawResult.lineItems : [],
    
    // Ensure handwrittenNotes is always an array
    handwrittenNotes: Array.isArray(rawResult.handwrittenNotes) ? rawResult.handwrittenNotes : [],
    
    // Additional info
    additionalInfo: rawResult.additionalInfo || '',
    
    // Metadata with defaults
    confidenceScores: rawResult.confidenceScores || defaultConfidenceScores,
    layoutData: rawResult.layoutData || [],
    processingMetadata: rawResult.processingMetadata || processingMetadata
  };

  return normalized;
}

// Import Python OCR Service
import pythonOcrService from './pythonOcrService';

export async function processDocument(filePath: string, service: string = 'openai'): Promise<OCRResult> {
  console.log(`Processing document with file extension: ${filePath.split('.').pop()} using ${service}`);

  try {
    // Ensure Python OCR server is running
    await pythonOcrService.ensurePythonOcrServerRunning();
    
    // Process document with Python OCR service
    const rawResult = await pythonOcrService.processPythonOcr(filePath, service);
    
    // Normalize result to common format
    const result = normalizeOCRResult(rawResult, service);
    
    // Generate markdown and JSON outputs
    result.markdownOutput = llamaparseWrapperService.generateMarkdownOutput(result);
    result.jsonOutput = llamaparseWrapperService.generateJSONOutput(result);
    
    return result;
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

export default {
  processDocument
};