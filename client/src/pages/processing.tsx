import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Document } from "@shared/schema";
import ProcessingItem from "@/components/processing-item";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function Processing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Track progress locally for each document
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  
  // Auto-navigate to review when a document is completed
  const [shouldAutoNavigate, setShouldAutoNavigate] = useState(true);
  
  // Track document status changes for auto-navigation
  const [lastCompletedDocId, setLastCompletedDocId] = useState<number | null>(null);
  
  // Refresh interval for polling (in milliseconds)
  const REFRESH_INTERVAL = 3000;
  
  // Maximum processing time before showing warning (in milliseconds)
  const MAX_PROCESSING_TIME = 5 * 60 * 1000; // 5 minutes
  
  // Query for documents with automatic refresh
  const { data: documents, isLoading, error, refetch } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    refetchInterval: REFRESH_INTERVAL,
  });
  
  // Filter for documents that are processing or have errors
  const processingDocuments = documents?.filter(doc => 
    doc.status === 'processing' || doc.status === 'error' || doc.status === 'uploaded'
  );
  
  // Filter for completed documents
  const completedDocuments = documents?.filter(doc => doc.status === 'completed');
  
  // Count documents by status
  const statusCounts = {
    processing: documents?.filter(doc => doc.status === 'processing').length || 0,
    error: documents?.filter(doc => doc.status === 'error').length || 0,
    completed: documents?.filter(doc => doc.status === 'completed').length || 0,
    uploaded: documents?.filter(doc => doc.status === 'uploaded').length || 0
  };
  
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
  
  // Mutation for deleting a document (cancel processing)
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest('DELETE', `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Processing Cancelled",
        description: "The document has been removed.",
      });
    },
    onError: (error) => {
      console.error("Error cancelling processing:", error);
      toast({
        title: "Cancellation Failed",
        description: "Failed to cancel document processing. Please try again.",
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
  
  // Handle progress updates for processing documents with more descriptive phases
  useEffect(() => {
    if (!processingDocuments?.length) return;
    
    // Set initial progress for new documents
    processingDocuments.forEach(doc => {
      if (doc.status === 'processing' && !progressMap[doc.id]) {
        setProgressMap(prev => ({
          ...prev,
          [doc.id]: 5 // Start at 5%
        }));
      }
    });
    
    // Update progress periodically with simulated phases
    const interval = setInterval(() => {
      setProgressMap(prev => {
        const updated = { ...prev };
        
        processingDocuments.forEach(doc => {
          if (doc.status === 'processing' && updated[doc.id] < 95) {
            // Simulate different processing speeds for different documents
            const increment = Math.floor(Math.random() * 3) + 2; // 2-4% increase per step
            updated[doc.id] = Math.min(updated[doc.id] + increment, 95);
            
            // Check for long-running processes
            const processingTime = Date.now() - new Date(doc.uploadDate).getTime();
            if (processingTime > MAX_PROCESSING_TIME && updated[doc.id] < 90) {
              // Show warning for long-running processes
              toast({
                title: "Processing Taking Longer Than Expected",
                description: `"${doc.originalFilename}" is taking longer than usual to process. This may be due to complexity or large file size.`,
                variant: "destructive",
              });
              
              // Skip to later stage to avoid appearing "stuck"
              updated[doc.id] = Math.max(updated[doc.id], 90);
            }
          }
        });
        
        return updated;
      });
    }, 1500);
    
    return () => clearInterval(interval);
  }, [processingDocuments, toast]);
  
  // Check for newly completed documents and handle auto-navigation
  useEffect(() => {
    if (!shouldAutoNavigate || !documents) return;
    
    // Look for documents that completed since last check
    const justCompletedDoc = documents.find(doc => 
      doc.status === 'completed' && 
      progressMap[doc.id] && 
      progressMap[doc.id] < 100 &&
      doc.id !== lastCompletedDocId
    );
    
    if (justCompletedDoc) {
      // Update the progress to 100%
      setProgressMap(prev => ({
        ...prev,
        [justCompletedDoc.id]: 100
      }));
      
      // Store the ID to prevent multiple navigations
      setLastCompletedDocId(justCompletedDoc.id);
      
      // Show success toast
      toast({
        title: "Processing Complete",
        description: `"${justCompletedDoc.originalFilename}" has been successfully processed.`,
      });
      
      // Auto-navigate after a short delay
      setTimeout(() => {
        navigate(`/review/${justCompletedDoc.id}`);
      }, 1500);
    }
  }, [documents, progressMap, shouldAutoNavigate, lastCompletedDocId, navigate, toast]);
  
  // Handle retry for failed documents
  const handleRetry = useCallback((documentId: number) => {
    processDocumentMutation.mutate(documentId);
    
    // Reset progress for this document
    setProgressMap(prev => ({
      ...prev,
      [documentId]: 0
    }));
    
    toast({
      title: "Retrying Document",
      description: "Processing will be attempted again. This may take some time.",
    });
  }, [processDocumentMutation, toast]);
  
  // Handle cancellation (delete document)
  const handleCancel = useCallback((documentId: number) => {
    deleteDocumentMutation.mutate(documentId);
  }, [deleteDocumentMutation]);
  
  // Navigation handlers
  const navigateToUpload = useCallback(() => {
    navigate('/upload');
  }, [navigate]);
  
  const navigateToDocuments = useCallback(() => {
    navigate('/documents');
  }, [navigate]);
  
  const navigateToReview = useCallback((documentId: number) => {
    navigate(`/review/${documentId}`);
  }, [navigate]);
  
  // Toggle auto-navigation
  const toggleAutoNavigate = useCallback(() => {
    setShouldAutoNavigate(prev => !prev);
    toast({
      title: shouldAutoNavigate ? "Auto-navigation disabled" : "Auto-navigation enabled",
      description: shouldAutoNavigate 
        ? "You'll need to click 'View Results' to see completed documents." 
        : "You'll be automatically taken to the review page when processing completes.",
    });
  }, [shouldAutoNavigate, toast]);

  return (
    <section className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Processing Documents</h1>
        <p className="text-gray-600">Your documents are being processed using OCR technology</p>
        
        {/* Processing stats summary */}
        <div className="flex flex-wrap gap-2 mt-4">
          {statusCounts.uploaded > 0 && (
            <Badge variant="outline" className="bg-gray-100">
              {statusCounts.uploaded} Queued
            </Badge>
          )}
          {statusCounts.processing > 0 && (
            <Badge variant="outline" className="bg-blue-100 text-blue-800">
              {statusCounts.processing} Processing
            </Badge>
          )}
          {statusCounts.error > 0 && (
            <Badge variant="outline" className="bg-red-100 text-red-800">
              {statusCounts.error} Failed
            </Badge>
          )}
          {statusCounts.completed > 0 && (
            <Badge variant="outline" className="bg-green-100 text-green-800">
              {statusCounts.completed} Completed
            </Badge>
          )}
        </div>
      </div>

      {/* Auto-navigation control */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleAutoNavigate}
            className={shouldAutoNavigate ? "bg-green-50" : ""}
          >
            {shouldAutoNavigate ? "Auto-navigate: ON" : "Auto-navigate: OFF"}
          </Button>
          <span className="text-xs text-gray-500 ml-2">
            {shouldAutoNavigate ? "You'll be taken to the review page automatically" : "Stay on this page when documents complete"}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => refetch()}
          className="flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Error alert if data fetching fails */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load document data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      )}

      {/* Processing Status */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">Processing Status</h2>
        
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : processingDocuments && processingDocuments.length > 0 ? (
          <div className="space-y-6">
            {processingDocuments.map(document => (
              <ProcessingItem 
                key={document.id}
                document={document}
                progress={progressMap[document.id] || 0}
                onRetry={() => handleRetry(document.id)}
                onCancel={() => handleCancel(document.id)}
                onView={() => navigateToReview(document.id)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded p-8 text-center">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-green-500 h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold mb-2">No documents processing</h3>
            <p className="text-gray-600 mb-4">All documents have been processed or you haven't uploaded any documents yet.</p>
            <Button onClick={navigateToUpload} className="mt-2">
              Upload New Documents
            </Button>
          </div>
        )}
        
        {completedDocuments && completedDocuments.length > 0 && (
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="font-bold text-lg mb-4">Recently Completed</h3>
            <div className="space-y-6">
              {completedDocuments.slice(0, 3).map(document => (
                <ProcessingItem 
                  key={document.id}
                  document={document}
                  progress={100}
                  onView={() => navigateToReview(document.id)}
                />
              ))}
              {completedDocuments.length > 3 && (
                <div className="text-center pt-2">
                  <Button variant="link" onClick={navigateToDocuments}>
                    View all {completedDocuments.length} completed documents
                  </Button>
                </div>
              )}
            </div>
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
            View All Documents
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
        
        <div className="mt-4 bg-white rounded p-4 border border-blue-200">
          <h4 className="font-bold text-sm mb-2">Status Explanation:</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li className="flex items-center">
              <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs mr-2 font-medium">Queued</span>
              <span>Document is waiting for OCR processing to begin</span>
            </li>
            <li className="flex items-center">
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs mr-2 font-medium">Processing</span>
              <span>OCR or handwriting recognition is currently in progress</span>
            </li>
            <li className="flex items-center">
              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs mr-2 font-medium">Completed</span>
              <span>Processing finished successfully, ready for review</span>
            </li>
            <li className="flex items-center">
              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs mr-2 font-medium">Error</span>
              <span>An issue occurred during processing - you can retry or contact support</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
