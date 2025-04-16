import { Document, ProcessingMetadata } from "@shared/schema";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { RefreshCw, XCircle, Eye, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ReactNode } from "react";

interface ProcessingItemProps {
  document: Document;
  progress: number;
  onRetry?: () => void;
  onCancel?: () => void;
  onView?: () => void;
}

export default function ProcessingItem({ 
  document, 
  progress, 
  onRetry, 
  onCancel,
  onView 
}: ProcessingItemProps) {
  const getFileIconClass = (fileType: string) => {
    if (fileType.includes("pdf")) {
      return "fas fa-file-pdf text-red-500";
    } else if (fileType.includes("jpeg") || fileType.includes("jpg")) {
      return "fas fa-file-image text-blue-500";
    } else if (fileType.includes("png")) {
      return "fas fa-file-image text-green-500";
    } else if (fileType.includes("tiff")) {
      return "fas fa-file-image text-purple-500";
    }
    return "fas fa-file text-gray-500";
  };

  const getStatusMessage = (status: string, progress: number) => {
    if (status === "uploaded") {
      return "Queued — Waiting for OCR/handwriting tasks to start";
    } else if (status === "error") {
      // Format error messages for better user experience
      if (document.errorMessage) {
        if (document.errorMessage.includes("timeout")) {
          return "Processing timeout — The document may be too large or complex. Try with a smaller file.";
        } else if (document.errorMessage.includes("exceeded")) {
          return "File size limit exceeded — The document is too large. Please reduce the file size.";
        } else if (document.errorMessage.includes("API key")) {
          return "API authentication error — Please contact support to verify your account.";
        } else if (document.errorMessage.includes("hang up") || document.errorMessage.includes("socket") || document.errorMessage.includes("Connection closed")) {
          return "Server connection lost — The service may be experiencing high load. Please try again later.";
        } else if (document.errorMessage.includes("Network")) {
          return "Network error — Please check your internet connection and try again.";
        } else {
          return document.errorMessage;
        }
      } else {
        return "Failed to process document — Please retry or contact support";
      }
    } else if (status === "completed") {
      return "Processing complete — Ready to review";
    } else if (progress < 15) {
      return "Document analysis and preparation — Initializing OCR";
    } else if (progress < 35) {
      return "Text extraction — Processing document content";
    } else if (progress < 55) {
      return "Handwriting recognition — Analyzing handwritten notes";
    } else if (progress < 75) {
      return "Structure identification — Parsing invoice data";
    } else if (progress < 95) {
      return "Data extraction — Organizing information";
    } else {
      return "Final verification — Preparing data for review";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "processing":
        return "text-blue-600";
      case "uploaded":
        return "text-gray-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "processing":
        return "bg-blue-500";
      case "uploaded":
        return "bg-gray-400";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "uploaded":
        return "bg-gray-100 text-gray-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | Date) => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return format(date, 'MMM d, yyyy, h:mm a');
    } catch (error) {
      return 'Unknown date';
    }
  };

  // Helper function to get a more descriptive status label
  const getStatusLabel = (status: string, progress: number) => {
    if (status === "processing" && progress >= 95) {
      return "Finalizing";
    } else if (status === "processing") {
      return "Processing";
    } else if (status === "uploaded") {
      return "Queued";
    } else if (status === "error") {
      return "Error";
    } else if (status === "completed") {
      return "Completed";
    } else {
      return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm transition-all hover:shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center max-w-[70%]">
          <i className={`${getFileIconClass(document.fileType)} mr-3 text-xl`}></i>
          <div>
            <div className="font-medium truncate">{document.originalFilename}</div>
            <div className="text-xs text-gray-500 mt-1">
              <span className="inline-block mr-3">{formatBytes(document.fileSize)}</span>
              <span className="inline-block">{formatDate(document.uploadDate)}</span>
            </div>
          </div>
        </div>
        <div className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusBadgeClass(document.status)}`}>
          {getStatusLabel(document.status, progress)}
        </div>
      </div>
      
      <Progress 
        value={document.status === "completed" ? 100 : document.status === "error" ? 30 : document.status === "uploaded" ? 0 : progress} 
        className="h-2.5 mt-2"
        indicatorClassName={getProgressColor(document.status)}
      />
      
      <div className="flex justify-between mt-2">
        <span className={`text-xs ${document.status === "error" ? "text-red-500 flex items-center" : "text-gray-500"}`}>
          {document.status === "error" && <AlertCircle className="h-3 w-3 mr-1" />}
          {getStatusMessage(document.status, progress)}
        </span>
        <span className="text-xs font-medium text-gray-700">
          {document.status === "completed" ? "100%" : document.status === "error" ? "Failed" : document.status === "uploaded" ? "Queued" : `${progress}%`}
        </span>
      </div>
      
      {/* Fallback notification - temporarily disabled until TypeScript issues are resolved
        if (document.processingMetadata) {
          const meta = document.processingMetadata as any;
          if (meta.ocrEngine && meta.ocrEngine.includes('fallback')) {
            <div className="mt-2 bg-amber-50 p-2 rounded-md border border-amber-200 text-xs text-amber-800 flex items-start">
              <AlertCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
              <span>
                LlamaParse connection failed. Successfully processed with OpenAI Vision fallback mechanism.
              </span>
            </div>
          }
        }
      */}
      
      <div className="mt-3 flex justify-end space-x-2">
        {document.status === "completed" && onView && (
          <Button 
            variant="outline" 
            size="sm"
            className="text-primary text-xs"
            onClick={onView}
          >
            <Eye className="h-3 w-3 mr-1" />
            View Results
          </Button>
        )}
        
        {document.status === "processing" && onCancel && (
          <Button 
            variant="outline" 
            size="sm"
            className="text-gray-700 text-xs"
            onClick={onCancel}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        )}
        
        {document.status === "error" && onRetry && (
          <Button 
            variant="outline" 
            size="sm"
            className="text-primary text-xs"
            onClick={onRetry}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
        
        {document.status === "error" && onCancel && (
          <Button 
            variant="outline" 
            size="sm"
            className="text-red-500 text-xs"
            onClick={onCancel}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Remove
          </Button>
        )}
        
        {document.status === "uploaded" && onCancel && (
          <Button 
            variant="outline" 
            size="sm"
            className="text-gray-700 text-xs"
            onClick={onCancel}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
