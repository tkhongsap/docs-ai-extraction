/**
 * Processing Routes
 * 
 * This module handles all routes related to document processing,
 * including starting OCR processing on documents and selectively
 * reprocessing parts of documents.
 */
import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { storage } from "../storage.js";
import ocrService from "../services/ocrService.js";

const router = Router();

// Flag to determine if OCR services are disabled for testing
const OCR_SERVICES_DISABLED = process.env.DISABLE_OCR_SERVICES === 'true' || true; // Default to disabled for testing

// Start processing a document
router.post("/:id/process", async (req: Request, res: Response) => {
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

    if (OCR_SERVICES_DISABLED) {
      console.log(`OCR services disabled for testing. Setting document ${id} to completed with mock data.`);
      
      // In testing mode, immediately set document to completed with mock data
      setTimeout(async () => {
        try {
          // Create mock extraction record
          const mockExtraction = await storage.createExtraction({
            documentId: id,
            vendorName: "Test Vendor",
            invoiceNumber: "TEST-123",
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days later
            totalAmount: "100.00",
            taxAmount: "10.00",
            lineItems: [{ 
              description: "Test Item", 
              quantity: 1, 
              unitPrice: 90, 
              amount: 90 
            }],
            handwrittenNotes: [{ 
              text: "Test note", 
              confidence: 95, 
              boundingBox: { x: 0, y: 0, width: 100, height: 20 } 
            }],
            markdownOutput: "# Test Document\n\nThis is a mock document for testing.",
            jsonOutput: JSON.stringify({ test: "This is mock data for testing" })
          });

          // Update document to completed state with mock processing metadata
          await storage.updateDocument(id, {
            status: "completed",
            processingMetadata: {
              ocrEngine: "mock-for-testing",
              processingTime: 100, 
              processingTimestamp: new Date().toISOString(),
              processingParams: { mockMode: true },
              documentClassification: "Invoice"
            }
          });

          console.log(`Document ${id} set to completed with mock data for testing`);
        } catch (error) {
          console.error(`Error setting up mock processing data for document ${id}:`, error);
          await storage.updateDocument(id, { status: "error", errorMessage: "Error in mock processing mode" });
        }
      }, 100);
      
      return res.json({
        ...updatedDocument,
        _testingNote: "OCR services disabled for testing - mock data will be created"
      });
    }

    // Normal processing path (OCR services enabled)
    // In a production app, this should trigger an async job through a queue
    // For now, we'll process directly in a timeout to not block the response
    setTimeout(async () => {
      try {
        // Check file extension to determine if file type is supported
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
        
        // Get OCR service from document metadata (if not available, use default)
        const selectedOcrService = document.ocrService || 'openai';
        console.log(`Processing ${fileExtension} file with ${selectedOcrService} service...`);
        
        // Process document with the selected OCR service
        const ocrResult = await ocrService.processDocument(document.storagePath, selectedOcrService);

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

        console.log(`Document ${id} processed successfully with ${selectedOcrService} service`);
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
          } else if (error.message.includes("Is the Python API running")) {
            errorMessage = "The OCR service is not responding. Please try again in a few minutes.";
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
    }, 100);

    res.json(updatedDocument);
  } catch (error) {
    console.error("Error starting document processing:", error);
    res.status(500).json({ message: "Failed to process document" });
  }
});

// Selectively reprocess a section of a document
router.post("/:id/reprocess/:section", async (req: Request, res: Response) => {
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
        const result = await ocrService.processDocument(filePath, document.ocrService || 'openai');
        
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
              const ocrResult = await ocrService.processDocument(filePath, document.ocrService || 'openai');
              
              // Use existing data or create an empty array
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

export default router; 