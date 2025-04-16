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
  let usedFallback = false;

  try {
    if (service === 'llamaparse') {
      try {
        // First attempt: Try LlamaParse for structured data extraction
        console.log("Attempting to process document with LlamaParse...");
        const llamaparseResult = await llamaparseService.processDocument(filePath);
        
        // Process handwritten notes with OpenAI Vision
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
        const handwrittenNotes = parseHandwrittenNotes(visionResponse.choices[0].message.content || '');
        
        // Update confidence scores with handwritten notes
        const updatedConfidenceScores = llamaparseService.updateHandwrittenNotesConfidence(
          llamaparseResult.confidenceScores,
          handwrittenNotes
        );

        // Create the result from LlamaParse
        result = {
          ...llamaparseResult,
          handwrittenNotes,
          confidenceScores: updatedConfidenceScores
        };
        
        console.log("Successfully processed document with LlamaParse + OpenAI Vision for notes");
      } catch (error) {
        // LlamaParse failed - fall back to OpenAI Vision
        const llamaparseError = error as Error;
        console.error("LlamaParse processing failed, falling back to OpenAI Vision:", llamaparseError);
        usedFallback = true;
        
        // Now use OpenAI Vision as a fallback for everything
        const fullExtractionPrompt = `
        Please extract all information from this invoice/document. 
        Structure your response in the following format:
        
        VENDOR:
        - Name: [vendor name]
        - Address: [vendor address]
        - Contact: [vendor contact info]
        
        CLIENT:
        - Name: [client name]
        - Address: [client address]
        
        INVOICE:
        - Invoice Number: [invoice/PO number]
        - Date: [date in YYYY-MM-DD format]
        - Due Date: [due date in YYYY-MM-DD format]
        - Total Amount: [total amount]
        - Subtotal: [subtotal amount]
        - Tax: [tax amount]
        - Currency: [currency]
        
        ITEMS:
        1. [description] | [quantity] | [unit price] | [amount]
        2. [description] | [quantity] | [unit price] | [amount]
        (continue for all line items)
        
        HANDWRITTEN NOTES:
        - [note 1]
        - [note 2]
        (list all handwritten annotations)
        
        ADDITIONAL INFO:
        [any other relevant information]
        `;
        
        console.log("Processing document with OpenAI Vision fallback...");
        const visionResponse = await openaiClient.chat.completions.create({
          model: "gpt-4-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: fullExtractionPrompt
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
          max_tokens: 2000
        });
        
        const extractionText = visionResponse.choices[0].message.content || '';
        console.log("OpenAI Vision extraction completed, parsing structured data...");
        
        // Parse the extraction text into structured data
        // Extract vendor information
        const vendorName = extractionText.match(/VENDOR:[\s\S]*?Name: (.*?)(?:\n|\r|$)/)?.[1] || '';
        const vendorAddress = extractionText.match(/VENDOR:[\s\S]*?Address: (.*?)(?:\n|\r|$)/)?.[1] || '';
        const vendorContact = extractionText.match(/VENDOR:[\s\S]*?Contact: (.*?)(?:\n|\r|$)/)?.[1] || '';
        
        // Extract client information
        const clientName = extractionText.match(/CLIENT:[\s\S]*?Name: (.*?)(?:\n|\r|$)/)?.[1] || '';
        const clientAddress = extractionText.match(/CLIENT:[\s\S]*?Address: (.*?)(?:\n|\r|$)/)?.[1] || '';
        
        // Extract invoice details
        const invoiceNumber = extractionText.match(/INVOICE:[\s\S]*?Invoice Number: (.*?)(?:\n|\r|$)/)?.[1] || '';
        const dateStr = extractionText.match(/INVOICE:[\s\S]*?Date: (.*?)(?:\n|\r|$)/)?.[1] || '';
        const dueDateStr = extractionText.match(/INVOICE:[\s\S]*?Due Date: (.*?)(?:\n|\r|$)/)?.[1] || '';
        const totalAmountStr = extractionText.match(/INVOICE:[\s\S]*?Total Amount: (.*?)(?:\n|\r|$)/)?.[1] || '';
        const subtotalStr = extractionText.match(/INVOICE:[\s\S]*?Subtotal: (.*?)(?:\n|\r|$)/)?.[1] || '';
        const taxStr = extractionText.match(/INVOICE:[\s\S]*?Tax: (.*?)(?:\n|\r|$)/)?.[1] || '';
        const currency = extractionText.match(/INVOICE:[\s\S]*?Currency: (.*?)(?:\n|\r|$)/)?.[1] || 'THB';
        
        // Parse dates
        const invoiceDate = dateStr ? new Date(dateStr) : undefined;
        const dueDate = dueDateStr ? new Date(dueDateStr) : undefined;
        
        // Parse amounts
        const totalAmount = parseFloat(totalAmountStr.replace(/[^0-9.-]+/g, '')) || undefined;
        const subtotalAmount = parseFloat(subtotalStr.replace(/[^0-9.-]+/g, '')) || undefined;
        const taxAmount = parseFloat(taxStr.replace(/[^0-9.-]+/g, '')) || undefined;
        
        // Extract line items
        const itemsSection = extractionText.match(/ITEMS:([\s\S]*?)(?:HANDWRITTEN NOTES:|ADDITIONAL INFO:|$)/)?.[1] || '';
        const itemRegex = /\d+\.\s+(.*?)\s*\|\s*(\d*\.?\d*)\s*\|\s*(\d*\.?\d*)\s*\|\s*(\d*\.?\d*)/g;
        const lineItems: LineItem[] = [];
        let itemMatch;
        
        while ((itemMatch = itemRegex.exec(itemsSection)) !== null) {
          const [_, description, quantity, unitPrice, amount] = itemMatch;
          lineItems.push({
            description: description.trim(),
            quantity: parseFloat(quantity) || 1,
            unitPrice: parseFloat(unitPrice) || 0,
            amount: parseFloat(amount) || 0,
            confidence: 70  // Default confidence for OpenAI extraction
          });
        }
        
        // Extract handwritten notes
        const notesSection = extractionText.match(/HANDWRITTEN NOTES:([\s\S]*?)(?:ADDITIONAL INFO:|$)/)?.[1] || '';
        const notesRegex = /-\s+(.*?)(?:\n|\r|$)/g;
        const handwrittenNotes: HandwrittenNote[] = [];
        let noteMatch;
        
        while ((noteMatch = notesRegex.exec(notesSection)) !== null) {
          const [_, noteText] = noteMatch;
          if (noteText.trim()) {
            handwrittenNotes.push({
              text: noteText.trim(),
              confidence: 70  // Default confidence for OpenAI extraction
            });
          }
        }
        
        // Extract additional info
        const additionalInfo = extractionText.match(/ADDITIONAL INFO:([\s\S]*?)$/)?.[1]?.trim() || '';
        
        // Create confidence scores
        const confidenceScores: FieldConfidence = {
          overall: 70,  // Default for OpenAI fallback
          vendorInfo: vendorName ? 75 : 60,
          invoiceDetails: invoiceNumber ? 75 : 60,
          lineItems: lineItems.length > 0 ? 75 : 60,
          totals: totalAmount ? 75 : 60,
          handwrittenNotes: handwrittenNotes.length > 0 ? 75 : 60,
          fieldSpecific: {
            vendor_name: vendorName ? 75 : 60,
            invoice_number: invoiceNumber ? 75 : 60,
            invoice_date: dateStr ? 75 : 60,
            total_amount: totalAmountStr ? 75 : 60
          }
        };
        
        // Create processing metadata
        const processingMetadata: ProcessingMetadata = {
          ocrEngine: 'OpenAI Vision (fallback)',
          processingTime: Date.now() - Date.now(), // Just a placeholder
          processingTimestamp: new Date().toISOString(),
          processingParams: {
            model: 'gpt-4-vision-preview',
            fallback: true,
            reason: llamaparseError?.message || 'LlamaParse processing failed'
          },
          documentClassification: 'Invoice/Document'
        };
        
        // Create the result from OpenAI Vision
        result = {
          vendorName,
          vendorAddress,
          vendorContact,
          clientName,
          clientAddress,
          invoiceNumber,
          invoiceDate,
          dueDate,
          totalAmount,
          subtotalAmount,
          taxAmount,
          currency,
          lineItems,
          handwrittenNotes,
          additionalInfo,
          confidenceScores,
          layoutData: [], // OpenAI Vision doesn't provide layout data
          processingMetadata
        };
        
        console.log(`Successfully processed document with OpenAI Vision fallback (${lineItems.length} line items extracted)`);
      }
    } else {
      throw new Error('Currently only LlamaParse service is supported');
    }
    
    // Generate markdown and JSON outputs
    result.markdownOutput = llamaparseService.generateMarkdownOutput(result);
    result.jsonOutput = llamaparseService.generateJSONOutput(result);
    
    // Log success with fallback status
    if (usedFallback) {
      console.log("Document processing completed using OpenAI Vision fallback mechanism");
    } else {
      console.log("Document processing completed using primary LlamaParse mechanism");
    }
    
    return result;
  } catch (error) {
    console.error('Error processing document with all available methods:', error);
    throw error;
  }
}

export default {
  processDocument
};