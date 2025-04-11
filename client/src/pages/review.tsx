import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Check, Copy, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Document, Extraction } from "@shared/schema";
import DocumentPreview from "@/components/document-preview";
import ExtractedDataViewer from "@/components/extracted-data-viewer";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Review() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDataUpdated, setIsDataUpdated] = useState(false);
  const [documentScrollPosition, setDocumentScrollPosition] = useState<number>(0);
  const isMobile = useIsMobile();
  
  // Handle copy document link to clipboard
  const copyDocumentLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link Copied",
        description: "Document link copied to clipboard.",
      });
    }).catch((err) => {
      toast({
        title: "Copy Failed",
        description: "Could not copy link to clipboard.",
        variant: "destructive"
      });
    });
  };
  
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
  
  // Handle when data is updated
  const handleDataUpdated = (updatedData: Extraction) => {
    setIsDataUpdated(true);
    toast({
      title: "Data Updated",
      description: "The extracted data has been successfully updated.",
    });
  };
  
  // Handle reprocessing document
  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/documents/${id}/process`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to reprocess document');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/extractions/document/${id}`]
      });
      toast({
        title: "Reprocessing Started",
        description: "Document is being reprocessed. This may take a moment.",
      });
    },
    onError: (error) => {
      toast({
        title: "Reprocessing Failed",
        description: error instanceof Error ? error.message : "Failed to reprocess document.",
        variant: "destructive"
      });
    }
  });
  
  // Handle getting next document
  const getNextDocument = async () => {
    try {
      const response = await fetch(`/api/documents/next/${id}`);
      if (!response.ok) {
        throw new Error('Failed to get next document');
      }
      
      const data = await response.json();
      if (data.id) {
        navigate(`/review/${data.id}`);
      } else {
        toast({
          title: "No More Documents",
          description: "There are no more documents to review.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive"
      });
    }
  };
  
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
      {/* Header with breadcrumb and actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center mb-6">
        <div>
          <div className="flex items-center mb-2">
            <button 
              onClick={() => navigate('/documents')} 
              className="text-gray-500 hover:text-gray-700 mr-2"
            >
              Documents
            </button>
            <span className="text-gray-400 mx-1">/</span>
            <span className="text-gray-700 font-medium">Review</span>
          </div>
          <h1 className="text-2xl font-bold">Document Review</h1>
        </div>
        
        <div className="flex mt-4 sm:mt-0 space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => reprocessMutation.mutate()}
            disabled={reprocessMutation.isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reprocess
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={getNextDocument}
          >
            <Check className="mr-2 h-4 w-4" />
            Next Document
          </Button>
        </div>
      </div>
      
      {/* Document info bar */}
      <div className="bg-gray-100 rounded-lg p-3 mb-6">
        <div className="flex flex-col sm:flex-row justify-between">
          <div className="mb-2 sm:mb-0">
            <span className="text-sm font-medium">File: </span>
            <span className="text-sm">{document.originalFilename}</span>
          </div>
          <div className="flex space-x-4">
            <div>
              <span className="text-sm font-medium">Status: </span>
              <span className={`text-sm ${
                document.status === 'completed' ? 'text-green-600' : 
                document.status === 'processing' ? 'text-blue-600' : 
                document.status === 'error' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium">Uploaded: </span>
              <span className="text-sm">{new Date(document.uploadDate).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Additional actions */}
      <div className="flex mb-4 flex-wrap gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={copyDocumentLink}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy Link
        </Button>
        
        {extraction && (
          <>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(`/api/extractions/${extraction.id}/export/json`, "_blank")}
            >
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(`/api/extractions/${extraction.id}/export/markdown`, "_blank")}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Markdown
            </Button>
          </>
        )}
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.open(`/api/documents/${id}/file`, "_blank")}
        >
          <Eye className="mr-2 h-4 w-4" />
          View Original
        </Button>
        
        {document.status === 'completed' && (
          <Badge className="ml-auto bg-green-100 text-green-800 border-green-200">
            OCR Complete
          </Badge>
        )}
        
        {document.status === 'processing' && (
          <Badge className="ml-auto bg-blue-100 text-blue-800 border-blue-200">
            Processing
          </Badge>
        )}
        
        {document.status === 'error' && (
          <Badge className="ml-auto bg-red-100 text-red-800 border-red-200">
            Error
          </Badge>
        )}
      </div>

      {/* Main Content: Document and Data View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Original Document */}
        <div className={`${isMobile ? 'order-2' : 'order-1'}`}>
          <DocumentPreview 
            document={document} 
            onScroll={(position) => setDocumentScrollPosition(position)}
          />
        </div>
        
        {/* Extracted Data */}
        <div className={`${isMobile ? 'order-1' : 'order-2'}`}>
          {extraction ? (
            <ExtractedDataViewer 
              extraction={extraction} 
              documentId={parseInt(id)}
              onDataUpdated={handleDataUpdated}
              documentScrollPosition={documentScrollPosition}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-lg font-bold mb-4">Extracted Data</h2>
              <div className="bg-gray-50 p-8 text-center rounded-md">
                <p className="text-gray-500">No extraction data available for this document.</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => reprocessMutation.mutate()}
                  disabled={reprocessMutation.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Process Document
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Document processing tips */}
      {document.status === 'completed' && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Tips for Reviewing OCR Results</h3>
          <ul className="text-xs text-blue-700 list-disc pl-4 space-y-1">
            <li>Carefully review all extracted fields for accuracy, especially numerical values</li>
            <li>Handwritten notes may require more careful verification than printed text</li>
            <li>Use the Edit button in the Extracted Data panel to correct any errors</li>
            <li>For poor quality scans, consider reprocessing the document or manually editing the data</li>
          </ul>
        </div>
      )}
      
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
          <Button 
            variant="outline"
            onClick={getNextDocument}
          >
            Process Next Document
          </Button>
          {isDataUpdated && (
            <span className="text-green-600 text-sm">
              ✓ Changes saved
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
