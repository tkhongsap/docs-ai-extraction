import { Document } from "@shared/schema";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

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
    }
    return "fas fa-file text-gray-500";
  };

  const getStatusMessage = (status: string, progress: number) => {
    if (status === "error") {
      return "Failed to process document";
    } else if (status === "completed") {
      return "Processing complete";
    } else if (progress < 25) {
      return "Document analysis and preparation";
    } else if (progress < 50) {
      return "Text extraction and recognition";
    } else if (progress < 75) {
      return "Structure identification and data organization";
    } else {
      return "Final verification and data preparation";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "processing":
        return "text-yellow-600";
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
        return "bg-primary";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <i className={`${getFileIconClass(document.fileType)} mr-3`}></i>
          <span className="font-medium">{document.originalFilename}</span>
        </div>
        <span className={`text-sm font-medium ${getStatusColor(document.status)}`}>
          {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
        </span>
      </div>
      <Progress 
        value={document.status === "completed" ? 100 : document.status === "error" ? 30 : progress} 
        className="h-2.5"
        indicatorClassName={getProgressColor(document.status)}
      />
      <div className="flex justify-between mt-1">
        <span className={`text-xs ${document.status === "error" ? "text-red-500" : "text-gray-500"}`}>
          {getStatusMessage(document.status, progress)}
        </span>
        <span className="text-xs font-medium text-gray-700">
          {document.status === "completed" ? "100%" : document.status === "error" ? "30%" : `${progress}%`}
        </span>
      </div>
      
      {document.status === "completed" && onView && (
        <div className="mt-2 text-right">
          <Button 
            variant="link" 
            className="text-primary text-sm font-medium p-0 h-auto"
            onClick={onView}
          >
            View Results
          </Button>
        </div>
      )}
      
      {document.status === "error" && (onRetry || onCancel) && (
        <div className="mt-2 text-right">
          {onRetry && (
            <Button 
              variant="link" 
              className="text-primary text-sm font-medium p-0 h-auto mr-3"
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
          {onCancel && (
            <Button 
              variant="link" 
              className="text-red-500 text-sm font-medium p-0 h-auto"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
