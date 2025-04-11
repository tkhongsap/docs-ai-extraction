import { Link } from "wouter";
import { Download, Trash, FileText, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { Document } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface DocumentCardProps {
  document: Document;
  onDelete?: (id: number) => void;
}

export default function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "completed":
        return {
          bgColor: "bg-green-500",
          textColor: "text-green-800",
          bgLight: "bg-green-100",
          icon: <CheckCircle className="h-4 w-4 mr-1" />,
          label: "Completed"
        };
      case "processing":
        return {
          bgColor: "bg-yellow-500",
          textColor: "text-yellow-800",
          bgLight: "bg-yellow-100",
          icon: <Clock className="h-4 w-4 mr-1 animate-pulse" />,
          label: "Processing"
        };
      case "error":
        return {
          bgColor: "bg-red-500",
          textColor: "text-red-800",
          bgLight: "bg-red-100",
          icon: <AlertCircle className="h-4 w-4 mr-1" />,
          label: "Error"
        };
      default:
        return {
          bgColor: "bg-gray-500",
          textColor: "text-gray-800",
          bgLight: "bg-gray-100",
          icon: <FileText className="h-4 w-4 mr-1" />,
          label: "Uploaded"
        };
    }
  };

  const getFileIconClass = (fileType: string) => {
    if (fileType.includes("pdf")) {
      return "fas fa-file-pdf text-red-500";
    } else if (fileType.includes("image")) {
      return "fas fa-file-image text-blue-500";
    }
    return "fas fa-file text-gray-500";
  };

  const getDocumentType = (fileName: string, fileType: string) => {
    if (fileName.toLowerCase().includes("invoice")) {
      return "Invoice";
    } else if (fileName.toLowerCase().includes("receipt")) {
      return "Receipt";
    } else if (fileName.toLowerCase().includes("note")) {
      return "Notes";
    } else if (fileType.includes("pdf")) {
      return "Document";
    }
    return "File";
  };

  const formatFileType = (fileType: string) => {
    if (fileType.includes("pdf")) return "PDF";
    if (fileType.includes("jpeg") || fileType.includes("jpg")) return "JPG";
    if (fileType.includes("png")) return "PNG";
    if (fileType.includes("tiff")) return "TIFF";
    return fileType.split("/")[1]?.toUpperCase() || "FILE";
  };

  const statusInfo = getStatusInfo(document.status);

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow duration-200">
      <div className="h-40 bg-gray-100 relative">
        {/* Document thumbnail */}
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <i className={`${getFileIconClass(document.fileType)} text-4xl`}></i>
        </div>
        
        {/* Status badge */}
        <div className={`absolute top-2 right-2 ${statusInfo.bgColor} text-white text-xs px-2 py-1 rounded-full flex items-center`}>
          {statusInfo.icon}
          {statusInfo.label}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-gray-800 mb-1 truncate" title={document.originalFilename}>
          {document.originalFilename}
        </h3>
        <p className="text-gray-500 text-sm mb-3">
          Uploaded {formatDistanceToNow(new Date(document.uploadDate), { addSuffix: true })}
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded flex items-center">
            {getDocumentType(document.originalFilename, document.fileType)}
          </span>
          <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
            {formatFileType(document.fileType)}
          </span>
          <span className={`${statusInfo.bgLight} ${statusInfo.textColor} text-xs px-2 py-1 rounded flex items-center`}>
            {statusInfo.icon}
            {statusInfo.label}
          </span>
        </div>
        <div className="flex justify-between">
          <div className="flex space-x-2">
            <button 
              className={`${document.status === "completed" ? "text-gray-500 hover:text-gray-700" : "text-gray-300 cursor-not-allowed"}`} 
              title="Download"
              disabled={document.status !== "completed"}
            >
              <Download className="h-4 w-4" />
            </button>
            <button 
              className="text-gray-500 hover:text-red-700" 
              title="Delete"
              onClick={() => onDelete && onDelete(document.id)}
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
          {document.status === "completed" ? (
            <Link href={`/review/${document.id}`} className="text-primary text-sm font-medium hover:underline flex items-center">
              View Details
            </Link>
          ) : document.status === "processing" ? (
            <Link href={`/processing`} className="text-yellow-600 text-sm font-medium hover:underline flex items-center">
              View Progress
            </Link>
          ) : document.status === "error" ? (
            <span className="text-red-500 text-sm font-medium flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" /> Error
            </span>
          ) : (
            <Link href={`/processing`} className="text-primary text-sm font-medium hover:underline flex items-center">
              Process
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
