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
  ocrService: text("ocr_service", { enum: ["mistral", "openai", "llamaparse"] }).default("mistral"),
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
  invoiceNumber: text("invoice_number"),
  invoiceDate: timestamp("invoice_date"),
  dueDate: timestamp("due_date"),
  totalAmount: text("total_amount"),
  taxAmount: text("tax_amount"),
  lineItems: json("line_items").$type<LineItem[]>(),
  handwrittenNotes: json("handwritten_notes").$type<HandwrittenNote[]>(),
  markdownOutput: text("markdown_output"),
  jsonOutput: text("json_output"),
});

export const insertExtractionSchema = createInsertSchema(extractions).omit({ 
  id: true 
});

// Custom types
export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type HandwrittenNote = {
  text: string;
  confidence: number;
};

// Export types
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Extraction = typeof extractions.$inferSelect;
export type InsertExtraction = z.infer<typeof insertExtractionSchema>;
