import fs from 'fs';
import path from 'path';
import { LineItem, HandwrittenNote } from '@shared/schema';
import { Mistral } from '@mistralai/mistralai';
import { promisify } from 'util';
import { exec } from 'child_process';

// Promisify exec for async/await usage
const execAsync = promisify(exec);

// OCR service API keys from environment variables
const mistralApiKey = process.env.MISTRAL_API_KEY || '';
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const llamaParseApiKey = process.env.LLAMAPARSE_API_KEY || '';

// Directory for temporary files
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Initialize Mistral client
const mistralClient = new Mistral({ apiKey: mistralApiKey });

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

// Helper function to convert PDF to image - not currently used but kept for future reference
async function convertPdfToImage(pdfPath: string): Promise<string> {
  console.log('Converting PDF to image...');
  const randomId = Math.random().toString(36).substring(2, 15);
  const outputImagePath = path.join(tempDir, `${randomId}_page_1.png`);
  
  try {
    // Use pdftoppm from poppler to convert first page of PDF to PNG
    // -f 1 -l 1: process only the first page
    // -r 300: resolution 300 DPI
    // -png: output format
    await execAsync(`pdftoppm -f 1 -l 1 -r 300 -png "${pdfPath}" "${path.join(tempDir, randomId)}_page"`);
    
    if (fs.existsSync(outputImagePath)) {
      console.log(`Successfully converted PDF to image: ${outputImagePath}`);
      return outputImagePath;
    } else {
      throw new Error('Failed to convert PDF to image');
    }
  } catch (err) {
    const error = err as Error;
    console.error('Error converting PDF to image:', error);
    throw new Error(`Failed to convert PDF to image: ${error.message}`);
  }
}

// Process PDF documents
async function processPdfDocument(filePath: string, ocrService: string): Promise<OCRResult> {
  console.log(`Processing PDF document using ${ocrService} OCR...`);

  try {
    // Process directly with the appropriate service
    switch (ocrService) {
      case 'mistral':
        return await processMistralOCR(filePath, true);
      case 'openai':
        return await processOpenAIOCR(filePath, true);
      case 'llamaparse':
        return await processLlamaParseOCR(filePath, true);
      default:
        // Default to Mistral
        return await processMistralOCR(filePath, true);
    }
  } catch (error) {
    console.error('Error in PDF processing:', error);
    throw error;
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
    
    // Read the actual file content
    console.log(`Reading file from path: ${filePath}`);
    const fileContent = fs.readFileSync(filePath);
    console.log(`File size: ${fileContent.length} bytes`);
    
    // Check if file is too large (Mistral has an 8MB limit for files)
    const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB in bytes
    if (fileContent.length > MAX_SIZE_BYTES) {
      console.warn(`File is too large (${fileContent.length} bytes), Mistral has an 8MB limit.`);
      throw new Error(`File is too large (${(fileContent.length/1024/1024).toFixed(2)}MB). Maximum size is 8MB for Mistral AI API.`);
    }
    
    // For testing/debugging, look at the file type
    const fileExt = path.extname(filePath).toLowerCase();
    console.log(`File extension: ${fileExt}`);
    
    // Determine the correct MIME type based on file extension
    let mimeType;
    if (isPdf) {
      mimeType = 'application/pdf';
    } else {
      // Set proper image MIME type based on file extension
      switch (fileExt) {
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg';
          break;
        case '.png':
          mimeType = 'image/png';
          break;
        case '.tiff':
        case '.tif':
          mimeType = 'image/tiff';
          break;
        case '.bmp':
          mimeType = 'image/bmp';
          break;
        case '.gif':
          mimeType = 'image/gif';
          break;
        default:
          mimeType = 'image/jpeg'; // Default to JPEG if unknown
      }
    }
    
    console.log(`Using MIME type: ${mimeType} for file with extension: ${fileExt}`);
    
    // Convert file to base64
    const base64Content = fileContent.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Content}`;
    
    // For logging, show a small portion of the base64 string to verify format
    console.log(`Data URL starts with: ${dataUrl.substring(0, 50)}...`);
    
    // Create the prompt for Mistral AI
    const systemPrompt = `You are an expert OCR system specialized in invoice and document analysis. 
Your task is to analyze the provided document and extract structured information.

Extract the following fields:
1. Vendor name
2. Invoice number
3. Invoice date (in YYYY-MM-DD format)
4. Due date (in YYYY-MM-DD format)
5. Total amount (with currency symbol)
6. Tax amount (with currency symbol)
7. Line items (description, quantity, unit price, amount)
8. Any handwritten notes

BE CAREFUL: Always extract the exact information from the document. Do not make up or guess any values that aren't clearly visible in the document.
If information is not present, return null for that field. Do not use placeholder data.

Return the information in JSON format exactly like this:
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
}`;

    // Construct the API request
    const requestBody = {
      model: "mistral-large-latest",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please extract information from this ${isPdf ? 'PDF invoice' : 'invoice image'}.`
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl
              }
            }
          ]
        }
      ],
      temperature: 0
    };
    
    console.log('Sending request to Mistral API...');
    
    // Make the API request
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralApiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    // Parse the response
    const responseData = await response.json();
    
    // Check for API errors
    if (!response.ok) {
      console.error('Mistral API Error:', responseData);
      throw new Error(`Mistral API Error: ${responseData.error?.message || JSON.stringify(responseData)}`);
    }
    
    // Extract the assistant's message
    if (!responseData.choices || responseData.choices.length === 0) {
      throw new Error('Empty response from Mistral API');
    }
    
    const assistantMessage = responseData.choices[0].message.content;
    console.log('Received response from Mistral:', assistantMessage);
    
    try {
      // Use a regex to extract JSON object if it's wrapped in markdown code blocks
      const jsonMatch = assistantMessage.match(/```(?:json)?([\s\S]*?)```/) || 
                        assistantMessage.match(/{[\s\S]*?}/);
      
      if (!jsonMatch) {
        throw new Error('Could not find valid JSON in the response');
      }
      
      const jsonText = jsonMatch[0].replace(/```json|```/g, '');
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
    } catch (err) {
      const error = err as Error;
      console.error('Error parsing JSON from Mistral response:', error);
      console.log('Raw response:', assistantMessage);
      throw new Error(`Failed to parse Mistral AI response: ${error.message}`);
    }
  } catch (err) {
    const error = err as Error;
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