/**
 * Extractions Routes
 * 
 * This module handles all routes related to data extraction from documents,
 * including retrieving, updating, and exporting extraction data in various formats.
 */
import { Router, Request, Response } from "express";
import { storage } from "../storage.js";
import { generateCSVOutput, generateMarkdownOutput, generateJSONOutput } from "../utils/exporters.js";

const router = Router();

// Get extraction data for document
router.get("/document/:documentId", async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.documentId);

    // Check if document exists
    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Get extraction data
    const extraction = await storage.getExtractionByDocumentId(documentId);

    if (!extraction) {
      return res.status(404).json({ message: "No extraction data found for this document" });
    }

    res.json(extraction);
  } catch (error) {
    console.error("Error getting extraction:", error);
    res.status(500).json({ message: "Failed to retrieve extraction data" });
  }
});

// Update extraction data
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const extraction = await storage.getExtraction(id);

    if (!extraction) {
      return res.status(404).json({ message: "Extraction not found" });
    }

    // Validate update data
    const updateData = req.body;

    // Update extraction
    const updatedExtraction = await storage.updateExtraction(id, updateData);

    if (!updatedExtraction) {
      return res.status(500).json({ message: "Failed to update extraction" });
    }

    res.json(updatedExtraction);
  } catch (error) {
    console.error("Error updating extraction:", error);
    res.status(500).json({ message: "Failed to update extraction data" });
  }
});

// Export extraction data as Markdown
router.get("/:id/export/markdown", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const extraction = await storage.getExtraction(id);

    if (!extraction) {
      return res.status(404).json({ message: "Extraction not found" });
    }

    // If we already have a markdown output stored, use that
    if (extraction.markdownOutput) {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="extraction-${id}.md"`);
      return res.send(extraction.markdownOutput);
    }

    // Otherwise, fetch the document and generate a markdown output
    const document = await storage.getDocument(extraction.documentId);
    if (!document) {
      return res.status(404).json({ message: "Associated document not found" });
    }

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="extraction-${id}.md"`);

    // Create a basic markdown if we don't have stored markdown
    let markdown = `# Document Extraction\n\n`;
    markdown += `## Document Info\n\n`;
    markdown += `- **Vendor**: ${extraction.vendorName || 'Unknown'}\n`;
    markdown += `- **Invoice Number**: ${extraction.invoiceNumber || 'Unknown'}\n`;

    if (extraction.invoiceDate) {
      markdown += `- **Invoice Date**: ${extraction.invoiceDate.toISOString().split('T')[0]}\n`;
    }

    if (extraction.dueDate) {
      markdown += `- **Due Date**: ${extraction.dueDate.toISOString().split('T')[0]}\n`;
    }

    if (extraction.totalAmount) {
      markdown += `- **Total Amount**: $${extraction.totalAmount}\n`;
    }

    if (extraction.taxAmount) {
      markdown += `- **Tax Amount**: $${extraction.taxAmount}\n`;
    }

    if (extraction.lineItems && extraction.lineItems.length > 0) {
      markdown += `\n## Line Items\n\n`;
      markdown += `| Description | Quantity | Unit Price | Amount |\n`;
      markdown += `| ----------- | -------- | ---------- | ------ |\n`;

      for (const item of extraction.lineItems) {
        markdown += `| ${item.description} | ${item.quantity} | $${item.unitPrice.toFixed(2)} | $${item.amount.toFixed(2)} |\n`;
      }
    }

    if (extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0) {
      markdown += `\n## Handwritten Notes\n\n`;

      for (const note of extraction.handwrittenNotes) {
        markdown += `- ${note.text} _(confidence: ${note.confidence}%)_\n`;
      }
    }

    // Update extraction with generated markdown
    await storage.updateExtraction(id, { markdownOutput: markdown });

    res.send(markdown);
  } catch (error) {
    console.error("Error exporting markdown:", error);
    res.status(500).json({ message: "Failed to export markdown" });
  }
});

