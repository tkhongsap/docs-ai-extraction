import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Document, Extraction } from "@shared/schema";
import DocumentPreview from "@/components/document-preview";
import ExtractedDataViewer from "@/components/extracted-data-viewer";

export default function Review() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  
  // Get document details
  const { data: document, isLoading: isDocumentLoading } = useQuery<Document>({
    queryKey: [`/api/documents/${id}`],
    enabled: !!id,
  });
  
  // Get extraction data
  const { data: extraction, isLoading: isExtractionLoading } = useQuery<Extraction>({
    queryKey: [`/api/extractions/document/${id}`],
    enabled: !!id,
  });
  
  const isLoading = isDocumentLoading || isExtractionLoading;
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }
  
  if (!document) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white rounded-lg p-8 text-center">
          <h3 className="text-lg font-bold mb-2">Document not found</h3>
          <p className="text-gray-600 mb-4">The document you're looking for doesn't exist or has been deleted.</p>
          <Button onClick={() => navigate('/documents')}>
            Back to Documents
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <section className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Document Review</h1>
        <p className="text-gray-600">Review and edit extracted data</p>
      </div>

      {/* Document and Data View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Original Document */}
        <DocumentPreview document={document} />
        
        {/* Extracted Data */}
        {extraction ? (
          <ExtractedDataViewer 
            extraction={extraction} 
            documentId={parseInt(id)}
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-bold mb-4">Extracted Data</h2>
            <div className="bg-gray-50 p-8 text-center rounded-md">
              <p className="text-gray-500">No extraction data available for this document.</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="mt-8 flex justify-between">
        <Button 
          variant="outline"
          onClick={() => navigate('/documents')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Documents
        </Button>
        
        <div className="space-x-3">
          <Button variant="outline">
            Process Next Document
          </Button>
          <Button>
            Save Changes
          </Button>
        </div>
      </div>
    </section>
  );
}
