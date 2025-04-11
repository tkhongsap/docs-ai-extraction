/**
 * OCR Service
 * 
 * This service handles OCR processing for document extraction.
 * It connects to Mistral AI OCR service to extract text and structured data from documents.
 * It supports both PDF and image files for OCR processing.
 */

import fs from 'fs';
import path from 'path';
import { Mistral } from '@mistralai/mistralai';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

// Import types for extraction data
import { type Extraction, LineItem, HandwrittenNote } from '@shared/schema';

// Environment variable for Mistral API key
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// Initialize Mistral client
const mistralClient = new Mistral({
  apiKey: MISTRAL_API_KEY
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
 * Process a document using the Mistral AI OCR service
 * 
 * @param filePath Path to the document file to process
 * @returns Structured extraction data from the document
 */
export async function processDocument(filePath: string): Promise<OCRResult> {
  // Verify the file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY is not set in environment variables');
  }

  // Get file extension to determine appropriate processing method
  const fileExtension = path.extname(filePath).toLowerCase();
  
  // Process differently based on file type
  let result: any;
  
  // Mistral OCR supports both PDF and image files
  console.log(`Processing document with file extension: ${fileExtension}`);
  
  try {
    if (fileExtension === '.pdf') {
      console.log('Processing PDF document using Mistral OCR...');
      // For PDFs, we need to upload the file first to Mistral's service
      result = await processPdfWithMistralAI(filePath);
    } else {
      // For images, use the direct OCR processing
      console.log('Processing image document using Mistral OCR...');
      result = await processImageWithMistralAI(filePath);
    }
  } catch (error: any) {
    console.error('Error processing document with Mistral AI:', error);
    
    // If Mistral processing fails, fall back to basic info extraction from filename
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
        text: `Failed to process document: ${error.message}`,
        confidence: 1.0
      }],
      confidence: 0.1
    };
    
    console.log('Returning basic document information due to processing error');
  }
  
  // Format and validate the result
  return formatOCRResult(result);
}

/**
 * Process PDF document using Mistral AI OCR service
 * 
 * @param filePath Path to the PDF file
 * @returns Structured extraction data
 */
async function processPdfWithMistralAI(filePath: string): Promise<any> {
  try {
    console.log('Uploading PDF file to Mistral AI...');
    
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    // Upload the file to Mistral
    const uploadedFile = await mistralClient.files.upload({
      file: {
        fileName: fileName,
        content: fileContent,
      },
      purpose: "ocr"
    });
    
    console.log(`File uploaded to Mistral AI with ID: ${uploadedFile.id}`);
    
    // Process the uploaded file with Mistral OCR
    const ocrResponse = await mistralClient.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        type: "file_id",
        fileId: uploadedFile.id,
      }
    });
    
    // Extract the structured information from the OCR response
    return parseMistralOCRResponse(ocrResponse);
  } catch (error: any) {
    console.error('Error processing PDF with Mistral AI:', error);
    throw new Error(`Failed to process PDF with Mistral AI: ${error.message}`);
  }
}

/**
 * Process image document using Mistral AI OCR service
 * 
 * @param filePath Path to the image file
 * @returns Structured extraction data
 */
async function processImageWithMistralAI(filePath: string): Promise<any> {
  try {
    console.log('Processing image with Mistral AI OCR...');
    
    // Create a temporary unique URL-like name for the file reference
    const fileName = path.basename(filePath);
    
    // Upload the image file to Mistral for OCR processing
    const fileContent = fs.readFileSync(filePath);
    
    // Upload the file to Mistral
    const uploadedFile = await mistralClient.files.upload({
      file: {
        fileName: fileName,
        content: fileContent,
      },
      purpose: "ocr"
    });
    
    console.log(`File uploaded to Mistral AI with ID: ${uploadedFile.id}`);
    
    // Process the uploaded file with Mistral OCR
    const ocrResponse = await mistralClient.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        type: "file_id",
        fileId: uploadedFile.id,
      }
    });
    
    // Extract the structured information from the OCR response
    return parseMistralOCRResponse(ocrResponse);
  } catch (error: any) {
    console.error('Error processing image with Mistral AI:', error);
    throw new Error(`Failed to process image with Mistral AI: ${error.message}`);
  }
}

/**
 * Parse the Mistral OCR response into our structured format
 * 
 * @param ocrResponse The raw OCR response from Mistral AI
 * @returns Structured data in our application format
 */
function parseMistralOCRResponse(ocrResponse: any): any {
  console.log('Parsing Mistral OCR response...');
  
  try {
    // Extract text from Mistral OCR response
    const extractedText = ocrResponse.text || '';
    
    // Ask Mistral to process the text into our structured format using its chat API
    return processExtractedTextWithMistralAI(extractedText, ocrResponse);
  } catch (error: any) {
    console.error('Error parsing Mistral OCR response:', error);
    throw new Error(`Failed to parse Mistral OCR response: ${error.message}`);
  }
}

/**
 * Process the OCR-extracted text with Mistral AI to get structured data
 * 
 * @param extractedText The text extracted by OCR
 * @param ocrResponse The full OCR response for additional context
 * @returns Structured document data
 */
async function processExtractedTextWithMistralAI(extractedText: string, ocrResponse: any): Promise<any> {
  try {
    console.log('Processing extracted text with Mistral AI chat...');
    
    // Create a prompt for Mistral to analyze the document text
    const prompt = `
You are an expert document analyzer specializing in OCR extraction.

Here's the OCR text from a document:
"""
${extractedText}
"""

TASK:
Analyze this document text and extract the key information.
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

    // Use Mistral AI chat to analyze the extracted text
    const chatResponse = await mistralClient.chat({
      model: "mistral-large-latest",
      messages: [
        { role: "user", content: prompt }
      ],
      responseFormat: { type: "json_object" }
    });
    
    // Parse the response content
    const content = chatResponse.choices[0].message.content;
    
    // Try to parse the JSON response
    try {
      const structuredData = JSON.parse(content);
      return structuredData;
    } catch (parseError: any) {
      console.error("Error parsing JSON from Mistral chat response:", content);
      throw new Error(`Failed to parse Mistral chat response as JSON: ${parseError.message}`);
    }
  } catch (error: any) {
    console.error('Error processing text with Mistral AI chat:', error);
    throw new Error(`Failed to process text with Mistral AI chat: ${error.message}`);
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
  if (typeof result.totalAmount === 'number') {
    markdown += `**Total Amount:** $${result.totalAmount.toFixed(2)}\n`;
  }
  
  if (typeof result.taxAmount === 'number') {
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