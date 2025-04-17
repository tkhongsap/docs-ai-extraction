import { pgTable, text, serial, integer, timestamp, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Document schema
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  originalFilename: text("original_filename").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(),
  uploadDate: timestamp("upload_date").defaultNow().notNull(),
  status: text("status", { enum: ["uploaded", "processing", "completed", "error"] }).notNull(),
  storagePath: text("storage_path").notNull(),
  errorMessage: text("error_message"),
  ocrService: text("ocr_service", { enum: ["mistral", "openai", "ms-document-intelligence", "llamaparse"] }).default("openai"),
  processingMetadata: json("processing_metadata"),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ 
  id: true, 
  uploadDate: true 
});

// Extraction schema
export const extractions = pgTable("extractions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  vendorName: text("vendor_name"),
  vendorAddress: text("vendor_address"),
  vendorContact: text("vendor_contact"),
  clientName: text("client_name"),
  clientAddress: text("client_address"),
  invoiceNumber: text("invoice_number"),
  invoiceDate: timestamp("invoice_date"),
  dueDate: timestamp("due_date"),
  totalAmount: text("total_amount"),
  subtotalAmount: text("subtotal_amount"),
  taxAmount: text("tax_amount"),
  discountAmount: text("discount_amount"),
  currency: text("currency"),
  paymentTerms: text("payment_terms"),
  paymentMethod: text("payment_method"),
  lineItems: json("line_items").$type<LineItem[]>(),
  handwrittenNotes: json("handwritten_notes").$type<HandwrittenNote[]>(),
  confidenceScores: json("confidence_scores").$type<FieldConfidence>(),
  layoutData: json("layout_data").$type<LayoutPosition[]>(),
  processingMetadata: json("processing_metadata").$type<ProcessingMetadata>(),
  markdownOutput: text("markdown_output"),
  jsonOutput: text("json_output"),
  version: integer("version").default(1),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertExtractionSchema = createInsertSchema(extractions).omit({ 
  id: true,
  version: true,
  lastUpdated: true
});

// Custom types
export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  itemCode?: string;
  category?: string;
  taxRate?: number;
  discount?: number;
  confidence?: number;
};

export type HandwrittenNote = {
  text: string;
  confidence: number;
  position?: LayoutPosition;
};

// New types for enhanced LlamaParse integration
export type FieldConfidence = {
  overall: number;
  vendorInfo: number;
  invoiceDetails: number;
  lineItems: number;
  totals: number;
  handwrittenNotes: number;
  fieldSpecific: Record<string, number>;
};

export type LayoutPosition = {
  pageNumber: number;
  boundingBox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  fieldType: string;
  fieldName: string;
};

export type ProcessingMetadata = {
  ocrEngine: string;
  processingTime: number;
  processingTimestamp: string;
  processingParams?: Record<string, any>;
  documentClassification?: string;
};

// Export types
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Extraction = typeof extractions.$inferSelect;
export type InsertExtraction = z.infer<typeof insertExtractionSchema>;

// Type for extraction history
export type ExtractionVersion = {
  id: number;
  extractionId: number;
  version: number;
  extraction: Partial<Extraction>;
  changedFields: string[];
  timestamp: Date;
  userId?: number;
};
