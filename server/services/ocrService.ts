/**
 * OCR Service
 * 
 * Main service for document processing and text extraction.
 * Supports multiple OCR engines including LlamaParse.
 */

import { LineItem, HandwrittenNote } from '@shared/schema';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import { config } from '../config';
import { FieldConfidence, LayoutPosition, ProcessingMetadata } from '@shared/schema';
import llamaparseService from './llamaparseService';

const { OPENAI_API_KEY, LLAMAPARSE_API_KEY } = config;

// Initialize OpenAI client lazily
let openai: OpenAI | null = null;

// Log API keys status for debugging (but don't abort startup)
console.log(`OPENAI_API_KEY ${OPENAI_API_KEY ? 'is set' : 'is not set'}`);
console.log(`LLAMAPARSE_API_KEY ${LLAMAPARSE_API_KEY ? 'is set' : 'is not set'}`);

// Export the LlamaParse result interface
export type { LlamaParseResult } from './llamaparseService';

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
  
  // Metadata
  confidenceScores: any;
  layoutData: any[];
  processingMetadata: any;
  
  // Export formats
  markdownOutput?: string;
  jsonOutput?: string;
}

// Helper to get MIME type from file extension
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.tiff': 'image/tiff',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

// Parses handwritten notes from OpenAI Vision response
function parseHandwrittenNotes(visionResponse: string): HandwrittenNote[] {
  try {
    // Simple regex pattern to extract handwritten notes
    const handwrittenPattern = /handwritten note:?\s*"([^"]+)"/gi;
    const notes: HandwrittenNote[] = [];
    let match;
    
    while ((match = handwrittenPattern.exec(visionResponse)) !== null) {
      notes.push({
        text: match[1],
        confidence: 70 // Default confidence for OpenAI Vision extracted notes
      });
    }
    
    // If no matches found with pattern, take the whole text as one note if it mentions handwriting
    if (notes.length === 0 && visionResponse.toLowerCase().includes('handwrit')) {
      notes.push({
        text: visionResponse.slice(0, 200) + (visionResponse.length > 200 ? '...' : ''),
        confidence: 60
      });
    }
    
    return notes;
  } catch (error) {
    console.error('Error parsing handwritten notes:', error);
    return [];
  }
}

export async function processDocument(filePath: string, service: string = 'llamaparse'): Promise<OCRResult> {
  console.log(`Processing document with file extension: ${filePath.split('.').pop()} using ${service}`);

  if (service !== 'llamaparse') {
    throw new Error('Currently only LlamaParse service is supported');
  }

  try {
    // First pass: Use LlamaParse for structured data extraction
    const llamaparseResult = await llamaparseService.processDocument(filePath);

    // Second pass: Use OpenAI Vision for handwritten notes and additional context
    const fileBuffer = fs.readFileSync(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    const base64Image = fileBuffer.toString('base64');

    // Initialize OpenAI client if needed
    if (!openai && OPENAI_API_KEY) {
      openai = new OpenAI({
        apiKey: OPENAI_API_KEY
      });
    }
    
    if (!openai) {
      console.error('OpenAI client is not initialized. Please check OPENAI_API_KEY environment variable.');
      throw new Error('OpenAI client is not initialized. Please check OPENAI_API_KEY environment variable.');
    }
    
    // For TypeScript's benefit
    const openaiClient: OpenAI = openai;

    // Process handwritten notes with OpenAI Vision
    const visionResponse = await openaiClient.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this invoice and extract any handwritten notes or annotations. Also verify the extracted data for accuracy. Focus on: 1) Handwritten notes 2) Any special instructions or annotations 3) Verification of key invoice fields"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${getMimeType(fileExtension)};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    // Extract handwritten notes
    const handwrittenNotes = parseHandwrittenNotes(visionResponse.choices[0].message.content || '');
    
    // Update confidence scores with handwritten notes
    const updatedConfidenceScores = llamaparseService.updateHandwrittenNotesConfidence(
      llamaparseResult.confidenceScores,
      handwrittenNotes
    );

    // Create the final result
    const result: OCRResult = {
      ...llamaparseResult,
      handwrittenNotes,
      confidenceScores: updatedConfidenceScores
    };
    
    // Generate markdown and JSON outputs
    result.markdownOutput = llamaparseService.generateMarkdownOutput(result);
    result.jsonOutput = llamaparseService.generateJSONOutput(result);
    
    return result;
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
}

export default {
  processDocument
};