import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertDocumentSchema, insertExtractionSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
// Import the OCR service
// import * as ocrService from "./services/ocrService";

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
    cb(null, uniqueSuffix + ext);
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
      "image/tiff"
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, JPEG, PNG, and TIFF are allowed."));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

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

  // Upload a new document
  app.post("/api/documents", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const documentData = {
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        status: "uploaded",
        storagePath: req.file.path,
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
          // TODO: Implement actual OCR processing here using the ocrService
          // When implemented, uncomment and use code like:
          /*
          // Process the document with OCR
          const ocrResult = await ocrService.processDocument(document.storagePath);
          
          // Update document to completed state
          await storage.updateDocument(id, {
            status: "completed",
          });
          
          // Create extraction with actual OCR data
          await storage.createExtraction({
            documentId: id,
            vendorName: ocrResult.vendorName,
            invoiceNumber: ocrResult.invoiceNumber,
            invoiceDate: ocrResult.invoiceDate,
            dueDate: ocrResult.dueDate,
            totalAmount: ocrResult.totalAmount,
            taxAmount: ocrResult.taxAmount,
            lineItems: ocrResult.lineItems,
            handwrittenNotes: ocrResult.handwrittenNotes,
          });
          */
          
          // For now, we'll just update the status to indicate processing is required
          await storage.updateDocument(id, {
            status: "needs_implementation",
            errorMessage: "OCR processing service needs to be implemented"
          });
        } catch (error) {
          console.error("Error in OCR processing:", error);
          await storage.updateDocument(id, {
            status: "error",
            errorMessage: "OCR processing failed: " + (error instanceof Error ? error.message : "Unknown error")
          });
        }
      }, 1000);
      
      res.json(updatedDocument);
    } catch (error) {
      console.error("Error processing document:", error);
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
  app.put("/api/extractions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get extraction to update
      const extraction = await storage.getExtraction(id);
      if (!extraction) {
        return res.status(404).json({ message: "Extraction not found" });
      }
      
      // Validate update data
      const updateData = insertExtractionSchema.partial().parse(req.body);
      
      // Update extraction
      const updatedExtraction = await storage.updateExtraction(id, updateData);
      
      res.json(updatedExtraction);
    } catch (error) {
      console.error("Error updating extraction:", error);
      
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      res.status(500).json({ message: "Failed to update extraction data" });
    }
  });

  // Export as Markdown
  app.get("/api/extractions/:id/export/markdown", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get extraction data
      const extraction = await storage.getExtraction(id);
      if (!extraction) {
        return res.status(404).json({ message: "Extraction not found" });
      }
      
      // Format as Markdown
      let markdown = `# Document Extraction\n\n`;
      
      if (extraction.vendorName) {
        markdown += `## Vendor\n${extraction.vendorName}\n\n`;
      }
      
      if (extraction.invoiceNumber) {
        markdown += `## Invoice Number\n${extraction.invoiceNumber}\n\n`;
      }
      
      if (extraction.invoiceDate) {
        markdown += `## Invoice Date\n${new Date(extraction.invoiceDate).toLocaleDateString()}\n\n`;
      }
      
      if (extraction.dueDate) {
        markdown += `## Due Date\n${new Date(extraction.dueDate).toLocaleDateString()}\n\n`;
      }
      
      if (extraction.totalAmount) {
        markdown += `## Total Amount\n${extraction.totalAmount}\n\n`;
      }
      
      if (extraction.taxAmount) {
        markdown += `## Tax Amount\n${extraction.taxAmount}\n\n`;
      }
      
      if (extraction.lineItems && extraction.lineItems.length > 0) {
        markdown += `## Line Items\n\n`;
        markdown += `| Description | Quantity | Unit Price | Amount |\n`;
        markdown += `| ----------- | -------- | ---------- | ------ |\n`;
        
        extraction.lineItems.forEach(item => {
          markdown += `| ${item.description} | ${item.quantity} | ${item.unitPrice} | ${item.amount} |\n`;
        });
        
        markdown += `\n`;
      }
      
      if (extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0) {
        markdown += `## Handwritten Notes\n\n`;
        
        extraction.handwrittenNotes.forEach(note => {
          markdown += `- ${note.text} (confidence: ${note.confidence}%)\n`;
        });
      }
      
      // Update the extraction with the markdown output
      await storage.updateExtraction(id, { markdownOutput: markdown });
      
      // Send response
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="extraction-${id}.md"`);
      res.send(markdown);
    } catch (error) {
      console.error("Error exporting as Markdown:", error);
      res.status(500).json({ message: "Failed to export as Markdown" });
    }
  });

  // Export as JSON
  app.get("/api/extractions/:id/export/json", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get extraction data
      const extraction = await storage.getExtraction(id);
      if (!extraction) {
        return res.status(404).json({ message: "Extraction not found" });
      }
      
      // Format for export - remove internal id fields
      const exportData = {
        vendorName: extraction.vendorName,
        invoiceNumber: extraction.invoiceNumber,
        invoiceDate: extraction.invoiceDate,
        dueDate: extraction.dueDate,
        totalAmount: extraction.totalAmount,
        taxAmount: extraction.taxAmount,
        lineItems: extraction.lineItems,
        handwrittenNotes: extraction.handwrittenNotes
      };
      
      const jsonOutput = JSON.stringify(exportData, null, 2);
      
      // Update the extraction with the json output
      await storage.updateExtraction(id, { jsonOutput });
      
      // Send response
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="extraction-${id}.json"`);
      res.send(jsonOutput);
    } catch (error) {
      console.error("Error exporting as JSON:", error);
      res.status(500).json({ message: "Failed to export as JSON" });
    }
  });

  return httpServer;
}
