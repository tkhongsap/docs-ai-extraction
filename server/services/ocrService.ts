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
  // Ensure we have at least an empty object if rawResult is null or undefined
  rawResult = rawResult || {};
  
  // Handle potential string values for numeric fields
  let totalAmount = undefined;
  if (rawResult.totalAmount !== undefined) {
    if (typeof rawResult.totalAmount === 'number') {
      totalAmount = rawResult.totalAmount;
    } else if (typeof rawResult.totalAmount === 'string') {
      // Try to parse the string, removing any currency symbols
      const cleanNumber = rawResult.totalAmount.replace(/[$£€,]/g, '');
      const parsedNumber = parseFloat(cleanNumber);
      if (!isNaN(parsedNumber)) {
        totalAmount = parsedNumber;
      }
    }
  }
  
  let taxAmount = undefined;
  if (rawResult.taxAmount !== undefined) {
    if (typeof rawResult.taxAmount === 'number') {
      taxAmount = rawResult.taxAmount;
    } else if (typeof rawResult.taxAmount === 'string') {
      // Try to parse the string, removing any currency symbols
      const cleanNumber = rawResult.taxAmount.replace(/[$£€,]/g, '');
      const parsedNumber = parseFloat(cleanNumber);
      if (!isNaN(parsedNumber)) {
        taxAmount = parsedNumber;
      }
    }
  }
  
  // Format line items, handling various input formats
  const lineItems = Array.isArray(rawResult.lineItems) 
    ? rawResult.lineItems.map((rawItem: any) => {
        // Ensure item is an object
        const item: any = typeof rawItem === 'object' && rawItem !== null ? rawItem : {};
        
        // Handle quantity
        let quantity = 1;
        if (item.quantity !== undefined) {
          if (typeof item.quantity === 'number') {
            quantity = item.quantity;
          } else if (typeof item.quantity === 'string') {
            const parsedQuantity = parseFloat(item.quantity);
            if (!isNaN(parsedQuantity)) {
              quantity = parsedQuantity;
            }
          }
        }
        
        // Handle unit price
        let unitPrice = 0;
        if (item.unitPrice !== undefined) {
          if (typeof item.unitPrice === 'number') {
            unitPrice = item.unitPrice;
          } else if (typeof item.unitPrice === 'string') {
            const cleanPrice = item.unitPrice.replace(/[$£€,]/g, '');
            const parsedPrice = parseFloat(cleanPrice);
            if (!isNaN(parsedPrice)) {
              unitPrice = parsedPrice;
            }
          }
        }
        
        // Handle amount
        let amount = 0;
        if (item.amount !== undefined) {
          if (typeof item.amount === 'number') {
            amount = item.amount;
          } else if (typeof item.amount === 'string') {
            const cleanAmount = item.amount.replace(/[$£€,]/g, '');
            const parsedAmount = parseFloat(cleanAmount);
            if (!isNaN(parsedAmount)) {
              amount = parsedAmount;
            }
          }
        } else if (quantity !== undefined && unitPrice !== undefined) {
          // Calculate amount if not provided
          amount = quantity * unitPrice;
        }
        
        return {
          description: item.description || 'Unknown item',
          quantity: quantity,
          unitPrice: unitPrice,
          amount: amount
        };
      }) 
    : [];
  
  // Format handwritten notes
  const handwrittenNotes = Array.isArray(rawResult.handwrittenNotes) 
    ? rawResult.handwrittenNotes.map((rawNote: any) => {
        // Ensure note is an object
        const note: any = typeof rawNote === 'object' && rawNote !== null ? rawNote : {};
        
        let confidence = 0.5;
        if (note.confidence !== undefined) {
          if (typeof note.confidence === 'number') {
            confidence = Math.max(0, Math.min(1, note.confidence));
          } else if (typeof note.confidence === 'string') {
            const parsedConfidence = parseFloat(note.confidence);
            if (!isNaN(parsedConfidence)) {
              confidence = Math.max(0, Math.min(1, parsedConfidence));
            }
          }
        }
        
        return {
          text: note.text || '',
          confidence: confidence
        };
      }) 
    : [];
  
  // Format dates as YYYY-MM-DD strings
  let invoiceDate = undefined;
  if (rawResult.invoiceDate) {
    try {
      // Try to parse as ISO date
      const date = new Date(rawResult.invoiceDate);
      if (!isNaN(date.getTime())) {
        invoiceDate = date.toISOString().split('T')[0];
      } else {
        // If not a valid date, use as is
        invoiceDate = rawResult.invoiceDate;
      }
    } catch (e) {
      // If date parsing fails, use as is
      invoiceDate = rawResult.invoiceDate;
    }
  }
  
  let dueDate = undefined;
  if (rawResult.dueDate) {
    try {
      // Try to parse as ISO date
      const date = new Date(rawResult.dueDate);
      if (!isNaN(date.getTime())) {
        dueDate = date.toISOString().split('T')[0];
      } else {
        // If not a valid date, use as is
        dueDate = rawResult.dueDate;
      }
    } catch (e) {
      // If date parsing fails, use as is
      dueDate = rawResult.dueDate;
    }
  }
  
  // Create the final result object with all fields properly formatted
  const result: OCRResult = {
    documentType: rawResult.documentType || 'other',
    vendorName: rawResult.vendorName || 'Unknown Vendor',
    invoiceNumber: rawResult.invoiceNumber || 'Unknown',
    invoiceDate: invoiceDate,
    dueDate: dueDate,
    totalAmount: totalAmount,
    taxAmount: taxAmount,
    lineItems: lineItems,
    handwrittenNotes: handwrittenNotes,
    confidence: typeof rawResult.confidence === 'number' 
      ? Math.max(0, Math.min(1, rawResult.confidence)) 
      : 0.7
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
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  let markdown = `# Document Extraction Report\n\n`;
  markdown += `*Generated on ${formattedDate} at ${formattedTime}*\n\n`;
  
  // Document summary section
  markdown += `## Document Summary\n\n`;
  markdown += `- **Document Type**: ${result.documentType.charAt(0).toUpperCase() + result.documentType.slice(1)}\n`;
  markdown += `- **Vendor**: ${result.vendorName}\n`;
  markdown += `- **Invoice Number**: ${result.invoiceNumber}\n`;
  
  if (result.invoiceDate) {
    // Try to format the date nicely if possible
    try {
      const date = new Date(result.invoiceDate);
      if (!isNaN(date.getTime())) {
        markdown += `- **Invoice Date**: ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
      } else {
        markdown += `- **Invoice Date**: ${result.invoiceDate}\n`;
      }
    } catch (e) {
      markdown += `- **Invoice Date**: ${result.invoiceDate}\n`;
    }
  }
  
  if (result.dueDate) {
    // Try to format the date nicely if possible
    try {
      const date = new Date(result.dueDate);
      if (!isNaN(date.getTime())) {
        markdown += `- **Due Date**: ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
      } else {
        markdown += `- **Due Date**: ${result.dueDate}\n`;
      }
    } catch (e) {
      markdown += `- **Due Date**: ${result.dueDate}\n`;
    }
  }
  
  // Financial information section
  markdown += `\n## Financial Information\n\n`;
  
  if (result.totalAmount !== undefined) {
    markdown += `- **Total Amount**: $${result.totalAmount.toFixed(2)}\n`;
  } else {
    markdown += `- **Total Amount**: Not specified\n`;
  }
  
  if (result.taxAmount !== undefined) {
    markdown += `- **Tax Amount**: $${result.taxAmount.toFixed(2)}\n`;
    
    // If we have both total and tax, calculate the subtotal
    if (result.totalAmount !== undefined) {
      const subtotal = result.totalAmount - result.taxAmount;
      markdown += `- **Subtotal**: $${subtotal.toFixed(2)}\n`;
    }
  } else {
    markdown += `- **Tax Amount**: Not specified\n`;
  }
  
  // Line items section with improved table formatting
  if (result.lineItems && result.lineItems.length > 0) {
    markdown += `\n## Line Items\n\n`;
    
    // Calculate column widths based on content length
    let maxDescLen = "Description".length;
    let maxQtyLen = "Quantity".length;
    let maxPriceLen = "Unit Price".length;
    let maxAmountLen = "Amount".length;
    
    result.lineItems.forEach(item => {
      maxDescLen = Math.max(maxDescLen, item.description.length);
      maxQtyLen = Math.max(maxQtyLen, item.quantity.toString().length);
      maxPriceLen = Math.max(maxPriceLen, (`$${item.unitPrice.toFixed(2)}`).length);
      maxAmountLen = Math.max(maxAmountLen, (`$${item.amount.toFixed(2)}`).length);
    });
    
    // Add some padding
    maxDescLen += 2;
    maxQtyLen += 2;
    maxPriceLen += 2;
    maxAmountLen += 2;
    
    // Build the table header
    markdown += `| ${"Description".padEnd(maxDescLen)} | ${"Quantity".padEnd(maxQtyLen)} | ${"Unit Price".padEnd(maxPriceLen)} | ${"Amount".padEnd(maxAmountLen)} |\n`;
    markdown += `| ${"-".repeat(maxDescLen)} | ${"-".repeat(maxQtyLen)} | ${"-".repeat(maxPriceLen)} | ${"-".repeat(maxAmountLen)} |\n`;
    
    // Build the table rows
    for (const item of result.lineItems) {
      markdown += `| ${item.description.padEnd(maxDescLen)} | ${item.quantity.toString().padEnd(maxQtyLen)} | $${item.unitPrice.toFixed(2).padEnd(maxPriceLen - 1)} | $${item.amount.toFixed(2).padEnd(maxAmountLen - 1)} |\n`;
    }
    
    // Add a summary line if we have multiple items
    if (result.lineItems.length > 1) {
      const totalLineItemsAmount = result.lineItems.reduce((sum, item) => sum + item.amount, 0);
      markdown += `| ${"**TOTAL**".padEnd(maxDescLen)} | ${" ".repeat(maxQtyLen)} | ${" ".repeat(maxPriceLen)} | ${"**$" + totalLineItemsAmount.toFixed(2) + "**"} |\n`;
    }
  }
  
  // Handwritten notes section with confidence scores
  if (result.handwrittenNotes && result.handwrittenNotes.length > 0) {
    markdown += `\n## Handwritten Notes\n\n`;
    
    for (const note of result.handwrittenNotes) {
      // Format the confidence as a percentage and add color indicators
      const confidencePct = (note.confidence * 100).toFixed(0);
      let confidenceIndicator = "";
      
      if (note.confidence >= 0.8) {
        confidenceIndicator = "high";
      } else if (note.confidence >= 0.5) {
        confidenceIndicator = "medium";
      } else {
        confidenceIndicator = "low";
      }
      
      markdown += `- "${note.text}" _(${confidenceIndicator} confidence: ${confidencePct}%)_\n`;
    }
  }
  
  // Metadata and extraction details
  markdown += `\n## Extraction Details\n\n`;
  markdown += `- **Overall Confidence**: ${(result.confidence * 100).toFixed(0)}%\n`;
  markdown += `- **Processed Date**: ${formattedDate}\n`;
  markdown += `- **Processed Time**: ${formattedTime}\n`;
  
  return markdown;
}

