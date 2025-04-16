import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import axios from 'axios';
import { LineItem, HandwrittenNote } from '../../shared/schema';

// Initialize OpenAI client 
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize LlamaParse API configuration
const LLAMAPARSE_API_KEY = process.env.LLAMAPARSE_API_KEY;
const LLAMAPARSE_API_URL = 'https://api.llamaindex.ai/v1/parsing/parse_file';

// Log API keys status (for debugging, redacted for security)
console.log(`OPENAI_API_KEY ${process.env.OPENAI_API_KEY ? 'is set' : 'is not set'}`);
console.log(`LLAMAPARSE_API_KEY ${LLAMAPARSE_API_KEY ? 'is set' : 'is not set'}`);

if (!LLAMAPARSE_API_KEY) {
  console.error('LlamaParse API key is not set. Please check LLAMAPARSE_API_KEY environment variable.');
}

// Function to parse a document using LlamaParse
export async function parseDocumentWithLlamaParse(filePath: string): Promise<any> {
  if (!LLAMAPARSE_API_KEY) {
    throw new Error('LlamaParse API key is not set');
  }

  try {
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(fileName).toLowerCase();

    // Create form data for multipart request
    const formData = new FormData();
    const blob = new Blob([fileContent], { type: getMimeType(fileExtension) });
    formData.append('file', blob, fileName);

    // Make request to LlamaParse API
    const response = await axios.post(
      LLAMAPARSE_API_URL,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`,
          'Content-Type': 'multipart/form-data',
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error parsing document with LlamaParse:', error);
    throw error;
  }
}

// Function to process LlamaParse result with OpenAI to extract invoice data
export async function processInvoiceWithOpenAI(llamaParseResult: any, documentId: number): Promise<any> {
  // Create a prompt for OpenAI
  const prompt = createInvoiceExtractionPrompt(llamaParseResult);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant specialized in extracting structured data from invoices and documents. You analyze the document content and extract information in a precise, structured format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2, // Lower temperature for more deterministic outputs
      response_format: { type: "json_object" }
    });

    // Parse the OpenAI response
    const extractionResult = JSON.parse(completion.choices[0].message.content);
    
    // Format the extraction result for storage
    return formatExtractionResult(extractionResult, documentId);
  } catch (error) {
    console.error('Error processing invoice with OpenAI:', error);
    throw error;
  }
}

// Helper function to create a prompt for invoice extraction
function createInvoiceExtractionPrompt(llamaParseResult: any): string {
  return `
Analyze the following invoice document content and extract all the relevant information in a structured JSON format.

Document Content:
${JSON.stringify(llamaParseResult, null, 2)}

Extract the following information:
1. Vendor Name
2. Invoice Number
3. Invoice Date (in YYYY-MM-DD format)
4. Due Date (in YYYY-MM-DD format)
5. Total Amount (with currency symbol)
6. Tax Amount (with currency symbol)
7. Line Items (array of items with description, quantity, unit price, and amount)
8. Handwritten Notes (if any, with confidence score between 0-1)

Follow these specific requirements:
- For Line Items, create an array with objects containing description, quantity (number), unitPrice (number), and amount (number)
- For Handwritten Notes, create an array with objects containing text and confidence (number between 0-1)
- If a field is missing or cannot be determined, use null
- Ensure all monetary values are numbers without currency symbols
- Format dates in ISO format (YYYY-MM-DD)

Respond with a properly formatted JSON object containing all these fields.
`;
}

// Format extraction result for storage in our database schema
function formatExtractionResult(extractionResult: any, documentId: number): any {
  // Convert line items to match our schema
  const lineItems: LineItem[] = (extractionResult.lineItems || []).map((item: any) => ({
    description: item.description || '',
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unitPrice) || 0,
    amount: Number(item.amount) || 0
  }));

  // Convert handwritten notes to match our schema
  const handwrittenNotes: HandwrittenNote[] = (extractionResult.handwrittenNotes || []).map((note: any) => ({
    text: note.text || '',
    confidence: Number(note.confidence) || 0
  }));

  // Create markdown output
  const markdownOutput = generateMarkdownOutput(extractionResult, lineItems, handwrittenNotes);

  // Return formatted extraction
  return {
    documentId,
    vendorName: extractionResult.vendorName || null,
    invoiceNumber: extractionResult.invoiceNumber || null,
    invoiceDate: extractionResult.invoiceDate || null,
    dueDate: extractionResult.dueDate || null,
    totalAmount: extractionResult.totalAmount?.toString() || null,
    taxAmount: extractionResult.taxAmount?.toString() || null,
    lineItems,
    handwrittenNotes,
    markdownOutput,
    jsonOutput: JSON.stringify(extractionResult, null, 2)
  };
}

// Generate markdown output for the extracted data
function generateMarkdownOutput(extraction: any, lineItems: LineItem[], handwrittenNotes: HandwrittenNote[]): string {
  let markdown = `# Invoice Details\n\n`;

  // Add basic invoice information
  markdown += `## Basic Information\n\n`;
  markdown += `- **Vendor**: ${extraction.vendorName || 'N/A'}\n`;
  markdown += `- **Invoice Number**: ${extraction.invoiceNumber || 'N/A'}\n`;
  markdown += `- **Invoice Date**: ${extraction.invoiceDate || 'N/A'}\n`;
  markdown += `- **Due Date**: ${extraction.dueDate || 'N/A'}\n`;
  markdown += `- **Total Amount**: ${extraction.totalAmount || 'N/A'}\n`;
  markdown += `- **Tax Amount**: ${extraction.taxAmount || 'N/A'}\n\n`;

  // Add line items
  if (lineItems && lineItems.length > 0) {
    markdown += `## Line Items\n\n`;
    markdown += `| Description | Quantity | Unit Price | Amount |\n`;
    markdown += `|-------------|----------|------------|--------|\n`;
    
    lineItems.forEach(item => {
      markdown += `| ${item.description} | ${item.quantity} | ${item.unitPrice} | ${item.amount} |\n`;
    });
    
    markdown += '\n';
  }

  // Add handwritten notes
  if (handwrittenNotes && handwrittenNotes.length > 0) {
    markdown += `## Handwritten Notes\n\n`;
    
    handwrittenNotes.forEach(note => {
      markdown += `- ${note.text} *(Confidence: ${Math.round(note.confidence * 100)}%)*\n`;
    });
  }

  return markdown;
}

// Helper function to get MIME type from file extension
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}

// Main function to process a document
export async function processDocument(filePath: string, documentId: number): Promise<any> {
  try {
    // Step 1: Parse the document with LlamaParse
    const llamaParseResult = await parseDocumentWithLlamaParse(filePath);
    
    // Step 2: Process the parsed result with OpenAI
    const extractionResult = await processInvoiceWithOpenAI(llamaParseResult, documentId);
    
    return extractionResult;
  } catch (error) {
    console.error('Error in document processing:', error);
    throw error;
  }
}