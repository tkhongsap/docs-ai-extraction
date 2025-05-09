/**
 * LlamaParse Wrapper Service
 * 
 * Provides a wrapper around the Python LlamaParse implementation
 * Uses the official LlamaParse Python library instead of direct API calls
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { 
  FieldConfidence, 
  LineItem, 
  HandwrittenNote, 
  LayoutPosition, 
  ProcessingMetadata 
} from '@shared/schema';

// Interface for LlamaParse extraction result
export interface LlamaParseResult {
  // Basic invoice fields
  vendorName?: string;
  vendorAddress?: string;
  vendorContact?: string;
  clientName?: string;
  clientAddress?: string;
  invoiceNumber?: string;
  invoiceDate?: Date;
  dueDate?: Date;
  totalAmount?: number;
  subtotalAmount?: number;
  taxAmount?: number;
  discountAmount?: number;
  currency?: string;
  paymentTerms?: string;
  paymentMethod?: string;
  
  // Additional information from Thai/English extraction
  additionalInfo?: string;
  
  // Structured data
  lineItems: LineItem[];
  handwrittenNotes?: HandwrittenNote[];
  
  // Metadata
  confidenceScores: FieldConfidence;
  layoutData: LayoutPosition[];
  processingMetadata: ProcessingMetadata;
}

/**
 * Process a document using the LlamaParse Python library via our wrapper script
 * @param filePath Path to the document file
 * @returns Processed document extraction result
 */
async function processDocument(filePath: string): Promise<LlamaParseResult> {
  // Start processing timestamp
  const startTime = Date.now();

  // Verify file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Convert to absolute path if not already
  const absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  
  console.log(`Processing document ${absoluteFilePath} with LlamaParse Python wrapper`);
  
  try {
    // Call Python script with file path
    const pythonScript = path.join(__dirname, '../scripts/simple_llama_wrapper.py');
    
    // Make sure our Python script is executable
    fs.chmodSync(pythonScript, 0o755);

    // Call Python script and wait for response
    const result = await new Promise<string>((resolve, reject) => {
      // We use spawn instead of exec to handle larger outputs
      const pythonProcess = spawn('python3', [pythonScript, absoluteFilePath, '--document-type', 'invoice']);
      
      let stdoutData = '';
      let stderrData = '';
      
      // Collect stdout data
      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      // Collect stderr data
      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.log(`LlamaParse Python stderr: ${data.toString()}`);
      });
      
      // Handle process completion
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`LlamaParse Python process exited with code ${code}`);
          console.error(`stderr: ${stderrData}`);
          reject(new Error(`LlamaParse Python process failed with code ${code}: ${stderrData}`));
        } else {
          console.log(`LlamaParse Python process completed successfully`);
          resolve(stdoutData);
        }
      });
      
      // Handle process error
      pythonProcess.on('error', (err) => {
        reject(err);
      });
    });
    
    // End processing timestamp
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    // Parse the JSON response
    const llamaParseResponse = JSON.parse(result);
    
    if (llamaParseResponse.status === 'error') {
      throw new Error(`LlamaParse error: ${llamaParseResponse.error}`);
    }
    
    // Direct mapping from response
    const confidenceScores = llamaParseResponse.confidenceScores;
    const layoutData = llamaParseResponse.layoutData || [];
    const processingMetadata = llamaParseResponse.processingMetadata;
    
    // Map extraction data to our standard format
    const lineItems: LineItem[] = [];
    
    // Process line items from the extraction
    if (llamaParseResponse.lineItems && Array.isArray(llamaParseResponse.lineItems)) {
      llamaParseResponse.lineItems.forEach((item: any) => {
        lineItems.push(item);
      });
    }
    
    // Use handwritten notes or create empty array
    const handwrittenNotes: HandwrittenNote[] = llamaParseResponse.handwrittenNotes || [];
    
    // Map other data from direct response
    return {
      vendorName: llamaParseResponse.vendorName,
      vendorAddress: llamaParseResponse.vendorAddress,
      invoiceNumber: llamaParseResponse.invoiceNumber,
      invoiceDate: llamaParseResponse.invoiceDate ? new Date(llamaParseResponse.invoiceDate) : undefined,
      totalAmount: llamaParseResponse.totalAmount || 0,
      additionalInfo: llamaParseResponse.additionalInfo,
      lineItems,
      handwrittenNotes,
      confidenceScores,
      layoutData,
      processingMetadata: {
        ...processingMetadata,
        processingTime
      }
    };
  } catch (error: any) {
    console.error('Error processing document with LlamaParse Python wrapper:', error);
    throw error;
  }
}

/**
 * Generate Markdown output from extraction data
 */
