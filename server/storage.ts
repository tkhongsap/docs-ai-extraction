import { documents, extractions, type Document, type InsertDocument, type Extraction, type InsertExtraction } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Document operations
  getDocuments(): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: number, data: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Extraction operations
  getExtraction(id: number): Promise<Extraction | undefined>;
  getExtractionByDocumentId(documentId: number): Promise<Extraction | undefined>;
  createExtraction(extraction: InsertExtraction): Promise<Extraction>;
  updateExtraction(id: number, data: Partial<Extraction>): Promise<Extraction | undefined>;
}

export class MemStorage implements IStorage {
  private documents: Map<number, Document>;
  private extractions: Map<number, Extraction>;
  private docCurrentId: number;
  private extractionCurrentId: number;

  constructor() {
    this.documents = new Map();
    this.extractions = new Map();
    this.docCurrentId = 1;
    this.extractionCurrentId = 1;
  }

  // Document operations
  async getDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values()).sort((a, b) => {
      // Sort by upload date descending
      return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    });
  }

  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const id = this.docCurrentId++;
    const uploadDate = new Date();
    
    const document: Document = { 
      ...doc, 
      id, 
      uploadDate, 
      errorMessage: doc.errorMessage || null
    };
    
    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id: number, data: Partial<Document>): Promise<Document | undefined> {
    const doc = this.documents.get(id);
    if (!doc) return undefined;

    const updatedDoc = { ...doc, ...data };
    this.documents.set(id, updatedDoc);
    return updatedDoc;
  }

  async deleteDocument(id: number): Promise<boolean> {
    const deleted = this.documents.delete(id);
    // Also delete related extraction if any
    const extractionToDelete = Array.from(this.extractions.values()).find(
      (ext) => ext.documentId === id
    );
    
    if (extractionToDelete) {
      this.extractions.delete(extractionToDelete.id);
    }
    
    return deleted;
  }

  // Extraction operations
  async getExtraction(id: number): Promise<Extraction | undefined> {
    return this.extractions.get(id);
  }

  async getExtractionByDocumentId(documentId: number): Promise<Extraction | undefined> {
    return Array.from(this.extractions.values()).find(
      (extraction) => extraction.documentId === documentId
    );
  }

  async createExtraction(extraction: InsertExtraction): Promise<Extraction> {
    const id = this.extractionCurrentId++;
    const newExtraction: Extraction = { 
      ...extraction, 
      id,
      vendorName: extraction.vendorName || null,
      invoiceNumber: extraction.invoiceNumber || null,
      invoiceDate: extraction.invoiceDate || null,
      dueDate: extraction.dueDate || null,
      totalAmount: extraction.totalAmount || null,
      taxAmount: extraction.taxAmount || null,
      lineItems: extraction.lineItems || null,
      handwrittenNotes: extraction.handwrittenNotes || null,
      markdownOutput: extraction.markdownOutput || null,
      jsonOutput: extraction.jsonOutput || null
    };
    this.extractions.set(id, newExtraction);
    return newExtraction;
  }

  async updateExtraction(id: number, data: Partial<Extraction>): Promise<Extraction | undefined> {
    const extraction = this.extractions.get(id);
    if (!extraction) return undefined;

    const updatedExtraction = { ...extraction, ...data };
    this.extractions.set(id, updatedExtraction);
    return updatedExtraction;
  }
}

export class DatabaseStorage implements IStorage {
  // Document operations
  async getDocuments(): Promise<Document[]> {
    return db.select().from(documents).orderBy(desc(documents.uploadDate));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    // Ensure we have default values for optional fields
    const docWithDefaults = {
      ...doc,
      errorMessage: doc.errorMessage || null
    };
    
    const [document] = await db.insert(documents).values(docWithDefaults).returning();
    return document;
  }

  async updateDocument(id: number, data: Partial<Document>): Promise<Document | undefined> {
    const [document] = await db
      .update(documents)
      .set(data)
      .where(eq(documents.id, id))
      .returning();
    return document;
  }

  async deleteDocument(id: number): Promise<boolean> {
    // First, delete any related extractions
    await db
      .delete(extractions)
      .where(eq(extractions.documentId, id));
    
    // Then delete the document
    const result = await db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning({ id: documents.id });
    
    return result.length > 0;
  }

  // Extraction operations
  async getExtraction(id: number): Promise<Extraction | undefined> {
    const [extraction] = await db.select().from(extractions).where(eq(extractions.id, id));
    return extraction;
  }

  async getExtractionByDocumentId(documentId: number): Promise<Extraction | undefined> {
    const [extraction] = await db
      .select()
      .from(extractions)
      .where(eq(extractions.documentId, documentId));
    return extraction;
  }

  async createExtraction(extraction: InsertExtraction): Promise<Extraction> {
    // Ensure we have default values for optional fields
    const extractionWithDefaults = {
      ...extraction,
      vendorName: extraction.vendorName || null,
      invoiceNumber: extraction.invoiceNumber || null,
      invoiceDate: extraction.invoiceDate || null,
      dueDate: extraction.dueDate || null,
      totalAmount: extraction.totalAmount || null,
      taxAmount: extraction.taxAmount || null,
      lineItems: extraction.lineItems || null,
      handwrittenNotes: extraction.handwrittenNotes || null,
      markdownOutput: extraction.markdownOutput || null,
      jsonOutput: extraction.jsonOutput || null
    };
    
    const [newExtraction] = await db
      .insert(extractions)
      .values(extractionWithDefaults)
      .returning();
      
    return newExtraction;
  }

  async updateExtraction(id: number, data: Partial<Extraction>): Promise<Extraction | undefined> {
    const [extraction] = await db
      .update(extractions)
      .set(data)
      .where(eq(extractions.id, id))
      .returning();
    return extraction;
  }
}

// Switch from MemStorage to DatabaseStorage
export const storage = new DatabaseStorage();
