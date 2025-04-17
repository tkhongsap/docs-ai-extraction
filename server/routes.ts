import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertDocumentSchema, insertExtractionSchema, LineItem, HandwrittenNote } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
// Import the OCR service
import ocrService from "./services/ocrService";
import { DatabaseStorage } from './storage';
import llamaparseWrapperService from './services/llamaparseWrapperService';

// Setup upload directory
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename with original name
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, Buffer.from(file.originalname, 'latin1').toString('utf8'));
  },
});

const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only specific file types
    const allowedTypes = [
      "application/pdf", 
      "image/jpeg", 
      "image/png", 
      "image/tiff", 
      "image/gif",
      "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, JPEG, PNG, TIFF, GIF, and WEBP are allowed."));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Add a simple health check endpoint to help Replit detect the server
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running', time: new Date().toISOString() });
  });

  // Get all documents
  app.get("/api/documents", async (req: Request, res: Response) => {
    try {
      const documents = await storage.getDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error getting documents:", error);
      res.status(500).json({ message: "Failed to retrieve documents" });
    }
  });

  // Get a single document
  app.get("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      console.error("Error getting document:", error);
      res.status(500).json({ message: "Failed to retrieve document" });
    }
  });

  // Get document file
  app.get("/api/documents/:id/file", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if file exists
      if (!fs.existsSync(document.storagePath)) {
        return res.status(404).json({ message: "Document file not found" });
      }

      // Send file
      res.sendFile(document.storagePath);
    } catch (error) {
      console.error("Error getting document file:", error);
      res.status(500).json({ message: "Failed to retrieve document file" });
    }
  });

  // Get next document for review
  app.get("/api/documents/next/:currentId", async (req: Request, res: Response) => {
    try {
      const currentId = parseInt(req.params.currentId);

      // Get all documents
      const documents = await storage.getDocuments();

      // Find the next document that has a complete status
      const eligibleDocuments = documents.filter(doc => 
        doc.id !== currentId && 
        doc.status === 'completed'
      );

      // Sort by upload date, newest first
      eligibleDocuments.sort((a, b) => 
        new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
      );

      const nextDocument = eligibleDocuments[0];

      if (!nextDocument) {
        return res.status(404).json({ message: "No more documents to review" });
      }

      res.json(nextDocument);
    } catch (error) {
      console.error("Error getting next document:", error);
      res.status(500).json({ message: "Failed to get next document" });
    }
  });

  // Upload a new document
  app.post("/api/documents", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Get OCR service from form data, default to 'llamaparse'
      const ocrServiceName = (req.body.ocrService as string) || 'llamaparse';

      const documentData = {
        originalFilename: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        status: "uploaded",
        storagePath: req.file.path,
        ocrService: ocrServiceName,
      };

      // Validate document data
      const validatedData = insertDocumentSchema.parse(documentData);

      // Create the document
      const document = await storage.createDocument(validatedData);

      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading document:", error);

      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }

      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Start processing a document
  app.post("/api/documents/:id/process", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Update document status to processing
      const updatedDocument = await storage.updateDocument(id, {
        status: "processing",
      });

      // In a production app, this should trigger an async job through a queue
      // For now, we'll process directly in a timeout to not block the response
      setTimeout(async () => {
        try {
          // Check file extension to determine processing method
          const fileExtension = path.extname(document.storagePath).substring(1).toLowerCase();
          
          // Check if file type is supported
          const supportedImageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'bmp'];
          const supportedDocFormats = ['pdf', 'doc', 'docx'];
          
          if (!supportedImageFormats.includes(fileExtension) && !supportedDocFormats.includes(fileExtension)) {
            throw new Error(`Unsupported file format: ${fileExtension}. Only images and PDF documents are supported.`);
          }
          
          // Add a MIME type check for PDF files to ensure they are valid
          if (fileExtension === 'pdf') {
            try {
              // Read first few bytes of the file to check for PDF signature
              const fileBuffer = Buffer.alloc(5);
              const fd = fs.openSync(document.storagePath, 'r');
              fs.readSync(fd, fileBuffer, 0, 5, 0);
              fs.closeSync(fd);
              
              // Check for PDF signature (%PDF-)
              const isPDF = fileBuffer.toString('ascii').startsWith('%PDF-');
              if (!isPDF) {
                throw new Error('Invalid PDF file: File does not have a valid PDF signature. It may be corrupted or not a true PDF.');
              }
            } catch (err: any) {
              throw new Error(`Error validating PDF file: ${err.message}`);
            }
          }
          
          // For all files, use LlamaParse only
          console.log(`Processing ${fileExtension} file with LlamaParse service...`);
          const ocrResult = await ocrService.processDocument(document.storagePath, 'llamaparse');

          // Create extraction record
          const extraction = await storage.createExtraction({
            documentId: id,
            vendorName: ocrResult.vendorName,
            invoiceNumber: ocrResult.invoiceNumber,
            invoiceDate: ocrResult.invoiceDate ? new Date(ocrResult.invoiceDate) : undefined,
            dueDate: ocrResult.dueDate ? new Date(ocrResult.dueDate) : undefined,
            totalAmount: ocrResult.totalAmount?.toString(),
            taxAmount: ocrResult.taxAmount?.toString(),
            lineItems: JSON.parse(JSON.stringify(ocrResult.lineItems)),
            handwrittenNotes: JSON.parse(JSON.stringify(ocrResult.handwrittenNotes)),
            markdownOutput: ocrResult.markdownOutput,
            jsonOutput: ocrResult.jsonOutput
          });

          // Update document to completed state with processing metadata
          await storage.updateDocument(id, {
            status: "completed",
            processingMetadata: ocrResult.processingMetadata
          });

          console.log(`Document ${id} processed successfully`);
        } catch (error: any) {
          console.error(`Error processing document ${id}:`, error);
          
          // Create a more user-friendly error message
          let errorMessage = "Unknown error during processing";
          
          if (error.message) {
            if (error.message.includes("timeout")) {
              errorMessage = "The document processing timed out. This may happen with large or complex files. Try a smaller document or try again later.";
            } else if (error.message.includes("exceeded")) {
              errorMessage = "The document exceeds the maximum size limit. Please try a smaller document or reduce the file size.";
            } else if (error.message.includes("API key")) {
              errorMessage = "API authentication error. Please contact support to verify your account.";
            } else if (error.message.includes("Network")) {
              errorMessage = "Network connection error. Please check your internet connection and try again.";
            } else if (error.message.includes("hang up") || error.message.includes("socket") || error.message.includes("Connection closed")) {
              errorMessage = "The connection to the OCR service was lost. The service may be experiencing high load. Please try again later.";
            } else {
              // Use the original error message if none of the specific cases match
              errorMessage = error.message;
            }
          }

          // Update document to error state with processing metadata
          await storage.updateDocument(id, {
            status: "error",
            errorMessage: errorMessage,
            processingMetadata: {
              ocrEngine: document.ocrService || 'llamaparse',
              processingTime: 0,
              processingTimestamp: new Date().toISOString(),
              processingParams: {
                error: errorMessage,
                attemptedFallback: error.message?.includes('fallback') || false
              },
              documentClassification: 'Error'
            }
          });
        }
      }, 100); // Small delay to not block response

      res.json(updatedDocument);
    } catch (error) {
      console.error("Error starting document processing:", error);
      res.status(500).json({ message: "Failed to process document" });
    }
  });

  // Delete a document
  app.delete("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete the file from storage
      if (fs.existsSync(document.storagePath)) {
        fs.unlinkSync(document.storagePath);
      }

      // Delete from storage
      await storage.deleteDocument(id);

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Get extraction data for document
  app.get("/api/extractions/document/:documentId", async (req: Request, res: Response) => {
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
  app.patch("/api/extractions/:id", async (req: Request, res: Response) => {
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
  app.get("/api/extractions/:id/export/markdown", async (req: Request, res: Response) => {
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
  app.get("/api/extractions/:id/export/json", async (req: Request, res: Response) => {
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

  // Get extraction data for a document
  app.get("/api/documents/:id/extraction", async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      
      // Look up document in the database
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      // Check if there's an extraction available
      const extraction = await storage.getExtractionByDocumentId(documentId);
      if (!extraction) {
        return res.status(404).json({ error: 'No extraction data available for this document' });
      }
      
      // Return the extraction data
      return res.json(extraction);
    } catch (error) {
      console.error(`Error retrieving extraction data:`, error);
      return res.status(500).json({ error: 'Failed to retrieve extraction data' });
    }
  });

  // Get layout data for a document
  app.get("/api/documents/:id/layout", async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      
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
  app.get("/api/documents/:id/confidence", async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      
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

  // Selectively reprocess a section of a document
  app.post("/api/documents/:id/reprocess/:section", async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const section = req.params.section;
      
      // Validate section parameter
      const validSections = ['invoice_details', 'line_items', 'vendor_info', 'handwritten_notes'];
      if (!validSections.includes(section)) {
        return res.status(400).json({ error: 'Invalid section. Valid values are: invoice_details, line_items, vendor_info, handwritten_notes' });
      }
      
      // Look up document in the database
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      // Update document status to indicate processing
      await storage.updateDocument(documentId, {
        status: 'processing'
      });
      
      // Return immediately to avoid timeout
      res.json({ message: `Reprocessing ${section} for document ${documentId}` });
      
      // Asynchronously handle the reprocessing
      setTimeout(async () => {
        try {
          // Get the file path 
          const filePath = document.storagePath;
          
          // Find existing extraction
          const existingExtractions = await storage.getExtractionByDocumentId(documentId);
          
          // Process document
          const result = await llamaparseService.processDocument(filePath);
          
          // Update database with new extraction data
          if (existingExtractions) {
            let updateData: any = {};
            
            switch (section) {
              case 'invoice_details':
                updateData = {
                  invoiceNumber: result.invoiceNumber,
                  invoiceDate: result.invoiceDate,
                  dueDate: result.dueDate,
                  totalAmount: result.totalAmount,
                  subtotalAmount: result.subtotalAmount,
                  taxAmount: result.taxAmount,
                  confidenceScores: {
                    ...existingExtractions.confidenceScores,
                    invoiceDetails: result.confidenceScores.invoiceDetails,
                    overall: recalculateOverallConfidence(existingExtractions.confidenceScores, 'invoiceDetails', result.confidenceScores.invoiceDetails)
                  }
                };
                break;
                
              case 'vendor_info':
                updateData = {
                  vendorName: result.vendorName,
                  vendorAddress: result.vendorAddress,
                  vendorContact: result.vendorContact,
                  confidenceScores: {
                    ...existingExtractions.confidenceScores,
                    vendorInfo: result.confidenceScores.vendorInfo,
                    overall: recalculateOverallConfidence(existingExtractions.confidenceScores, 'vendorInfo', result.confidenceScores.vendorInfo)
                  }
                };
                break;
                
              case 'line_items':
                updateData = {
                  lineItems: result.lineItems,
                  confidenceScores: {
                    ...existingExtractions.confidenceScores,
                    lineItems: result.confidenceScores.lineItems,
                    overall: recalculateOverallConfidence(existingExtractions.confidenceScores, 'lineItems', result.confidenceScores.lineItems)
                  }
                };
                break;
                
              case 'handwritten_notes':
                // For handwritten notes, we'll use the processing from LlamaParse
                // but focus on the document as a whole since it doesn't have special
                // handwritten note extraction
                const ocrResult = await llamaparseService.processDocument(filePath);
                
                // ให้ใช้ข้อมูลที่มีอยู่หรือสร้างเป็นอาร์เรย์ว่าง
                const handwrittenNotesData = ocrResult.handwrittenNotes || [];
                const handwrittenConfidence = 
                  ocrResult.confidenceScores && typeof ocrResult.confidenceScores.handwrittenNotes === 'number' 
                    ? ocrResult.confidenceScores.handwrittenNotes 
                    : 0;
                
                updateData = {
                  handwrittenNotes: handwrittenNotesData,
                  confidenceScores: {
                    ...existingExtractions.confidenceScores,
                    handwrittenNotes: handwrittenConfidence,
                    overall: recalculateOverallConfidence(
                      existingExtractions.confidenceScores, 
                      'handwrittenNotes', 
                      handwrittenConfidence
                    )
                  }
                };
                break;
            }
            
            await storage.updateExtraction(existingExtractions.id, updateData);
          }
          
          // Update document status to completed
          await storage.updateDocument(documentId, {
            status: 'completed'
          });
          
        } catch (error) {
          console.error(`Error during reprocessing of ${section}:`, error);
          
          // Update document status to error
          await storage.updateDocument(documentId, {
            status: 'error'
          });
        }
      }, 100);
    } catch (error) {
      console.error(`Error initiating reprocessing:`, error);
      return res.status(500).json({ error: 'Failed to initiate reprocessing' });
    }
  });

  // Get extraction history for a document
  app.get('/api/documents/:id/history', async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      
      // Look up document history
      const historyData = await storage.getExtractionVersions(documentId);
      
      return res.json(historyData);
    } catch (error) {
      console.error(`Error retrieving extraction history:`, error);
      return res.status(500).json({ error: 'Failed to retrieve extraction history' });
    }
  });

  // Helper function to recalculate overall confidence based on section updates
  function recalculateOverallConfidence(confidenceScores: any, updatedSection: string, newValue: number): number {
    // Define weights for different sections
    const weights = {
      vendorInfo: 0.2,
      invoiceDetails: 0.3,
      lineItems: 0.3,
      totals: 0.15,
      handwrittenNotes: 0.05
    };
    
    // Create a copy of confidence scores and update the section
    const updatedScores = { ...confidenceScores };
    updatedScores[updatedSection] = newValue;
    
    // Calculate weighted average
    let overall = 0;
    let totalWeight = 0;
    
    for (const [section, weight] of Object.entries(weights)) {
      if (updatedScores[section] !== undefined) {
        overall += updatedScores[section] * (weight as number);
        totalWeight += weight as number;
      }
    }
    
    // Normalize if needed
    if (totalWeight > 0) {
      overall = Math.round(overall / totalWeight);
    }
    
    return overall;
  }

  // Helper function to extract handwritten notes from an image
  async function extractHandwrittenNotes(filePath: string): Promise<any> {
    try {
      // Use OCR service to process the document
      const result = await ocrService.processDocument(filePath);
      
      // Extract handwritten notes and confidence scores
      return {
        handwrittenNotes: result.handwrittenNotes || [],
        confidenceScores: {
          handwrittenNotes: result.confidenceScores.handwrittenNotes || 0
        }
      };
    } catch (error) {
      console.error("Error extracting handwritten notes:", error);
      return {
        handwrittenNotes: [],
        confidenceScores: {
          handwrittenNotes: 0
        }
      };
    }
  }

  // Temporary interface for extraction version history
  interface ExtractionVersion {
    id: number;
    extractionId: number;
    version: number;
    extraction: any;
    changedFields: string[];
    timestamp: Date;
  }

  // Implementation for extraction version history
  (storage as any).getExtractionVersions = async function(documentId: number): Promise<any[]> {
    try {
      // In this implementation, we'll just return a simple history
      // In a real implementation, this would fetch from a history/audit table
      const extraction = await this.getExtractionByDocumentId(documentId);
      
      if (!extraction) {
        return [];
      }
      
      // Return a single version entry (current version only)
      return [{
        id: 1,
        extractionId: extraction.id,
        version: extraction.version || 1,
        extraction: {
          vendorName: extraction.vendorName,
          invoiceNumber: extraction.invoiceNumber,
          totalAmount: extraction.totalAmount,
        },
        changedFields: [],
        timestamp: extraction.lastUpdated || new Date(),
      }];
    } catch (error) {
      console.error("Error getting extraction versions:", error);
      return [];
    }
  };

  // Export extraction data in different formats
  app.get("/api/documents/:id/export", async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
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
          return res.json(extraction);
          
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

  // Helper function to generate CSV output from extraction data
  function generateCSVOutput(extraction: any): string {
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

  // Helper function to generate Markdown output from extraction data
  function generateMarkdownOutput(extraction: any): string {
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

  return httpServer;
}