// Export extraction data as JSON
router.get("/:id/export/json", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const extraction = await storage.getExtraction(id);

    if (!extraction) {
      return res.status(404).json({ message: "Extraction not found" });
    }

    // If we already have a JSON output stored, use that
    if (extraction.jsonOutput) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="extraction-${id}.json"`);
      return res.send(extraction.jsonOutput);
    }

    // Otherwise, generate a JSON output
    const document = await storage.getDocument(extraction.documentId);
    if (!document) {
      return res.status(404).json({ message: "Associated document not found" });
    }

    const jsonOutput = JSON.stringify({
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
        processedDate: document.uploadDate
      }
    }, null, 2);

    // Update extraction with generated JSON
    await storage.updateExtraction(id, { jsonOutput });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="extraction-${id}.json"`);
    res.send(jsonOutput);
  } catch (error) {
    console.error("Error exporting JSON:", error);
    res.status(500).json({ message: "Failed to export JSON" });
  }
});

// Get layout data for a document
router.get("/document/:documentId/layout", async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.documentId);
    
    // Look up document in the database
    const document = await storage.getDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Get extraction for this document
    const extraction = await storage.getExtractionByDocumentId(documentId);
    if (!extraction) {
      return res.status(404).json({ error: 'Extraction not found for this document' });
    }
    
    // Return just the layout data
    return res.json({
      layoutData: extraction.layoutData || [],
    });
  } catch (error) {
    console.error(`Error retrieving layout data:`, error);
    return res.status(500).json({ error: 'Failed to retrieve layout data' });
  }
});

// Get confidence scores for a document
router.get("/document/:documentId/confidence", async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.documentId);
    
    // Look up document in the database
    const document = await storage.getDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Get extraction for this document
    const extraction = await storage.getExtractionByDocumentId(documentId);
    
    // If no extraction exists, return default confidence values
    if (!extraction || !extraction.confidenceScores) {
      return res.json({
        confidenceScores: {
          overall: 0,
          vendorInfo: 0,
          invoiceDetails: 0,
          lineItems: 0,
          totals: 0,
          handwrittenNotes: 0
        }
      });
    }
    
    // Return just the confidence scores
    return res.json({
      confidenceScores: extraction.confidenceScores
    });
  } catch (error) {
    console.error(`Error retrieving confidence scores:`, error);
    return res.status(500).json({ error: 'Failed to retrieve confidence scores' });
  }
});

// Get extraction history for a document
router.get('/document/:documentId/history', async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.documentId);
    
    // Look up document history
    const historyData = await (storage as any).getExtractionVersions(documentId);
    
    return res.json(historyData);
  } catch (error) {
    console.error(`Error retrieving extraction history:`, error);
    return res.status(500).json({ error: 'Failed to retrieve extraction history' });
  }
});

// Export extraction data in different formats
router.get('/document/:documentId/export', async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const format = (req.query.format as string) || 'json';
    
    // Look up document in the database
    const document = await storage.getDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Get extraction data
    const extraction = await storage.getExtractionByDocumentId(documentId);
    if (!extraction) {
      return res.status(404).json({ error: 'Extraction not found for this document' });
    }
    
    // Format output according to requested format
    switch (format.toLowerCase()) {
      case 'json':
        const jsonOutput = generateJSONOutput(extraction, document);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="invoice_${documentId}.json"`);
        return res.send(jsonOutput);
        
      case 'csv':
        try {
          // Generate CSV for invoice data
          const csvData = generateCSVOutput(extraction);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="invoice_${documentId}.csv"`);
          return res.send(csvData);
        } catch (csvError) {
          console.error('Error generating CSV:', csvError);
          return res.status(500).json({ error: 'Failed to generate CSV' });
        }
        
      case 'markdown':
      case 'md':
        // Generate Markdown representation
        const markdownOutput = generateMarkdownOutput(extraction);
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="invoice_${documentId}.md"`);
        return res.send(markdownOutput);
        
      default:
        return res.status(400).json({ error: 'Unsupported export format. Supported formats: json, csv, markdown' });
    }
  } catch (error) {
    console.error(`Error exporting extraction data:`, error);
    return res.status(500).json({ error: 'Failed to export extraction data' });
  }
});

export default router;