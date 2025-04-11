import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Document } from "@shared/schema";
import ProcessingItem from "@/components/processing-item";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Processing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Track progress locally for each document
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
  });
  
  // Filter for documents that are processing or have errors
  const processingDocuments = documents?.filter(doc => 
    doc.status === 'processing' || doc.status === 'error' || doc.status === 'uploaded'
  );
  
  // Filter for completed documents
  const completedDocuments = documents?.filter(doc => doc.status === 'completed');
  
  // Mutation for starting processing
  const processDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest('POST', `/api/documents/${documentId}/process`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Processing Started",
        description: "Document processing has been initiated.",
      });
    },
    onError: (error) => {
      console.error("Error starting processing:", error);
      toast({
        title: "Processing Failed",
        description: "Failed to start document processing. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Start processing for any 'uploaded' documents automatically
  useEffect(() => {
    const uploadedDocs = documents?.filter(doc => doc.status === 'uploaded') || [];
    
    uploadedDocs.forEach(doc => {
      processDocumentMutation.mutate(doc.id);
    });
  }, [documents]);
  
  // Simulate progress updates for processing documents
  useEffect(() => {
    if (!processingDocuments?.length) return;
    
    // Set initial progress for new documents
    processingDocuments.forEach(doc => {
      if (doc.status === 'processing' && !progressMap[doc.id]) {
        setProgressMap(prev => ({
          ...prev,
          [doc.id]: 10 // Start at 10%
        }));
      }
    });
    
    // Update progress periodically
    const interval = setInterval(() => {
      setProgressMap(prev => {
        const updated = { ...prev };
        
        processingDocuments.forEach(doc => {
          if (doc.status === 'processing' && updated[doc.id] < 95) {
            updated[doc.id] = Math.min(updated[doc.id] + 5, 95);
          }
        });
        
        return updated;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [processingDocuments]);
  
  // Handle retry for failed documents
  const handleRetry = (documentId: number) => {
    processDocumentMutation.mutate(documentId);
  };
  
  // Navigation handlers
  const navigateToUpload = () => {
    navigate('/upload');
  };
  
  const navigateToDocuments = () => {
    navigate('/documents');
  };
  
  const navigateToReview = (documentId: number) => {
    navigate(`/review/${documentId}`);
  };

  return (
    <section className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Processing Documents</h1>
        <p className="text-gray-600">Your documents are being processed using OCR technology</p>
      </div>

      {/* Processing Status */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">Processing Status</h2>
        
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : processingDocuments && processingDocuments.length > 0 ? (
          <>
            {processingDocuments.map(document => (
              <ProcessingItem 
                key={document.id}
                document={document}
                progress={progressMap[document.id] || 0}
                onRetry={() => handleRetry(document.id)}
                onCancel={() => {}} // We could implement document deletion here
                onView={() => navigateToReview(document.id)}
              />
            ))}
          </>
        ) : (
          <div className="bg-gray-50 rounded p-8 text-center">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-green-500 h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold mb-2">No documents processing</h3>
            <p className="text-gray-600 mb-4">All documents have been processed or you haven't uploaded any documents yet.</p>
          </div>
        )}
        
        {completedDocuments && completedDocuments.length > 0 && (
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="font-bold text-lg mb-4">Recently Completed</h3>
            {completedDocuments.slice(0, 3).map(document => (
              <ProcessingItem 
                key={document.id}
                document={document}
                progress={100}
                onView={() => navigateToReview(document.id)}
              />
            ))}
          </div>
        )}
        
        <div className="flex justify-between mt-8">
          <Button 
            variant="outline"
            onClick={navigateToUpload}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Upload
          </Button>
          <Button onClick={navigateToDocuments}>
            View Completed Documents
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Processing Information */}
      <div className="bg-blue-50 rounded-lg p-5">
        <h3 className="font-bold text-primary mb-3">About Processing</h3>
        <p className="text-gray-700 mb-3">Your documents are being processed using advanced OCR technology powered by OpenAI Vision and LlamaParse. The processing time depends on document complexity and size.</p>
        <div className="bg-white rounded p-4 border border-blue-200">
          <h4 className="font-bold text-sm mb-2">Processing Steps:</h4>
          <ol className="text-sm text-gray-700 space-y-1">
            <li className="flex items-center">
              <span className="bg-blue-200 text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">1</span>
              <span>Document analysis and preparation</span>
            </li>
            <li className="flex items-center">
              <span className="bg-blue-200 text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">2</span>
              <span>Text extraction and recognition</span>
            </li>
            <li className="flex items-center">
              <span className="bg-blue-200 text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">3</span>
              <span>Structure identification and data organization</span>
            </li>
            <li className="flex items-center">
              <span className="bg-blue-200 text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">4</span>
              <span>Final verification and data preparation</span>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
