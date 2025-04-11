import { documents, type Document, type InsertDocument } from "@shared/schema";
import { extractions, type Extraction, type InsertExtraction } from "@shared/schema";

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
    const uploadDate = doc.uploadDate || new Date();
    
    const document: Document = { 
      ...doc, 
      id, 
      uploadDate
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
    const newExtraction: Extraction = { ...extraction, id };
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

export const storage = new MemStorage();
