/**
 * OCR Service
 * 
 * This service handles OCR processing for document extraction.
 * It connects to OpenAI Vision API to extract text and structured data from documents.
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// Import types for extraction data
import { type Extraction, LineItem, HandwrittenNote } from '@shared/schema';

// Environment variable for OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

/**
 * Process a document using OCR services
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
  
  // Read file as base64
  const fileData = fs.readFileSync(filePath);
  const base64File = fileData.toString('base64');
  
  // Determine content type based on file extension
  let contentType: string;
  switch (fileExtension) {
    case '.pdf':
      contentType = 'application/pdf';
      break;
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
    default:
      throw new Error(`Unsupported file extension: ${fileExtension}`);
  }

  // Call OpenAI Vision API
  const result = await callOpenAIVisionAPI(base64File, contentType);
  
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
    Extract all text from this document, including both printed and handwritten content.
    Identify the document type (invoice, receipt, or other).
    For invoices and receipts, extract:
    - Vendor name
    - Invoice/receipt number
    - Invoice date
    - Due date (if present)
    - Total amount
    - Tax amount (if present)
    - Line items with description, quantity, unit price, and amount
    
    For any handwritten notes, extract the text and provide a confidence score between 0 and 1.
    
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
        model: "gpt-4o-mini",
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
        max_tokens: 1500,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    
    // Extract the JSON content from the response
    const content = responseData.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
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
  // Set default values for missing fields
  const result: OCRResult = {
    documentType: rawResult.documentType || 'other',
    vendorName: rawResult.vendorName || 'Unknown Vendor',
    invoiceNumber: rawResult.invoiceNumber || 'Unknown',
    invoiceDate: rawResult.invoiceDate || undefined,
    dueDate: rawResult.dueDate || undefined,
    totalAmount: typeof rawResult.totalAmount === 'number' ? rawResult.totalAmount : undefined,
    taxAmount: typeof rawResult.taxAmount === 'number' ? rawResult.taxAmount : undefined,
    lineItems: Array.isArray(rawResult.lineItems) ? rawResult.lineItems.map(item => ({
      description: item.description || 'Unknown item',
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
      unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : 0,
      amount: typeof item.amount === 'number' ? item.amount : 0
    })) : [],
    handwrittenNotes: Array.isArray(rawResult.handwrittenNotes) ? rawResult.handwrittenNotes.map(note => ({
      text: note.text || '',
      confidence: typeof note.confidence === 'number' ? Math.max(0, Math.min(1, note.confidence)) : 0.5
    })) : [],
    confidence: typeof rawResult.confidence === 'number' ? Math.max(0, Math.min(1, rawResult.confidence)) : 0.7
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
  let markdown = `# Document Extraction\n\n`;
  
  markdown += `## Document Info\n\n`;
  markdown += `- **Type**: ${result.documentType}\n`;
  markdown += `- **Vendor**: ${result.vendorName}\n`;
  markdown += `- **Invoice Number**: ${result.invoiceNumber}\n`;
  
  if (result.invoiceDate) {
    markdown += `- **Invoice Date**: ${result.invoiceDate}\n`;
  }
  
  if (result.dueDate) {
    markdown += `- **Due Date**: ${result.dueDate}\n`;
  }
  
  if (result.totalAmount !== undefined) {
    markdown += `- **Total Amount**: $${result.totalAmount.toFixed(2)}\n`;
  }
  
  if (result.taxAmount !== undefined) {
    markdown += `- **Tax Amount**: $${result.taxAmount.toFixed(2)}\n`;
  }
  
  if (result.lineItems && result.lineItems.length > 0) {
    markdown += `\n## Line Items\n\n`;
    markdown += `| Description | Quantity | Unit Price | Amount |\n`;
    markdown += `| ----------- | -------- | ---------- | ------ |\n`;
    
    for (const item of result.lineItems) {
      markdown += `| ${item.description} | ${item.quantity} | $${item.unitPrice.toFixed(2)} | $${item.amount.toFixed(2)} |\n`;
    }
  }
  
  if (result.handwrittenNotes && result.handwrittenNotes.length > 0) {
    markdown += `\n## Handwritten Notes\n\n`;
    
    for (const note of result.handwrittenNotes) {
      markdown += `- ${note.text} _(confidence: ${(note.confidence * 100).toFixed(0)}%)_\n`;
    }
  }
  
  markdown += `\n## Metadata\n\n`;
  markdown += `- **Overall Confidence**: ${(result.confidence * 100).toFixed(0)}%\n`;
  markdown += `- **Processed Date**: ${new Date().toISOString()}\n`;
  
  return markdown;
}

/**
 * Generate JSON output from structured data
 * 
 * @param result The structured OCR result
 * @returns JSON-formatted string
 */
export function generateJSONOutput(result: OCRResult): string {
  const jsonObj = {
    documentInfo: {
      type: result.documentType,
      vendor: result.vendorName,
      invoiceNumber: result.invoiceNumber,
      invoiceDate: result.invoiceDate,
      dueDate: result.dueDate,
      totalAmount: result.totalAmount,
      taxAmount: result.taxAmount
    },
    lineItems: result.lineItems,
    handwrittenNotes: result.handwrittenNotes,
    metadata: {
      confidence: result.confidence,
      processedDate: new Date().toISOString()
    }
  };
  
  return JSON.stringify(jsonObj, null, 2);
} 