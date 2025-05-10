/**
 * Document Extraction Exporters
 * 
 * This module provides utility functions for exporting extraction data
 * in various formats (CSV, Markdown, JSON).
 */

/**
 * Generate CSV output from extraction data
 * 
 * @param {any} extraction - The extraction data object
 * @returns {string} - CSV formatted data
 */
export function generateCSVOutput(extraction: any): string {
  if (!extraction) return '';
  
  // Build basic invoice data
  let csvOutput = '';
  
  // Header for invoice details
  csvOutput += 'Invoice Details\n';
  csvOutput += 'VendorName,VendorAddress,VendorContact,InvoiceNumber,InvoiceDate,DueDate,Subtotal,Tax,Total,Currency\n';
  
  // Invoice data row
  csvOutput += `"${extraction.vendorName || ''}","${extraction.vendorAddress || ''}","${extraction.vendorContact || ''}","${extraction.invoiceNumber || ''}","${extraction.invoiceDate ? new Date(extraction.invoiceDate).toISOString().split('T')[0] : ''}","${extraction.dueDate ? new Date(extraction.dueDate).toISOString().split('T')[0] : ''}",${extraction.subtotalAmount || 0},${extraction.taxAmount || 0},${extraction.totalAmount || 0},"${extraction.currency || 'USD'}"\n\n`;
  
  // Add line items if they exist
  if (extraction.lineItems && extraction.lineItems.length > 0) {
    csvOutput += 'Line Items\n';
    
    // Get headers from the first line item
    const firstItem = extraction.lineItems[0];
    const headers = Object.keys(firstItem).join(',');
    csvOutput += `${headers}\n`;
    
    // Add each line item
    for (const item of extraction.lineItems) {
      const values = Object.values(item).map(v => typeof v === 'string' ? `"${v}"` : v).join(',');
      csvOutput += `${values}\n`;
    }
  }
  
  return csvOutput;
}

/**
 * Generate Markdown output from extraction data
 * 
 * @param {any} extraction - The extraction data object
 * @returns {string} - Markdown formatted data
 */
export function generateMarkdownOutput(extraction: any): string {
  if (!extraction) return '';
  
  let mdOutput = '# Invoice Details\n\n';
  
  // Vendor information
  mdOutput += '## Vendor Information\n\n';
  mdOutput += `**Vendor Name:** ${extraction.vendorName || 'N/A'}\n`;
  mdOutput += `**Vendor Address:** ${extraction.vendorAddress || 'N/A'}\n`;
  mdOutput += `**Vendor Contact:** ${extraction.vendorContact || 'N/A'}\n\n`;
  
  // Invoice details
  mdOutput += '## Invoice Details\n\n';
  mdOutput += `**Invoice Number:** ${extraction.invoiceNumber || 'N/A'}\n`;
  mdOutput += `**Invoice Date:** ${extraction.invoiceDate ? new Date(extraction.invoiceDate).toISOString().split('T')[0] : 'N/A'}\n`;
  mdOutput += `**Due Date:** ${extraction.dueDate ? new Date(extraction.dueDate).toISOString().split('T')[0] : 'N/A'}\n\n`;
  
  // Totals
  mdOutput += '## Totals\n\n';
  mdOutput += `**Subtotal:** ${extraction.subtotalAmount || '0'} ${extraction.currency || 'USD'}\n`;
  mdOutput += `**Tax:** ${extraction.taxAmount || '0'} ${extraction.currency || 'USD'}\n`;
  mdOutput += `**Total:** ${extraction.totalAmount || '0'} ${extraction.currency || 'USD'}\n\n`;
  
  // Line items
  if (extraction.lineItems && extraction.lineItems.length > 0) {
    mdOutput += '## Line Items\n\n';
    
    // Create table header
    const firstItem = extraction.lineItems[0];
    mdOutput += '| ' + Object.keys(firstItem).join(' | ') + ' |\n';
    mdOutput += '| ' + Object.keys(firstItem).map(() => '---').join(' | ') + ' |\n';
    
    // Add each line item as a row
    for (const item of extraction.lineItems) {
      mdOutput += '| ' + Object.values(item).map(v => v || 'N/A').join(' | ') + ' |\n';
    }
    
    mdOutput += '\n';
  }
  
  // Handwritten notes
  if (extraction.handwrittenNotes) {
    mdOutput += '## Handwritten Notes\n\n';
    mdOutput += `${extraction.handwrittenNotes}\n\n`;
  }
  
  return mdOutput;
}

/**
 * Generate structured JSON output from extraction data
 * 
 * @param {any} extraction - The extraction data object
 * @param {any} document - The associated document metadata
 * @returns {string} - Formatted JSON string
 */
export function generateJSONOutput(extraction: any, document: any): string {
  if (!extraction) return '{}';
  
  const exportData = {
    documentInfo: {
      vendor: extraction.vendorName,
      invoiceNumber: extraction.invoiceNumber,
      invoiceDate: extraction.invoiceDate,
      dueDate: extraction.dueDate,
      totalAmount: extraction.totalAmount,
      taxAmount: extraction.taxAmount
    },
    lineItems: extraction.lineItems,
    handwrittenNotes: extraction.handwrittenNotes,
    metadata: {
      documentId: extraction.documentId,
      extractionId: extraction.id,
      processedDate: document?.uploadDate
    }
  };
  
  return JSON.stringify(exportData, null, 2);
} 