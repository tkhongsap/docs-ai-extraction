
import { LineItem, HandwrittenNote } from '@shared/schema';
import OpenAI from 'openai';
import axios from 'axios';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const LLAMAPARSE_API_KEY = process.env.LLAMA_CLOUD_API_KEY; // Updated to match the env variable name
const LLAMAPARSE_ENDPOINT = 'https://api.llamaparse.ai/v1/parse';

if (!LLAMAPARSE_API_KEY) {
  console.error('LlamaParse API key is not set. Please check LLAMA_CLOUD_API_KEY environment variable.');
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
}

async function processDocument(filePath: string, service: string = 'llamaparse'): Promise<OCRResult> {
  console.log(`Processing document with file extension: ${filePath.split('.').pop()}`);
  
  if (service !== 'llamaparse') {
    throw new Error('Currently only LlamaParse service is supported');
  }

  // First pass: Use LlamaParse for structured data extraction
  const fileBuffer = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), 'document.pdf');

  if (!LLAMAPARSE_API_KEY) {
    throw new Error('LlamaParse API key is not configured');
  }

  try {
    const llamaparseResponse = await axios.post(LLAMAPARSE_ENDPOINT, formData, {
      headers: {
        'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`,
        'Content-Type': 'multipart/form-data'
      }
    });
  } catch (error: any) {
    console.error('LlamaParse API error:', error.message);
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
            image_url: `data:application/pdf;base64,${base64Image}`
          }
        ]
      }
    ],
    max_tokens: 1000
  });

  // Combine and structure the results
  const llamaData = llamaparseResponse.data;
  const handwrittenNotes = parseHandwrittenNotes(visionResponse.choices[0].message.content || '');

  return {
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
