/**
 * OCR Service
 * 
 * Main service for document processing and text extraction.
 * Supports LlamaParse OCR engine via Python wrapper.
 */

import { LineItem, HandwrittenNote } from '@shared/schema';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { config } from '../config';
import { FieldConfidence, LayoutPosition, ProcessingMetadata } from '@shared/schema';

// Use Python wrapper service
// Make sure this is the correct path to your wrapper
import llamaparseWrapperService from './llamaparseWrapperService';

const { OPENAI_API_KEY, LLAMAPARSE_API_KEY } = config;

// Initialize OpenAI client lazily
let openai: OpenAI | null = null;

// Log API keys status for debugging (but don't abort startup)
console.log(`OPENAI_API_KEY ${OPENAI_API_KEY ? 'is set' : 'is not set'}`);
console.log(`LLAMAPARSE_API_KEY ${LLAMAPARSE_API_KEY ? 'is set' : 'is not set'}`);

// Export the LlamaParse result interface
export type { LlamaParseResult } from './llamaparseWrapperService';

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

  // Read file once to avoid multiple disk reads
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

  let result: OCRResult;

  try {
    if (service === 'llamaparse') {
      console.log("Processing document with LlamaParse Python wrapper...");
      
      // Use the Python-based wrapper instead of direct API calls
      const llamaparseResult = await llamaparseWrapperService.processDocument(filePath);
      
      // Process handwritten notes with OpenAI Vision if needed
      let handwrittenNotes: HandwrittenNote[] = [];
      let updatedConfidenceScores = llamaparseResult.confidenceScores;
      
      try {
        console.log("Processing handwritten notes with OpenAI Vision...");
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
        handwrittenNotes = parseHandwrittenNotes(visionResponse.choices[0].message.content || '');
        
        // Update confidence scores with handwritten notes
        if (handwrittenNotes.length > 0) {
          // Simple confidence scoring when we find handwritten notes
          updatedConfidenceScores = {
            ...llamaparseResult.confidenceScores,
            handwrittenNotes: 80,
            overall: Math.min(
              Math.round((llamaparseResult.confidenceScores.overall * 0.9) + 8),
              100
            )
          };
        }
      } catch (error) {
        // If OpenAI Vision fails for handwritten notes, it's not critical - proceed with empty handwritten notes
        console.log("Warning: Could not process handwritten notes. Will continue without them:", error);
        handwrittenNotes = [];
      }

      // Create the result from LlamaParse
      result = {
        ...llamaparseResult,
        handwrittenNotes,
        confidenceScores: updatedConfidenceScores
      };
      
      console.log("Successfully processed document with LlamaParse Python wrapper");
    } else {
      throw new Error('Currently only LlamaParse service is supported');
    }
    
    // Generate markdown and JSON outputs
    result.markdownOutput = llamaparseWrapperService.generateMarkdownOutput(result);
    result.jsonOutput = llamaparseWrapperService.generateJSONOutput(result);
    
    return result;
  } catch (error) {
    console.error('Error processing document with LlamaParse:', error);
    throw error;
  }
}

export default {
  processDocument
};