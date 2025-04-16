import fs from 'fs';
import path from 'path';
import { LineItem, HandwrittenNote } from '@shared/schema';
import { Mistral } from '@mistralai/mistralai';

// OCR service API keys from environment variables
const mistralApiKey = process.env.MISTRAL_API_KEY || '';
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const llamaParseApiKey = process.env.LLAMAPARSE_API_KEY || '';

// Initialize Mistral client
const mistralClient = new Mistral(mistralApiKey);

interface OCRResult {
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  totalAmount: string | null;
  taxAmount: string | null;
  lineItems: LineItem[];
  handwrittenNotes: HandwrittenNote[];
}

// Function to determine the file type and process accordingly
export async function processDocument(filePath: string, ocrService: string = 'mistral'): Promise<OCRResult> {
  console.log(`Processing document with file extension: ${path.extname(filePath)}`);
  
  // Get file extension
  const fileExt = path.extname(filePath).toLowerCase();
  
  // Process based on file type
  if (fileExt === '.pdf') {
    return await processPdfDocument(filePath, ocrService);
  } else if (['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.gif', '.webp'].includes(fileExt)) {
    return await processImageDocument(filePath, ocrService);
  } else {
    throw new Error(`Unsupported file type: ${fileExt}`);
  }
}

// Process PDF documents
async function processPdfDocument(filePath: string, ocrService: string): Promise<OCRResult> {
  console.log(`Processing PDF document using ${ocrService} OCR...`);

  switch (ocrService) {
    case 'mistral':
      return await processMistralOCR(filePath, true);
    case 'openai':
      return await processOpenAIOCR(filePath, true);
    case 'llamaparse':
      return await processLlamaParseOCR(filePath, true);
    default:
      // Default to Mistral if service not specified or invalid
      return await processMistralOCR(filePath, true);
  }
}

// Process image documents
async function processImageDocument(filePath: string, ocrService: string): Promise<OCRResult> {
  console.log(`Processing image document using ${ocrService} OCR...`);

  switch (ocrService) {
    case 'mistral':
      return await processMistralOCR(filePath, false);
    case 'openai':
      return await processOpenAIOCR(filePath, false);
    case 'llamaparse':
      return await processLlamaParseOCR(filePath, false);
    default:
      // Default to Mistral if service not specified or invalid
      return await processMistralOCR(filePath, false);
  }
}

// Process with Mistral AI OCR
async function processMistralOCR(filePath: string, isPdf: boolean): Promise<OCRResult> {
  console.log(`Processing ${isPdf ? 'PDF' : 'image'} file with Mistral AI...`);
  
  try {
    if (!mistralApiKey) {
      throw new Error('Mistral API key is not configured. Please set the MISTRAL_API_KEY environment variable.');
    }
    
    // Read file as base64
    const fileContent = fs.readFileSync(filePath);
    const base64Content = fileContent.toString('base64');
    const fileType = isPdf ? 'application/pdf' : 'image/jpeg';
    
    // Create the prompt for Mistral AI
    const systemPrompt = `You are an expert OCR system specialized in invoice and document analysis. 
Extract the following information from the provided document:
1. Vendor name
2. Invoice number
3. Invoice date (in YYYY-MM-DD format)
4. Due date (in YYYY-MM-DD format)
5. Total amount (with currency symbol)
6. Tax amount (with currency symbol)
7. Line items (description, quantity, unit price, amount)
8. Any handwritten notes

Return the information in JSON format with the following structure:
{
  "vendorName": string or null,
  "invoiceNumber": string or null,
  "invoiceDate": string or null,
  "dueDate": string or null,
  "totalAmount": string or null,
  "taxAmount": string or null,
  "lineItems": [
    {
      "description": string,
      "quantity": number,
      "unitPrice": number,
      "amount": number
    }
  ],
  "handwrittenNotes": [
    {
      "text": string,
      "confidence": number
    }
  ]
}

For handwritten notes, assign a confidence value between 0 and 1, where 1 means highest confidence.
Ensure all numeric fields (quantity, unitPrice, amount) are parsed as numbers, not strings.
If a field is not present in the document, set it to null.`;

    const userPrompt = `Process this ${isPdf ? 'PDF' : 'image'} document and extract invoice information according to the required format.`;
    
    // Extract document context using Mistral AI
    console.log('Using Mistral AI to analyze document...');
    
    // Call Mistral API with the document as a base64 attachment
    const response = await mistralClient.chat({
      model: "mistral-large-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: [
            { type: "text", text: userPrompt },
            { type: "image", image_url: { url: `data:${fileType};base64,${base64Content}` } }
          ]
        }
      ],
      temperature: 0.0 // Low temperature for more deterministic results
    });
    
    // Get the response text
    const assistantMessage = response.choices[0].message.content;
    
    // Try to extract JSON from the response
    try {
      // Use a regex to extract JSON object if it's wrapped in markdown code blocks or other text
      const jsonMatch = assistantMessage.match(/```(?:json)?([\s\S]*?)```/) || 
                        assistantMessage.match(/{[\s\S]*?}/);
      
      const jsonText = jsonMatch ? jsonMatch[0].replace(/```json|```/g, '') : assistantMessage;
      const extractedData = JSON.parse(jsonText);
      
      // Validate the extracted data structure and apply defaults
      const result: OCRResult = {
        vendorName: extractedData.vendorName || null,
        invoiceNumber: extractedData.invoiceNumber || null,
        invoiceDate: extractedData.invoiceDate || null,
        dueDate: extractedData.dueDate || null,
        totalAmount: extractedData.totalAmount || null,
        taxAmount: extractedData.taxAmount || null,
        lineItems: Array.isArray(extractedData.lineItems) 
          ? extractedData.lineItems.map((item: any) => ({
              description: item.description || '',
              quantity: Number(item.quantity) || 0,
              unitPrice: Number(item.unitPrice) || 0,
              amount: Number(item.amount) || 0
            }))
          : [],
        handwrittenNotes: Array.isArray(extractedData.handwrittenNotes)
          ? extractedData.handwrittenNotes.map((note: any) => ({
              text: note.text || '',
              confidence: Number(note.confidence) || 0.5
            }))
          : []
      };
      
      console.log('Successfully extracted data with Mistral AI');
      return result;
    } catch (jsonError) {
      console.error('Error parsing JSON from Mistral response:', jsonError);
      console.log('Raw response:', assistantMessage);
      throw new Error('Failed to parse Mistral AI response');
    }
  } catch (error) {
    console.error('Error processing document with Mistral AI:', error);
    throw error;
  }
}

