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
import * as ocrService from "./services/ocrService";

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

      const documentData = {
        originalFilename: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
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
          // Process the document with OCR
          const ocrResult = await ocrService.processDocument(document.storagePath);

          // Generate markdown and JSON outputs
          const markdownOutput = ocrService.generateMarkdownOutput(ocrResult);
          const jsonOutput = ocrService.generateJSONOutput(ocrResult);

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
            markdownOutput,
            jsonOutput
          });

          // Update document to completed state
          await storage.updateDocument(id, {
            status: "completed",
          });

          console.log(`Document ${id} processed successfully`);
        } catch (error: any) {
          console.error(`Error processing document ${id}:`, error);

          // Update document to error state
          await storage.updateDocument(id, {
            status: "error",
            errorMessage: error.message || "Unknown error during processing"
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

      // Get document to verify it exists
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Find extraction for this document
      const extraction = await storage.getExtractionByDocumentId(documentId);

      if (!extraction) {
        return res.status(404).json({ message: "Extraction not found for this document" });
      }

      res.json(extraction);
    } catch (error) {
      console.error("Error getting extraction:", error);
      res.status(500).json({ message: "Failed to retrieve extraction data" });
    }
  });

  return httpServer;
}