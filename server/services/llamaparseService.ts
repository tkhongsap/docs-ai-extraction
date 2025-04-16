/**
 * LlamaParse Service
 * 
 * Provides specialized functionality for working with LlamaParse OCR service
 * and processing its extraction results for display in the Review Page.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { config } from '../config';
import { 
  FieldConfidence, 
  LineItem, 
  HandwrittenNote, 
  LayoutPosition, 
  ProcessingMetadata 
} from '@shared/schema';

const { LLAMAPARSE_API_KEY } = config;

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

// Get MIME type from file extension
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.tiff': 'image/tiff',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

// Process document with LlamaParse
async function processDocument(filePath: string): Promise<LlamaParseResult> {
  // Start processing timestamp
  const startTime = Date.now();
  
  // Read file
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const fileExtension = path.extname(fileName).toLowerCase();

  // Validate API key
  if (!LLAMAPARSE_API_KEY) {
    throw new Error('LlamaParse API key is missing. Please add LLAMAPARSE_API_KEY to environment variables.');
  }

  // Custom extraction query for Thai and English invoices/POs
  const customExtractionQuery = `
    Extract the following information from this document (which may be an invoice or purchase order, in Thai or English):
    1. company_name
    2. address
    3. date
    4. invoice_numbers_or_po_numbers
    5. items (a list of objects, each with name, quantity, and price). Extract every item listed in the document, and do not omit any items unless they are crossed out or struck through.
       - If an item is crossed out but replaced by another value (e.g., a handwritten correction), only display the replacement value in the output (not the crossed-out one).
       - If you are unsure about any item, indicate so.
    6. total_amount
    7. other (any additional relevant information not covered above)

    This document may be entirely or partially in Thai or English, and it may contain handwritten text. Carefully extract the information, ignoring any crossed-out or struck-through items.
    If any item was crossed out but replaced with a handwritten correction, use the new corrected value and exclude the crossed-out version.
  `;

  // Process with LlamaParse API
  let llamaparseResponse;
  try {
    // Try multiple possible API endpoints since the correct one might have changed
    const possibleEndpoints = [
      'https://api.llamaindex.ai/v1/parsing/parse_file',
      'https://api.llamaindex.ai/api/parse',
      'https://api.llamaparse.ai/api/v1/parse',
      'https://api-inference.huggingface.co/models/llama/parse'
    ];
    
    // Create form data for upload
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: fileName,
      contentType: getMimeType(fileExtension)
    });
    
    // Add parameters to optimize for invoice processing
    form.append('parsing_mode', 'invoice');
    form.append('output_detail_level', 'high');
    form.append('include_positions', 'true');
    form.append('include_confidence', 'true');
    
    // Add our custom extraction query
    form.append('custom_query', customExtractionQuery);
    
    // Try each endpoint in sequence
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
          timeout: 120000, // Increase timeout to 120 seconds for large files
          maxContentLength: 50 * 1024 * 1024, // Increase to 50MB for larger files
          maxBodyLength: 50 * 1024 * 1024, // Also increase maxBodyLength
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
      } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        throw new Error('LlamaParse API error: Request timed out - The document may be too large or complex to process. Please try a smaller document or try again later.');
      } else if (error.message?.includes('exceeded')) {
        throw new Error('LlamaParse API error: File size limit exceeded - The document is too large. Please try a smaller document or reduce the file size.');
      }
    }
    
    throw new Error(`LlamaParse API error: ${error.message}`);
  }

  // End processing timestamp
  const endTime = Date.now();
  const processingTime = endTime - startTime;

  // Process LlamaParse response
  const llamaData = llamaparseResponse.data;
  
  // Map the custom extraction fields to our standard fields
  // This handles the Thai/English extraction results
  const vendorName = llamaData.company_name || llamaData.vendor_name;
  const vendorAddress = llamaData.address || llamaData.vendor_address;
  const invoiceNumber = llamaData.invoice_numbers_or_po_numbers || llamaData.invoice_number;
  const invoiceDate = llamaData.date ? new Date(llamaData.date) : 
                    (llamaData.invoice_date ? new Date(llamaData.invoice_date) : undefined);
  
  // Process line items (check both standard and custom formats)
  const rawLineItems = llamaData.items || llamaData.line_items || [];
  const lineItems = rawLineItems.map((item: any) => {
    // Handle different item structures
    if (item.name && item.quantity !== undefined && item.price !== undefined) {
      // Format from custom extraction
      return {
        description: item.name || 'Unknown Item',
        quantity: parseFloat(item.quantity) || 1,
        unitPrice: parseFloat(item.price) || 0,
        amount: (parseFloat(item.quantity) || 1) * (parseFloat(item.price) || 0),
        confidence: item.confidence || 75
      };
    } else {
      // Standard format (from default LlamaParse processing)
      return {
        description: item.description || 'Unknown Item',
        quantity: parseFloat(item.quantity) || 1,
        unitPrice: parseFloat(item.unit_price) || 0,
        amount: parseFloat(item.amount) || 0,
        itemCode: item.item_code || item.sku || undefined,
        category: item.category || undefined,
        taxRate: item.tax_rate ? parseFloat(item.tax_rate) : undefined,
        discount: item.discount ? parseFloat(item.discount) : undefined,
        confidence: item.confidence || 75
      };
    }
  });
  
  // Calculate confidence scores
  const confidenceScores = computeConfidenceScores(llamaData);
  
  // Extract layout positions for field highlighting
  const layoutData = extractLayoutPositions(llamaData);

  // Create processing metadata
  const processingMetadata: ProcessingMetadata = {
    ocrEngine: 'LlamaParse',
    processingTime,
    processingTimestamp: new Date().toISOString(),
    processingParams: {
      model: 'LlamaParse Invoice Parser',
      confidence_threshold: 0.5,
      customQuery: true,
    },
    documentClassification: llamaData.document_type || 'Invoice'
  };

  // Create final result for extraction
  const result: LlamaParseResult = {
    // Basic invoice information
    vendorName: vendorName,
    vendorAddress: vendorAddress,
    vendorContact: llamaData.vendor_contact_info || llamaData.vendor_phone || llamaData.vendor_email,
    clientName: llamaData.client_name || llamaData.customer_name,
    clientAddress: llamaData.client_address || llamaData.customer_address,
    invoiceNumber: invoiceNumber,
    invoiceDate: invoiceDate,
    dueDate: llamaData.due_date ? new Date(llamaData.due_date) : undefined,
    totalAmount: parseFloat(llamaData.total_amount) || undefined,
    subtotalAmount: parseFloat(llamaData.subtotal_amount) || parseFloat(llamaData.subtotal) || undefined,
    taxAmount: parseFloat(llamaData.tax_amount) || undefined,
    discountAmount: parseFloat(llamaData.discount_amount) || parseFloat(llamaData.discount) || undefined,
    currency: llamaData.currency || 'THB', // Default to THB for Thai documents
    paymentTerms: llamaData.payment_terms,
    paymentMethod: llamaData.payment_method,
    
    // Additional info from the custom extraction
    additionalInfo: llamaData.other,
    
    // Structured data
    lineItems,
    
    // Metadata
    confidenceScores,
    layoutData,
    processingMetadata
  };
  
  return result;
}

// Generate Markdown output from extraction
function generateMarkdownOutput(extraction: any): string {
  let markdown = '# Extracted Document Data\n\n';
  
  // Vendor Information
  markdown += '## Vendor Information\n\n';
  if (extraction.vendorName) markdown += `**Vendor Name:** ${extraction.vendorName}\n`;
  if (extraction.vendorAddress) markdown += `**Vendor Address:** ${extraction.vendorAddress}\n`;
  if (extraction.vendorContact) markdown += `**Vendor Contact:** ${extraction.vendorContact}\n\n`;
  
  // Client Information
  if (extraction.clientName || extraction.clientAddress) {
    markdown += '## Client Information\n\n';
    if (extraction.clientName) markdown += `**Client Name:** ${extraction.clientName}\n`;
    if (extraction.clientAddress) markdown += `**Client Address:** ${extraction.clientAddress}\n\n`;
  }
  
  // Invoice Details
  markdown += '## Invoice Details\n\n';
  if (extraction.invoiceNumber) markdown += `**Invoice Number/PO Number:** ${extraction.invoiceNumber}\n`;
  if (extraction.invoiceDate) {
    const date = extraction.invoiceDate instanceof Date 
      ? extraction.invoiceDate.toISOString().split('T')[0]
      : new Date(extraction.invoiceDate).toISOString().split('T')[0];
    markdown += `**Invoice Date:** ${date}\n`;
  }
  if (extraction.dueDate) {
    const date = extraction.dueDate instanceof Date 
      ? extraction.dueDate.toISOString().split('T')[0]
      : new Date(extraction.dueDate).toISOString().split('T')[0];
    markdown += `**Due Date:** ${date}\n`;
  }
  if (extraction.currency) markdown += `**Currency:** ${extraction.currency}\n`;
  if (extraction.paymentTerms) markdown += `**Payment Terms:** ${extraction.paymentTerms}\n`;
  if (extraction.paymentMethod) markdown += `**Payment Method:** ${extraction.paymentMethod}\n\n`;
  
  // Pricing Summary
  markdown += '## Pricing Summary\n\n';
  if (extraction.subtotalAmount !== undefined) {
    const amount = typeof extraction.subtotalAmount === 'string' 
      ? extraction.subtotalAmount
      : extraction.subtotalAmount.toFixed(2);
    markdown += `**Subtotal:** ${amount}\n`;
  }
  if (extraction.taxAmount !== undefined) {
    const amount = typeof extraction.taxAmount === 'string' 
      ? extraction.taxAmount
      : extraction.taxAmount.toFixed(2);
    markdown += `**Tax:** ${amount}\n`;
  }
  if (extraction.discountAmount !== undefined) {
    const amount = typeof extraction.discountAmount === 'string' 
      ? extraction.discountAmount
      : extraction.discountAmount.toFixed(2);
    markdown += `**Discount:** ${amount}\n`;
  }
  if (extraction.totalAmount !== undefined) {
    const amount = typeof extraction.totalAmount === 'string' 
      ? extraction.totalAmount
      : extraction.totalAmount.toFixed(2);
    markdown += `**Total Amount:** ${amount}\n\n`;
  }
  
  // Line Items
  if (extraction.lineItems && extraction.lineItems.length > 0) {
    markdown += '## Line Items\n\n';
    markdown += '| Description | Item Code | Quantity | Unit Price | Amount |\n';
    markdown += '|-------------|-----------|----------|------------|--------|\n';
    
    for (const item of extraction.lineItems) {
      markdown += `| ${item.description} | ${item.itemCode || 'N/A'} | ${item.quantity} | ${item.unitPrice.toFixed(2)} | ${item.amount.toFixed(2)} |\n`;
    }
    markdown += '\n';
  }
  
  // Additional Information (for Thai/English extraction)
  if (extraction.additionalInfo) {
    markdown += '## Additional Information\n\n';
    markdown += `${extraction.additionalInfo}\n\n`;
  }
  
  // Handwritten Notes
  if (extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0) {
    markdown += '## Handwritten Notes\n\n';
    
    for (const note of extraction.handwrittenNotes) {
      markdown += `- ${note.text} _(confidence: ${note.confidence}%)_\n`;
    }
    markdown += '\n';
  }
  
  // Confidence Scores
  if (extraction.confidenceScores) {
    markdown += '## Confidence Scores\n\n';
    markdown += `**Overall Confidence:** ${extraction.confidenceScores.overall}%\n`;
    markdown += `**Vendor Information:** ${extraction.confidenceScores.vendorInfo}%\n`;
    markdown += `**Invoice Details:** ${extraction.confidenceScores.invoiceDetails}%\n`;
    markdown += `**Line Items:** ${extraction.confidenceScores.lineItems}%\n`;
    markdown += `**Totals:** ${extraction.confidenceScores.totals}%\n`;
    if (extraction.confidenceScores.handwrittenNotes) {
      markdown += `**Handwritten Notes:** ${extraction.confidenceScores.handwrittenNotes}%\n\n`;
    }
  }
  
  // Processing Metadata
  if (extraction.processingMetadata) {
    markdown += '## Processing Metadata\n\n';
    markdown += `**OCR Engine:** ${extraction.processingMetadata.ocrEngine}\n`;
    markdown += `**Processing Time:** ${extraction.processingMetadata.processingTime}ms\n`;
    markdown += `**Timestamp:** ${extraction.processingMetadata.processingTimestamp}\n`;
    
    if (extraction.processingMetadata.documentClassification) {
      markdown += `**Document Classification:** ${extraction.processingMetadata.documentClassification}\n`;
    }
    
    if (extraction.processingMetadata.customQuery) {
      markdown += `**Custom Extraction:** Yes (Thai/English)\n`;
    }
  }
  
  return markdown;
}

// Generate JSON output
function generateJSONOutput(extraction: any): string {
  return JSON.stringify(extraction, null, 2);
}

// Generate CSV output
function generateCSVOutput(extraction: any): string {
  let csv = '';
  
  // Add header information
  csv += 'Field,Value\n';
  if (extraction.vendorName) csv += `Vendor Name/Company,${extraction.vendorName}\n`;
  if (extraction.vendorAddress) csv += `Vendor Address,${extraction.vendorAddress}\n`;
  if (extraction.vendorContact) csv += `Vendor Contact,${extraction.vendorContact}\n`;
  if (extraction.clientName) csv += `Client Name,${extraction.clientName}\n`;
  if (extraction.clientAddress) csv += `Client Address,${extraction.clientAddress}\n`;
  if (extraction.invoiceNumber) csv += `Invoice/PO Number,${extraction.invoiceNumber}\n`;
  
  if (extraction.invoiceDate) {
    const date = extraction.invoiceDate instanceof Date 
      ? extraction.invoiceDate.toISOString().split('T')[0]
      : new Date(extraction.invoiceDate).toISOString().split('T')[0];
    csv += `Invoice Date,${date}\n`;
  }
  
  if (extraction.dueDate) {
    const date = extraction.dueDate instanceof Date 
      ? extraction.dueDate.toISOString().split('T')[0]
      : new Date(extraction.dueDate).toISOString().split('T')[0];
    csv += `Due Date,${date}\n`;
  }
  
  if (extraction.currency) csv += `Currency,${extraction.currency}\n`;
  if (extraction.subtotalAmount) csv += `Subtotal,${extraction.subtotalAmount}\n`;
  if (extraction.taxAmount) csv += `Tax,${extraction.taxAmount}\n`;
  if (extraction.discountAmount) csv += `Discount,${extraction.discountAmount}\n`;
  if (extraction.totalAmount) csv += `Total Amount,${extraction.totalAmount}\n`;
  
  // Additional info for Thai/English
  if (extraction.additionalInfo) csv += `Additional Info,"${extraction.additionalInfo.replace(/"/g, '""')}"\n`;
  
  csv += '\n';
  
  // Add line items
  if (extraction.lineItems && extraction.lineItems.length > 0) {
    csv += 'Line Items\n';
    csv += 'Description,Item Code,Quantity,Unit Price,Amount\n';
    
    for (const item of extraction.lineItems) {
      const description = item.description ? `"${item.description.replace(/"/g, '""')}"` : '';
      const itemCode = item.itemCode || 'N/A';
      const quantity = item.quantity;
      const unitPrice = item.unitPrice.toFixed(2);
      const amount = item.amount.toFixed(2);
      
      csv += `${description},${itemCode},${quantity},${unitPrice},${amount}\n`;
    }
    
    csv += '\n';
  }
  
  // Add handwritten notes
  if (extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0) {
    csv += 'Handwritten Notes\n';
    csv += 'Text,Confidence\n';
    
    for (const note of extraction.handwrittenNotes) {
      const text = note.text ? `"${note.text.replace(/"/g, '""')}"` : '';
      const confidence = note.confidence || 0;
      
      csv += `${text},${confidence}\n`;
    }
    
    csv += '\n';
  }
  
  // Add confidence scores
  if (extraction.confidenceScores) {
    csv += 'Confidence Scores\n';
    csv += 'Category,Score\n';
    csv += `Overall,${extraction.confidenceScores.overall}\n`;
    csv += `Vendor Information,${extraction.confidenceScores.vendorInfo}\n`;
    csv += `Invoice Details,${extraction.confidenceScores.invoiceDetails}\n`;
    csv += `Line Items,${extraction.confidenceScores.lineItems}\n`;
    csv += `Totals,${extraction.confidenceScores.totals}\n`;
    if (extraction.confidenceScores.handwrittenNotes) {
      csv += `Handwritten Notes,${extraction.confidenceScores.handwrittenNotes}\n`;
    }
    
    csv += '\n';
  }
  
  return csv;
}

// Calculate average confidence for a field category
function calculateCategoryConfidence(fieldConfidences: Record<string, number>, fieldPrefix: string): number {
  const categoryFields = Object.entries(fieldConfidences).filter(([key]) => key.startsWith(fieldPrefix));
  
  if (categoryFields.length === 0) return 0;
  
  const sum = categoryFields.reduce((acc, [, confidence]) => acc + confidence, 0);
  return Math.round(sum / categoryFields.length);
}

// Compute confidence scores from LlamaParse response
function computeConfidenceScores(llamaparseData: any): FieldConfidence {
  // Extract field-specific confidence scores from LlamaParse response
  const fieldSpecific: Record<string, number> = {};
  
  // Populate field-specific confidences from each section of the response
  // Vendor info
  if (llamaparseData.vendor_confidence) fieldSpecific['vendor_name'] = llamaparseData.vendor_confidence;
  if (llamaparseData.vendor_address_confidence) fieldSpecific['vendor_address'] = llamaparseData.vendor_address_confidence;
  
  // Invoice details
  if (llamaparseData.invoice_number_confidence) fieldSpecific['invoice_number'] = llamaparseData.invoice_number_confidence;
  if (llamaparseData.invoice_date_confidence) fieldSpecific['invoice_date'] = llamaparseData.invoice_date_confidence;
  if (llamaparseData.due_date_confidence) fieldSpecific['due_date'] = llamaparseData.due_date_confidence;
  
  // Totals
  if (llamaparseData.total_amount_confidence) fieldSpecific['total_amount'] = llamaparseData.total_amount_confidence;
  if (llamaparseData.subtotal_confidence) fieldSpecific['subtotal_amount'] = llamaparseData.subtotal_confidence;
  if (llamaparseData.tax_amount_confidence) fieldSpecific['tax_amount'] = llamaparseData.tax_amount_confidence;
  
  // If no confidence scores were provided, set default values based on fields
  // Set default confidence for essential fields that exist
  if (!fieldSpecific['vendor_name'] && llamaparseData.vendor_name) fieldSpecific['vendor_name'] = 90;
  if (!fieldSpecific['invoice_number'] && llamaparseData.invoice_number) fieldSpecific['invoice_number'] = 90;
  if (!fieldSpecific['total_amount'] && llamaparseData.total_amount) fieldSpecific['total_amount'] = 85;
  
  // Calculate category confidences
  const vendorInfo = calculateCategoryConfidence(fieldSpecific, 'vendor_') || 
                    (llamaparseData.vendor_name ? 85 : 0);
                    
  const invoiceDetails = calculateCategoryConfidence(fieldSpecific, 'invoice_') ||
                        (llamaparseData.invoice_number ? 85 : 0);
                        
  const totals = calculateCategoryConfidence(fieldSpecific, 'total_') || 
               ((fieldSpecific['total_amount'] || 0) + 
               (fieldSpecific['subtotal_amount'] || 0) + 
               (fieldSpecific['tax_amount'] || 0)) / 3 ||
               (llamaparseData.total_amount ? 85 : 0);
  
  // Line items confidence (average)
  const lineItemsConfidence = llamaparseData.line_items?.length > 0 
    ? Math.round(llamaparseData.line_items.reduce((sum: number, item: any) => sum + (item.confidence || 75), 0) / 
                 llamaparseData.line_items.length)
    : 0;
  
  // Calculate overall confidence as weighted average of all categories
  const weights = { 
    vendorInfo: 0.2, 
    invoiceDetails: 0.3, 
    lineItems: 0.3, 
    totals: 0.2,
    handwrittenNotes: 0 // Handwritten notes handled separately by OpenAI Vision
  };
  
  let overallScore = 0;
  let totalWeight = 0;
  
  if (vendorInfo > 0) {
    overallScore += vendorInfo * weights.vendorInfo;
    totalWeight += weights.vendorInfo;
  }
  
  if (invoiceDetails > 0) {
    overallScore += invoiceDetails * weights.invoiceDetails;
    totalWeight += weights.invoiceDetails;
  }
  
  if (lineItemsConfidence > 0) {
    overallScore += lineItemsConfidence * weights.lineItems;
    totalWeight += weights.lineItems;
  }
  
  if (totals > 0) {
    overallScore += totals * weights.totals;
    totalWeight += weights.totals;
  }
  
  // Calculate overall score, avoiding division by zero
  const overall = totalWeight > 0 
    ? Math.round(overallScore / totalWeight)
    : 0;
  
  return {
    overall,
    vendorInfo,
    invoiceDetails,
    lineItems: lineItemsConfidence,
    totals,
    handwrittenNotes: 0, // Will be updated after OpenAI Vision processing
    fieldSpecific
  };
}

// Extract layout position data from LlamaParse response
function extractLayoutPositions(llamaparseData: any): LayoutPosition[] {
  const layoutPositions: LayoutPosition[] = [];
  
  // Process positions from field positions if available
  if (llamaparseData.field_positions) {
    Object.entries(llamaparseData.field_positions).forEach(([fieldName, position]: [string, any]) => {
      layoutPositions.push({
        pageNumber: position.page || 1,
        boundingBox: {
          x1: position.x1 || 0,
          y1: position.y1 || 0,
          x2: position.x2 || 0,
          y2: position.y2 || 0
        },
        fieldType: fieldName.split('_')[0],
        fieldName
      });
    });
  }
  
  // Process line item positions if available
  if (llamaparseData.line_items) {
    llamaparseData.line_items.forEach((item: any, index: number) => {
      if (item.position) {
        layoutPositions.push({
          pageNumber: item.position.page || 1,
          boundingBox: {
            x1: item.position.x1 || 0,
            y1: item.position.y1 || 0,
            x2: item.position.x2 || 0,
            y2: item.position.y2 || 0
          },
          fieldType: 'line_item',
          fieldName: `line_item_${index}`
        });
      }
    });
  }
  
  return layoutPositions;
}

// Update confidence scores for handwritten notes
function updateHandwrittenNotesConfidence(
  confidenceScores: FieldConfidence, 
  handwrittenNotes: HandwrittenNote[]
): FieldConfidence {
  if (!handwrittenNotes || handwrittenNotes.length === 0) {
    return confidenceScores;
  }
  
  const notesConfidence = Math.round(
    handwrittenNotes.reduce((sum, note) => sum + note.confidence, 0) / handwrittenNotes.length
  );
  
  // Create a copy of the confidence scores with updated handwritten notes confidence
  return {
    ...confidenceScores,
    handwrittenNotes: notesConfidence
  };
}

// Recalculate overall confidence when a section is updated
function recalculateOverallConfidence(
  currentScores: FieldConfidence, 
  newSectionScore: number, 
  sectionName: keyof FieldConfidence
): number {
  // Define weights for different sections
  const weights: Record<string, number> = {
    vendorInfo: 0.2,
    invoiceDetails: 0.3,
    lineItems: 0.3,
    totals: 0.2,
    handwrittenNotes: 0 // Not included in overall calculation
  };
  
  // Calculate new overall score
  let overall = 0;
  let totalWeight = 0;
  
  for (const [section, weight] of Object.entries(weights)) {
    // Skip sections with no data
    if (section === sectionName) {
      if (newSectionScore > 0) {
        overall += newSectionScore * weight;
        totalWeight += weight;
      }
    } else {
      const score = currentScores[section as keyof FieldConfidence] as number;
      if (score > 0) {
        overall += score * weight;
        totalWeight += weight;
      }
    }
  }
  
  // Avoid division by zero
  return totalWeight > 0 ? Math.round(overall / totalWeight) : 0;
}

export default {
  processDocument,
  generateMarkdownOutput,
  generateJSONOutput,
  generateCSVOutput,
  updateHandwrittenNotesConfidence,
  recalculateOverallConfidence
}; 