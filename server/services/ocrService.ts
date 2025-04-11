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
    // Since we can't use pdf-poppler in this environment, we'll try direct methods
    console.log('Processing PDF document directly...');
    
    // Read the PDF file as base64
    const fileData = fs.readFileSync(filePath);
    const base64File = fileData.toString('base64');
    
    // Try multiple approaches, starting with direct PDF processing
    try {
      console.log('Attempting to process PDF directly via OpenAI Vision API...');
      result = await callOpenAIVisionAPI(base64File, 'application/pdf');
    } catch (pdfError) {
      console.error('Error processing PDF directly:', pdfError);
      
      // If direct PDF processing fails, try treating it as an image
      // as sometimes the OpenAI API can still extract information
      try {
        console.log('Falling back to treating PDF as image/png...');
        result = await callOpenAIVisionAPI(base64File, 'image/png');
      } catch (imageError) {
        console.error('Failed to process PDF as image/png:', imageError);
        
        // Last resort - try JPEG format
        console.log('Trying as image/jpeg as last resort...');
        result = await callOpenAIVisionAPI(base64File, 'image/jpeg');
      }
    }
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
 * Process a PDF document by converting it to images first
 * 
 * @param filePath The path to the PDF file
 * @returns The raw OCR extraction data
 */
async function processPDFWithOpenAI(filePath: string): Promise<any> {
  try {
    console.log(`Processing PDF at path: ${filePath}`);
    
    // Create a unique directory for this PDF's images
    const uniqueId = uuidv4();
    const outputDir = path.join(tempDir, uniqueId);
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Convert PDF to images
    console.log('Converting PDF to images...');
    
    try {
      // Try using ImageMagick to convert PDF to images
      console.log('Attempting to convert PDF using ImageMagick...');
      await execPromise(`convert -density 300 "${filePath}" "${path.join(outputDir, 'page-%d.png')}"`);
    } catch (convError) {
      console.error('Error with ImageMagick conversion:', convError);
      
      // No fallback available, throw error
      throw new Error('Failed to convert PDF to images. Unable to process in this environment.');
    }
    
    // Get all generated image files
    const imageFiles = fs.readdirSync(outputDir)
      .filter(file => file.endsWith('.png'))
      .sort(); // Sort to ensure page order
    
    if (imageFiles.length === 0) {
      throw new Error('PDF conversion produced no image files');
    }
    
    console.log(`Converted PDF to ${imageFiles.length} image(s)`);
    
    // Process first page for basic document info
    // Read first page as base64
    const firstImagePath = path.join(outputDir, imageFiles[0]);
    const firstImageData = fs.readFileSync(firstImagePath);
    const firstImageBase64 = firstImageData.toString('base64');
    
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
         - This is page 1 of a ${imageFiles.length}-page document
      
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
    
    // Call Vision API with the first page image
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
                  url: `data:image/png;base64,${firstImageBase64}`
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
    let result;
    
    try {
      result = JSON.parse(content);
    } catch (parseError: any) {
      console.error("Error parsing JSON response:", content);
      throw new Error(`Failed to parse OpenAI response: ${parseError.message}`);
    }
    
    // Process additional pages if needed (for complex documents)
    if (imageFiles.length > 1) {
      // Here you could add logic to process additional pages and merge results
      console.log(`Document has ${imageFiles.length} pages, additional page processing logic could be added here`);
      
      // Example: detect if we have line items to process from additional pages
      // This is simplified - in a real app you might want more sophisticated merging
      for (let i = 1; i < Math.min(imageFiles.length, 3); i++) { // Process up to 3 pages maximum for demo
        try {
          const additionalImagePath = path.join(outputDir, imageFiles[i]);
          const additionalImageData = fs.readFileSync(additionalImagePath);
          const additionalImageBase64 = additionalImageData.toString('base64');
          
          const additionalPrompt = `
            This is page ${i+1} of a ${imageFiles.length}-page document.
            Look for additional information that might not be on the first page:
            - Continue extracting line items
            - Look for totals or summary information
            - Find any additional handwritten notes
            - Extract any terms and conditions
            
            Return ONLY new information found on this page in the same JSON format.
          `;
          
          const additionalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                    { type: "text", text: additionalPrompt },
                    { 
                      type: "image_url", 
                      image_url: { 
                        url: `data:image/png;base64,${additionalImageBase64}`
                      } 
                    }
                  ]
                }
              ],
              max_tokens: 1000,
              temperature: 0.3,
              response_format: { type: "json_object" }
            })
          });
          
          if (additionalResponse.ok) {
            const additionalData = await additionalResponse.json() as { choices: [{ message: { content: string } }] };
            const additionalContent = additionalData.choices[0].message.content;
            
            try {
              const additionalResult = JSON.parse(additionalContent);
              
              // Merge additional line items if found
              if (additionalResult.lineItems && additionalResult.lineItems.length > 0) {
                result.lineItems = [...(result.lineItems || []), ...additionalResult.lineItems];
              }
              
              // Merge additional handwritten notes if found
              if (additionalResult.handwrittenNotes && additionalResult.handwrittenNotes.length > 0) {
                result.handwrittenNotes = [...(result.handwrittenNotes || []), ...additionalResult.handwrittenNotes];
              }
              
              // Update totals if found on subsequent pages
              if (additionalResult.totalAmount && !result.totalAmount) {
                result.totalAmount = additionalResult.totalAmount;
              }
              
              if (additionalResult.taxAmount && !result.taxAmount) {
                result.taxAmount = additionalResult.taxAmount;
              }
            } catch (e) {
              console.warn(`Could not parse additional page ${i+1} results:`, e);
            }
          }
        } catch (pageError) {
          console.warn(`Error processing additional page ${i+1}:`, pageError);
        }
      }
    }
    
    // Cleanup temporary files
    try {
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary files:', cleanupError);
    }
    
    return result;
  } catch (error: any) {
    console.error("Error processing PDF with OpenAI:", error);
    throw new Error(`Failed to process PDF with OpenAI: ${error.message}`);
  }
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