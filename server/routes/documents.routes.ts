import { Router, Request, Response } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "../storage.js";
import { insertDocumentSchema } from "@shared/schema.js";

// Setup upload directory
const uploadDir = path.join(process.cwd(), "uploads");

// Original multer configuration
const originalFileStorageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure the original 'uploads' directory exists if still needed by other parts
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Buffer.from(file.originalname, 'latin1').toString('utf8'));
  },
});

// Original upload middleware instance
const originalUpload = multer({
  storage: originalFileStorageConfig,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
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
      cb(new Error("Invalid file type (original filter). Only PDF, JPEG, PNG, TIFF, GIF, and WEBP are allowed."));
    }
  },
});

const router = Router();

// Get all documents
router.get("/", async (req: Request, res: Response) => {
  try {
    const documents = await storage.getDocuments();
    res.json(documents);
  } catch (error) {
    console.error("Error getting documents:", error);
    res.status(500).json({ message: "Failed to retrieve documents" });
  }
});

// Get a single document
router.get("/:id", async (req: Request, res: Response) => {
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
router.get("/:id/file", async (req: Request, res: Response) => {
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
router.get("/next/:currentId", async (req: Request, res: Response) => {
  try {
    const currentId = parseInt(req.params.currentId);

    // Get all documents
    const documents = await storage.getDocuments();

    // Find the next document that has a complete status
    const eligibleDocuments = documents.filter((doc: any) => 
      doc.id !== currentId && 
      doc.status === 'completed'
    );

    // Sort by upload date, newest first
    eligibleDocuments.sort((a: any, b: any) => 
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

// Delete a document
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    console.log(`[DELETE] Request received to delete document with ID: ${req.params.id}`);
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      console.error(`[DELETE] Invalid document ID: ${req.params.id}`);
      return res.status(400).json({ message: "Invalid document ID" });
    }
    
    console.log(`[DELETE] Fetching document with ID: ${id}`);
    const document = await storage.getDocument(id);

    if (!document) {
      console.log(`[DELETE] Document with ID ${id} not found`);
      return res.status(404).json({ message: "Document not found" });
    }

    console.log(`[DELETE] Found document: ${document.originalFilename}, checking file existence`);
    
    // Delete the file from storage
    if (fs.existsSync(document.storagePath)) {
      console.log(`[DELETE] Deleting file: ${document.storagePath}`);
      fs.unlinkSync(document.storagePath);
    } else {
      console.log(`[DELETE] File not found at ${document.storagePath}, skipping file deletion`);
    }

    // Delete from storage
    console.log(`[DELETE] Deleting document from database: ${id}`);
    const result = await storage.deleteDocument(id);
    console.log(`[DELETE] Document deletion result: ${result}`);

    console.log(`[DELETE] Successfully deleted document ${id}, sending 204 response`);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ message: "Failed to delete document" });
  }
});

// The legacy document upload endpoint (commented out in the original file)
// Uncomment this if you still need the original upload endpoint
/* 
router.post("/", originalUpload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    const ocrServiceName = (req.body.ocrService as string) || 'llamaparse';

    const documentData = {
      originalFilename: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      status: "uploaded",
      storagePath: req.file.path,
      ocrService: ocrServiceName,
    };

    const validatedData = insertDocumentSchema.parse(documentData);
    const document = await storage.createDocument(validatedData);

    res.status(201).json(document);
  } catch (error) {
    console.error("Error uploading document (original endpoint):", error);

    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.message });
    }

    res.status(500).json({ message: "Failed to upload document (original endpoint)" });
  }
});
*/

export default router; 