function generateMarkdownOutput(extraction: any): string {
  const markdown = [
    `# Invoice Extraction Result\n`,
    `## Vendor Information`,
    `- **Vendor Name**: ${extraction.vendorName || 'N/A'}`,
    `- **Vendor Address**: ${extraction.vendorAddress || 'N/A'}`,
    `- **Vendor Contact**: ${extraction.vendorContact || 'N/A'}\n`,
    `## Invoice Details`,
    `- **Invoice Number**: ${extraction.invoiceNumber || 'N/A'}`,
    `- **Invoice Date**: ${extraction.invoiceDate ? new Date(extraction.invoiceDate).toLocaleDateString() : 'N/A'}`,
    `- **Due Date**: ${extraction.dueDate ? new Date(extraction.dueDate).toLocaleDateString() : 'N/A'}\n`,
    `## Line Items\n`
  ];
  
  if (extraction.lineItems && extraction.lineItems.length > 0) {
    markdown.push(`| Description | Quantity | Unit Price | Amount |`);
    markdown.push(`| ----------- | -------- | ---------- | ------ |`);
    
    extraction.lineItems.forEach((item: any) => {
      markdown.push(`| ${item.description || 'N/A'} | ${item.quantity || 'N/A'} | ${item.unitPrice || 'N/A'} | ${item.amount || 'N/A'} |`);
    });
  } else {
    markdown.push(`No line items found.`);
  }
  
  markdown.push(`\n## Totals`);
  markdown.push(`- **Subtotal**: ${extraction.subtotalAmount || 'N/A'}`);
  markdown.push(`- **Tax**: ${extraction.taxAmount || 'N/A'}`);
  markdown.push(`- **Discount**: ${extraction.discountAmount || 'N/A'}`);
  markdown.push(`- **Total**: ${extraction.totalAmount || 'N/A'}`);
  
  if (extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0) {
    markdown.push(`\n## Handwritten Notes`);
    extraction.handwrittenNotes.forEach((note: any, index: number) => {
      markdown.push(`${index + 1}. ${note.text}`);
    });
  }
  
  if (extraction.additionalInfo) {
    markdown.push(`\n## Additional Information`);
    markdown.push(extraction.additionalInfo);
  }
  
  return markdown.join('\n');
}

/**
 * Generate JSON output from extraction data
 */
function generateJSONOutput(extraction: any): string {
  // Create a clean object for JSON export
  const exportData = {
    documentInfo: {
      vendor: extraction.vendorName || '',
      vendorAddress: extraction.vendorAddress || '',
      vendorContact: extraction.vendorContact || '',
      client: extraction.clientName || '',
      clientAddress: extraction.clientAddress || '',
      invoiceNumber: extraction.invoiceNumber || '',
      invoiceDate: extraction.invoiceDate ? new Date(extraction.invoiceDate).toISOString() : null,
      dueDate: extraction.dueDate ? new Date(extraction.dueDate).toISOString() : null,
      totalAmount: typeof extraction.totalAmount === 'number' ? extraction.totalAmount : 
                  (typeof extraction.totalAmount === 'string' ? parseFloat(extraction.totalAmount) : 0),
      subtotalAmount: typeof extraction.subtotalAmount === 'number' ? extraction.subtotalAmount : 
                     (typeof extraction.subtotalAmount === 'string' ? parseFloat(extraction.subtotalAmount) : null),
      taxAmount: typeof extraction.taxAmount === 'number' ? extraction.taxAmount : 
                (typeof extraction.taxAmount === 'string' ? parseFloat(extraction.taxAmount) : null),
      currency: extraction.currency || '',
      paymentTerms: extraction.paymentTerms || '',
      paymentMethod: extraction.paymentMethod || '',
    },
    lineItems: Array.isArray(extraction.lineItems) ? extraction.lineItems : [],
    handwrittenNotes: Array.isArray(extraction.handwrittenNotes) ? extraction.handwrittenNotes : [],
    additionalInfo: extraction.additionalInfo || '',
    metadata: {
      ocrEngine: extraction.processingMetadata?.ocrEngine || 'unknown',
      processingTime: extraction.processingMetadata?.processingTime || 0,
      processingTimestamp: extraction.processingMetadata?.processingTimestamp || new Date().toISOString(),
      documentClassification: extraction.processingMetadata?.documentClassification || 'invoice'
    },
    confidenceScores: extraction.confidenceScores || {
      overall: 80
    }
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate CSV output from extraction data
 */
function generateCSVOutput(extraction: any): string {
  // Header
  let csv = `"Description","Quantity","Unit Price","Amount"\n`;
  
  // Line items
  if (extraction.lineItems && extraction.lineItems.length > 0) {
    extraction.lineItems.forEach((item: any) => {
      csv += `"${(item.description || '').replace(/"/g, '""')}","${item.quantity || ''}","${item.unitPrice || ''}","${item.amount || ''}"\n`;
    });
  }
  
  return csv;
}

export default {
  processDocument,
  generateMarkdownOutput,
  generateJSONOutput,
  generateCSVOutput
};