// Process with OpenAI OCR (placeholder for future implementation)
async function processOpenAIOCR(filePath: string, isPdf: boolean): Promise<OCRResult> {
  console.log('Processing file with OpenAI...');
  
  // Implementation for OpenAI would go here
  // This is a placeholder
  
  return {
    vendorName: "ABC Company",
    invoiceNumber: "INV-12345",
    invoiceDate: "2023-04-15",
    dueDate: "2023-05-15",
    totalAmount: "$1,234.56",
    taxAmount: "$123.45",
    lineItems: [
      {
        description: "Product A",
        quantity: 2,
        unitPrice: 100,
        amount: 200
      }
    ],
    handwrittenNotes: [
      {
        text: "Approved by John",
        confidence: 0.85
      }
    ]
  };
}

// Process with LlamaParse OCR (placeholder for future implementation)
async function processLlamaParseOCR(filePath: string, isPdf: boolean): Promise<OCRResult> {
  console.log('Processing file with LlamaParse...');
  
  // Implementation for LlamaParse would go here
  // This is a placeholder
  
  return {
    vendorName: "ABC Company",
    invoiceNumber: "INV-12345",
    invoiceDate: "2023-04-15",
    dueDate: "2023-05-15",
    totalAmount: "$1,234.56",
    taxAmount: "$123.45",
    lineItems: [
      {
        description: "Product A",
        quantity: 2,
        unitPrice: 100,
        amount: 200
      }
    ],
    handwrittenNotes: [
      {
        text: "Approved by John",
        confidence: 0.85
      }
    ]
  };
}

// Generate a markdown representation of the OCR extraction
export function generateMarkdownOutput(ocrResult: OCRResult): string {
  let markdown = `# Document Extraction Results\n\n`;
  
  // Basic information
  markdown += `## Document Information\n\n`;
  markdown += `- **Vendor:** ${ocrResult.vendorName || 'N/A'}\n`;
  markdown += `- **Invoice Number:** ${ocrResult.invoiceNumber || 'N/A'}\n`;
  markdown += `- **Invoice Date:** ${ocrResult.invoiceDate || 'N/A'}\n`;
  markdown += `- **Due Date:** ${ocrResult.dueDate || 'N/A'}\n`;
  markdown += `- **Total Amount:** ${ocrResult.totalAmount || 'N/A'}\n`;
  markdown += `- **Tax Amount:** ${ocrResult.taxAmount || 'N/A'}\n\n`;
  
  // Line items
  if (ocrResult.lineItems && ocrResult.lineItems.length > 0) {
    markdown += `## Line Items\n\n`;
    markdown += `| Description | Quantity | Unit Price | Amount |\n`;
    markdown += `|-------------|----------|------------|--------|\n`;
    
    ocrResult.lineItems.forEach(item => {
      markdown += `| ${item.description} | ${item.quantity} | $${item.unitPrice.toFixed(2)} | $${item.amount.toFixed(2)} |\n`;
    });
    
    markdown += `\n`;
  }
  
  // Handwritten notes
  if (ocrResult.handwrittenNotes && ocrResult.handwrittenNotes.length > 0) {
    markdown += `## Handwritten Notes\n\n`;
    
    ocrResult.handwrittenNotes.forEach(note => {
      markdown += `- ${note.text} _(confidence: ${(note.confidence * 100).toFixed(0)}%)_\n`;
    });
  }
  
  return markdown;
}

// Generate a JSON representation of the OCR extraction
export function generateJSONOutput(ocrResult: OCRResult): string {
  return JSON.stringify(ocrResult, null, 2);
}