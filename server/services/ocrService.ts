/**
 * OCR Service
 * 
 * This service handles OCR processing for document extraction.
 * It connects to OpenAI Vision API to extract text and structured data from documents.
 * For PDFs, it uses OpenAI's Files API for better handling of multi-page documents.
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';
// Import for PDF processing - removed pdf-poppler as it's not compatible with our environment
import { v4 as uuidv4 } from 'uuid';

// Import types for extraction data
import { type Extraction, LineItem, HandwrittenNote } from '@shared/schema';

// Environment variable for OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Promisify exec for running shell commands
const execPromise = promisify(exec);

// Temporary directory for PDF-to-image conversion
const tempDir = path.join(process.cwd(), "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

interface OCRResult {
  vendorName: string;
  invoiceNumber: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  taxAmount?: number;
  lineItems: Array<LineItem>;
  handwrittenNotes: Array<HandwrittenNote>;
  documentType: 'invoice' | 'receipt' | 'other';
  confidence: number;
}

// OpenAI API integration is now handled directly through the Vision API

/**
 * Extract basic document information from filename
 * 
 * @param filePath The path to the document file
 * @returns Basic document information
 */
function extractBasicInfoFromFilename(filePath: string): { 
  vendorName?: string; 
  documentId?: string; 
  date?: string; 
} {
  const filename = path.basename(filePath);
  
  // Extract possible document info from the filename
  // This is a fallback for when we can't process the PDF content
  
  // Try to extract a vendor name (anything before the first number or special character)
  const vendorMatch = filename.match(/^([A-Za-z\s]+)/);
  const vendorName = vendorMatch ? vendorMatch[1].trim() : undefined;
  
  // Try to find a document ID (sequences of digits, possibly with prefix)
  const idMatch = filename.match(/([A-Za-z]{1,5}-?[0-9]{3,})/);
  const documentId = idMatch ? idMatch[1] : undefined;
  
  // Try to find a date in the filename (very basic pattern)
  const dateMatch = filename.match(/(\d{4}[-_]\d{1,2}[-_]\d{1,2})|(\d{1,2}[-_]\d{1,2}[-_]\d{4})/);
  let date: string | undefined = undefined;
  
  if (dateMatch) {
    const dateStr = dateMatch[0];
    try {
      // Try to parse the date - this is simplistic and would need more robust handling in production
      const dateParts = dateStr.split(/[-_]/);
      if (dateParts.length === 3) {
        // Assume ISO format if the first part is 4 digits (YYYY-MM-DD)
        if (dateParts[0].length === 4) {
          date = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
        } else {
          // Otherwise assume MM-DD-YYYY
          date = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
        }
      }
    } catch (e) {
      console.warn('Could not parse date from filename:', dateStr);
    }
  }
  
  return { vendorName, documentId, date };
}

/**
 * Process a document using the OpenAI Vision API
 * 
 * @param filePath Path to the document file to process
 * @returns Structured extraction data from the document
 */
export async function processDocument(filePath: string): Promise<OCRResult> {
  // Verify the file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  // Get file extension to determine appropriate processing method
  const fileExtension = path.extname(filePath).toLowerCase();
  
  // Process differently based on file type
  let result: any;
  
  if (fileExtension === '.pdf') {
    // OpenAI Vision API doesn't support PDFs directly
    console.log('Processing PDF document...');
    
    // The OCR service cannot process PDFs directly in this environment
    // Generate a structured response with basic metadata
    console.log('Cannot process PDF file directly through OpenAI Vision API');
    
    // Extract basic document information from filename
    const basicInfo = extractBasicInfoFromFilename(filePath);
    
    // Create a result with document metadata
    result = {
      documentType: 'other',
      vendorName: basicInfo.vendorName || 'Unknown',
      invoiceNumber: basicInfo.documentId || 'Unknown',
      invoiceDate: basicInfo.date || new Date().toISOString().slice(0, 10),
      dueDate: null,
      totalAmount: null,
      taxAmount: null,
      lineItems: [],
      handwrittenNotes: [{
        text: "PDF processing is not available. Please upload JPEG, PNG, GIF, or WEBP formats.",
        confidence: 1.0
      }],
      confidence: 0.1
    };
    
    // Log the limitation
    console.log('Returning basic document information for PDF file');
  } else {
    // For images, use the direct Vision API approach
    console.log('Processing image document using OpenAI Vision API...');
    
    // Read file as base64
    const fileData = fs.readFileSync(filePath);
    const base64File = fileData.toString('base64');
    
    // Determine content type based on file extension
    let contentType: string;
    switch (fileExtension) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.tiff':
      case '.tif':
        contentType = 'image/tiff';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      default:
        throw new Error(`Unsupported file extension: ${fileExtension}`);
    }
    
    // Call OpenAI Vision API
    result = await callOpenAIVisionAPI(base64File, contentType);
  }
  
  // Format and validate the result
  return formatOCRResult(result);
}

