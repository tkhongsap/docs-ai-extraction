import { LineItem, HandwrittenNote } from '@shared/schema';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY  
});

// For the official client
const LLAMAPARSE_API_KEY = process.env.LLAMAPARSE_API_KEY;

// Log API keys status for debugging
console.log(`OPENAI_API_KEY ${process.env.OPENAI_API_KEY ? 'is set' : 'is not set'}`);
console.log(`LLAMAPARSE_API_KEY ${LLAMAPARSE_API_KEY ? 'is set' : 'is not set'}`);

if (!LLAMAPARSE_API_KEY) {
  console.error('LlamaParse API key is not set. Please check LLAMAPARSE_API_KEY environment variable.');
}

// Define helper function to get mime types
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

interface OCRResult {
  vendorName: string;
  invoiceNumber: string;
  invoiceDate?: Date;
  dueDate?: Date;
  totalAmount?: number;
  taxAmount?: number;
  lineItems: LineItem[];
  handwrittenNotes: HandwrittenNote[];
  markdownOutput?: string;
  jsonOutput?: string;
  documentId?: number;
}

async function processDocument(filePath: string, service: string = 'llamaparse'): Promise<OCRResult> {
  console.log(`Processing document with file extension: ${filePath.split('.').pop()}`);

  if (service !== 'llamaparse') {
    throw new Error('Currently only LlamaParse service is supported');
  }

  // First pass: Use LlamaParse for structured data extraction
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const fileExtension = path.extname(fileName).toLowerCase();
  
  // Alternative direct approach using axios since the official client may have issues
  const formData = new FormData();
  formData.append('file', fileBuffer, {
    filename: fileName,
    contentType: getMimeType(fileExtension)
  });

  if (!LLAMAPARSE_API_KEY) {
    console.error('LlamaParse API key is missing. Please add LLAMAPARSE_API_KEY to environment variables.');
    throw new Error('LlamaParse API key is not configured. Please check environment variables.');
  }

  let llamaparseResponse;
  try {
    // Try multiple possible API endpoints since the correct one might have changed
    const possibleEndpoints = [
      'https://api.llamaindex.ai/v1/parsing/parse_file',
      'https://api.llamaindex.ai/api/parse',
      'https://api.llamaparse.ai/api/v1/parse',
      'https://api-inference.huggingface.co/models/llama/parse'
    ];
    
    // Use node-fetch for more reliable file uploads
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: fileName,
      contentType: getMimeType(fileExtension)
    });
    
    let lastError = null;
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Attempting request to LlamaParse API at ${endpoint}`);
        
        // Set up the request with timeout and proper headers
        llamaparseResponse = await axios.post(endpoint, form, {
          headers: {
            'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`,
            ...form.getHeaders(), // This is important to set the correct Content-Type with boundary
          },
          timeout: 30000, // 30 second timeout
          maxContentLength: 20 * 1024 * 1024, // 20MB max for larger files
        });
        
        console.log('LlamaParse API request was successful');
        break; // If successful, exit the loop
      } catch (err: any) {
        console.error(`Failed to connect to ${endpoint}:`, err.message || 'Unknown error');
        lastError = err;
        
        // Continue to the next endpoint if this one failed
        continue;
      }
    }
    
    // If we've tried all endpoints and none worked, throw the last error
    if (!llamaparseResponse) {
      console.error('All LlamaParse API endpoints failed');
      throw lastError || new Error('All LlamaParse API endpoints failed');
    }
  } catch (error: any) {
    console.error('LlamaParse API error:', error);
    
    // Enhanced error logging
    if (axios.isAxiosError(error)) {
      console.error('LlamaParse API request failed:');
      console.error('  URL:', error.config?.url);
      console.error('  Status:', error.response?.status);
      console.error('  Status Text:', error.response?.statusText);
      console.error('  Response Data:', error.response?.data);
      
      // Check for common errors
      if (error.code === 'ENOTFOUND') {
        throw new Error('LlamaParse API error: Network connection error - unable to resolve host. Please check your internet connection.');
      } else if (error.response?.status === 401) {
        throw new Error('LlamaParse API error: Authentication failed - Invalid API key');
      } else if (error.response?.status === 404) {
        throw new Error('LlamaParse API error: API endpoint not found - Please contact support');
      }
    }
    
    throw new Error(`LlamaParse API error: ${error.message}`);
  }

  // Second pass: Use OpenAI Vision for handwritten notes and additional context
  const base64Image = fileBuffer.toString('base64');

  const visionResponse = await openai.chat.completions.create({
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
              url: `data:application/pdf;base64,${base64Image}`
            }
          }
        ]
      }
    ],
    max_tokens: 1000
  });

  // Combine and structure the results
  const llamaData = llamaparseResponse.data;
  const handwrittenNotes = parseHandwrittenNotes(visionResponse.choices[0].message.content || '');

  const result: OCRResult = {
    vendorName: llamaData.vendor_name,
    invoiceNumber: llamaData.invoice_number,
    invoiceDate: llamaData.invoice_date ? new Date(llamaData.invoice_date) : undefined,
    dueDate: llamaData.due_date ? new Date(llamaData.due_date) : undefined,
    totalAmount: parseFloat(llamaData.total_amount) || undefined,
    taxAmount: parseFloat(llamaData.tax_amount) || undefined,
    lineItems: llamaData.line_items.map((item: any) => ({
      description: item.description,
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unit_price),
      amount: parseFloat(item.amount)
    })),
    handwrittenNotes
  };
  
  // Generate markdown and JSON outputs
  result.markdownOutput = generateMarkdownOutput(result);
  result.jsonOutput = generateJSONOutput(result);
  
  return result;
}

function parseHandwrittenNotes(visionContent: string): HandwrittenNote[] {
  // Extract notes from OpenAI Vision response
  const notes: HandwrittenNote[] = [];
  const noteRegex = /handwritten note|annotation|written text/i;

  const lines = visionContent.split('\n');
  for (const line of lines) {
    if (noteRegex.test(line)) {
      notes.push({
        text: line.replace(/^.*?:\s*/, '').trim(),
        confidence: 0.9 // OpenAI Vision typically has high confidence
      });
    }
  }

  return notes;
}

function generateMarkdownOutput(result: OCRResult): string {
  return `# Invoice Details

## General Information
- Vendor: ${result.vendorName}
- Invoice Number: ${result.invoiceNumber}
- Invoice Date: ${result.invoiceDate?.toLocaleDateString() || 'N/A'}
- Due Date: ${result.dueDate?.toLocaleDateString() || 'N/A'}

## Financial Details
- Total Amount: $${result.totalAmount?.toFixed(2) || 'N/A'}
- Tax Amount: $${result.taxAmount?.toFixed(2) || 'N/A'}

## Line Items
${result.lineItems.map(item => `- ${item.description}: ${item.quantity} x $${item.unitPrice} = $${item.amount}`).join('\n')}

## Handwritten Notes
${result.handwrittenNotes.map(note => `- ${note.text} (Confidence: ${(note.confidence * 100).toFixed(1)}%)`).join('\n')}
`;
}

function generateJSONOutput(result: OCRResult): string {
  return JSON.stringify(result, null, 2);
}

export {
  processDocument,
  generateMarkdownOutput,
  generateJSONOutput,
  type OCRResult
};