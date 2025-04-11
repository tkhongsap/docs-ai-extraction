import { useState, useEffect, useCallback } from 'react';

export interface Document {
  id: number;
  originalFilename: string;
  fileSize: number;
  fileType: string;
  uploadDate: string;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface HandwrittenNote {
  text: string;
  confidence: number;
}

export interface Extraction {
  id: number;
  documentId: number;
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  totalAmount: string | null;
  taxAmount: string | null;
  lineItems: LineItem[];
  handwrittenNotes: HandwrittenNote[];
  markdownOutput: string | null;
  jsonOutput: string | null;
}

/**
 * A custom hook for managing documents and their extraction data
 */
export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch all documents
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/documents');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching documents');
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Fetch a single document
  const fetchDocument = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/documents/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
      }
      
      return await response.json() as Document;
    } catch (err: any) {
      console.error('Error fetching document:', err);
      throw err;
    }
  }, []);
  
  // Upload a new document
  const uploadDocument = useCallback(async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Failed to upload document: ${response.status} ${response.statusText}`);
      }
      
      const newDocument = await response.json() as Document;
      
      // Update documents list
      setDocuments(prevDocs => [...prevDocs, newDocument]);
      
      return newDocument;
    } catch (err: any) {
      console.error('Error uploading document:', err);
      throw err;
    }
  }, []);
  
  // Start processing a document
  const processDocument = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/documents/${id}/process`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to process document: ${response.status} ${response.statusText}`);
      }
      
      const updatedDocument = await response.json() as Document;
      
      // Update document in list
      setDocuments(prevDocs => 
        prevDocs.map(doc => doc.id === id ? updatedDocument : doc)
      );
      
      return updatedDocument;
    } catch (err: any) {
      console.error('Error processing document:', err);
      throw err;
    }
  }, []);
  
  // Fetch extraction data for a document
  const fetchExtraction = useCallback(async (documentId: number) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/extraction`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch extraction: ${response.status} ${response.statusText}`);
      }
      
      return await response.json() as Extraction;
    } catch (err: any) {
      console.error('Error fetching extraction:', err);
      throw err;
    }
  }, []);
  
  // Download extraction as markdown
  const downloadMarkdown = useCallback(async (extractionId: number) => {
    try {
      window.open(`/api/extractions/${extractionId}/export/markdown`, '_blank');
      return true;
    } catch (err: any) {
      console.error('Error downloading markdown:', err);
      throw err;
    }
  }, []);
  
  // Download extraction as JSON
  const downloadJSON = useCallback(async (extractionId: number) => {
    try {
      window.open(`/api/extractions/${extractionId}/export/json`, '_blank');
      return true;
    } catch (err: any) {
      console.error('Error downloading JSON:', err);
      throw err;
    }
  }, []);
  
  // Load documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);
  
  return {
    documents,
    loading,
    error,
    fetchDocuments,
    fetchDocument,
    uploadDocument,
    processDocument,
    fetchExtraction,
    downloadMarkdown,
    downloadJSON
  };
} 