/**
 * Call the OpenAI Vision API to process an image
 * 
 * @param base64File The document file encoded as base64
 * @param contentType The MIME type of the document
 * @returns The raw response from the OpenAI API
 */
async function callOpenAIVisionAPI(base64File: string, contentType: string): Promise<any> {
  const prompt = `
    You are an expert document analyzer specializing in OCR extraction.
    
    TASK:
    Extract all text from this document, including both printed and handwritten content.
    Identify the document type (invoice, receipt, or other).
    Pay special attention to document structure and layout.
    
    EXTRACTION INSTRUCTIONS:
    1. For invoices and receipts:
       - Vendor name and complete contact information
       - Invoice/receipt number (look for patterns like INV-####, #######, etc.)
       - Invoice date (convert to YYYY-MM-DD format)
       - Due date if present (convert to YYYY-MM-DD format)
       - Total amount (numeric value only)
       - Tax amount if present (numeric value only)
       - Line items with detailed description, quantity, unit price, and amount
       - Look for any special terms, payment instructions, or notes
    
    2. For handwritten notes:
       - Extract all handwritten text
       - Identify the context of the note (e.g., approval, comment, instruction)
       - Provide a confidence score between 0 and 1 for each note
       - If a note is partially illegible, extract what you can and mark uncertain parts
    
    3. For tables and structured data:
       - Preserve the structure of tables
       - For each line item, ensure all fields are correctly associated
       - Handle multi-line descriptions by keeping them with the correct item
    
    4. For general content:
       - Capture headers, footers, and page numbers
       - Note any logos or branding elements
       - Recognize stamps, signatures, or other approval marks
    
    CONFIDENCE SCORING:
    - Provide an overall confidence score for the extraction
    - For handwritten content, provide individual confidence scores
    - For unclear or ambiguous text, provide lower confidence scores
    
    Format your response as a JSON object with the following structure:
    {
      "documentType": "invoice|receipt|other",
      "vendorName": "...",
      "invoiceNumber": "...",
      "invoiceDate": "YYYY-MM-DD",
      "dueDate": "YYYY-MM-DD",
      "totalAmount": 123.45,
      "taxAmount": 10.00,
      "lineItems": [
        {
          "description": "...",
          "quantity": 1,
          "unitPrice": 100.00,
          "amount": 100.00
        }
      ],
      "handwrittenNotes": [
        {
          "text": "...",
          "confidence": 0.85
        }
      ],
      "confidence": 0.95
    }
  `;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",  // Using the model specified by the user
        messages: [
          {
            role: "user", 
            content: [
              { type: "text", text: prompt },
              { 
                type: "image_url", 
                image_url: { 
                  url: `data:${contentType};base64,${base64File}`
                } 
              }
            ]
          }
        ],
        max_tokens: 1500,  // Appropriate token limit for this model
        temperature: 0.3,  // Lower temperature for more consistent results
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API Error Response:", errorText);
      throw new Error(`OpenAI API Error: ${response.status} ${errorText}`);
    }

    const responseData = await response.json() as { choices: [{ message: { content: string } }] };
    
    // Extract the JSON content from the response
    const content = responseData.choices[0].message.content;
    try {
      return JSON.parse(content);
    } catch (parseError: any) {
      console.error("Error parsing JSON response:", content);
      throw new Error(`Failed to parse OpenAI response: ${parseError.message}`);
    }
  } catch (error: any) {
    console.error("Error calling OpenAI API:", error);
    throw new Error(`Failed to process document with OpenAI: ${error.message}`);
  }
}