/**
 * Generate JSON output from structured data
 * 
 * @param result The structured OCR result
 * @returns JSON-formatted string
 */
export function generateJSONOutput(result: OCRResult): string {
  // Calculate some additional derived values
  let subtotal = undefined;
  if (result.totalAmount !== undefined && result.taxAmount !== undefined) {
    subtotal = result.totalAmount - result.taxAmount;
  }
  
  // Calculate some aggregate metrics
  const totalLineItemsValue = result.lineItems.reduce((sum, item) => sum + item.amount, 0);
  const lineItemCount = result.lineItems.length;
  const handwrittenNoteCount = result.handwrittenNotes.length;
  
  // Average confidence of handwritten notes
  let avgHandwrittenConfidence = 0;
  if (handwrittenNoteCount > 0) {
    avgHandwrittenConfidence = result.handwrittenNotes.reduce((sum, note) => sum + note.confidence, 0) / handwrittenNoteCount;
  }
  
  // Build the structured JSON object with all information
  const jsonObj = {
    documentInfo: {
      documentType: result.documentType,
      vendor: result.vendorName,
      invoiceNumber: result.invoiceNumber,
      dates: {
        invoiceDate: result.invoiceDate,
        dueDate: result.dueDate
      }
    },
    financialData: {
      totalAmount: result.totalAmount,
      taxAmount: result.taxAmount,
      subtotal: subtotal,
      calculatedTotal: totalLineItemsValue,
      discrepancy: result.totalAmount !== undefined ? (result.totalAmount - totalLineItemsValue) : undefined
    },
    lineItems: result.lineItems,
    handwrittenNotes: result.handwrittenNotes,
    statistics: {
      lineItemCount: lineItemCount,
      handwrittenNoteCount: handwrittenNoteCount,
      avgHandwrittenConfidence: avgHandwrittenConfidence
    },
    metadata: {
      confidence: result.confidence,
      confidencePercentage: (result.confidence * 100).toFixed(1) + "%",
      processedDate: new Date().toISOString(),
      apiVersion: "1.0"
    }
  };
  
  return JSON.stringify(jsonObj, null, 2);
} 