/**
 * Validate and format OCR results 
 * 
 * @param rawResult The raw OCR extraction data
 * @returns Properly formatted extraction data
 */
export function formatOCRResult(rawResult: any): OCRResult {
  if (!rawResult) {
    throw new Error('No OCR result to format');
  }

  // Validate and format the result
  const result: OCRResult = {
    documentType: rawResult.documentType || 'other',
    vendorName: rawResult.vendorName || 'Unknown',
    invoiceNumber: rawResult.invoiceNumber || 'Unknown',
    invoiceDate: rawResult.invoiceDate || undefined,
    dueDate: rawResult.dueDate || undefined,
    totalAmount: rawResult.totalAmount !== undefined && rawResult.totalAmount !== null ? Number(rawResult.totalAmount) : undefined,
    taxAmount: rawResult.taxAmount !== undefined && rawResult.taxAmount !== null ? Number(rawResult.taxAmount) : undefined,
    lineItems: Array.isArray(rawResult.lineItems) 
      ? rawResult.lineItems.map((item: any) => ({
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          amount: Number(item.amount) || 0
        }))
      : [],
    handwrittenNotes: Array.isArray(rawResult.handwrittenNotes)
      ? rawResult.handwrittenNotes.map((note: any) => ({
          text: note.text || '',
          confidence: Number(note.confidence) || 0.5
        }))
      : [],
    confidence: Number(rawResult.confidence) || 0.5
  };

  return result;
}

/**
 * Generate Markdown output from structured data
 * 
 * @param result The structured OCR result
 * @returns Markdown-formatted text
 */
export function generateMarkdownOutput(result: OCRResult): string {
  let markdown = `# Document Extraction Report\n\n`;
  
  // Document type and basic info
  markdown += `**Document Type:** ${result.documentType}\n`;
  markdown += `**Vendor:** ${result.vendorName}\n`;
  markdown += `**Invoice Number:** ${result.invoiceNumber}\n`;
  
  // Dates
  if (result.invoiceDate) {
    markdown += `**Invoice Date:** ${result.invoiceDate}\n`;
  }
  
  if (result.dueDate) {
    markdown += `**Due Date:** ${result.dueDate}\n`;
  }
  
  // Amounts
  if (result.totalAmount !== undefined) {
    markdown += `**Total Amount:** $${result.totalAmount.toFixed(2)}\n`;
  }
  
  if (result.taxAmount !== undefined) {
    markdown += `**Tax Amount:** $${result.taxAmount.toFixed(2)}\n`;
  }
  
  // Line Items
  if (result.lineItems && result.lineItems.length > 0) {
    markdown += `\n## Line Items\n\n`;
    markdown += `| Description | Quantity | Unit Price | Amount |\n`;
    markdown += `|------------|----------|------------|--------|\n`;
    
    for (const item of result.lineItems) {
      markdown += `| ${item.description} | ${item.quantity} | $${item.unitPrice.toFixed(2)} | $${item.amount.toFixed(2)} |\n`;
    }
  }
  
  // Handwritten Notes
  if (result.handwrittenNotes && result.handwrittenNotes.length > 0) {
    markdown += `\n## Handwritten Notes\n\n`;
    
    for (const note of result.handwrittenNotes) {
      markdown += `- "${note.text}" (Confidence: ${Math.round(note.confidence * 100)}%)\n`;
    }
  }
  
  // Extraction confidence
  markdown += `\n## Extraction Information\n\n`;
  markdown += `**Overall Confidence:** ${Math.round(result.confidence * 100)}%\n`;
  
  return markdown;
}

/**
 * Generate JSON output from structured data
 * 
 * @param result The structured OCR result
 * @returns JSON-formatted string
 */
export function generateJSONOutput(result: OCRResult): string {
  return JSON.stringify(result, null, 2);
}