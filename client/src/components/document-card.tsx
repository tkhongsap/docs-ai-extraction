import { Link } from "wouter";
import { Download, Trash } from "lucide-react";
import { Document } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface DocumentCardProps {
  document: Document;
  onDelete?: (id: number) => void;
}

export default function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "processing":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
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

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="h-40 bg-gray-100 relative">
        {/* We don't show actual document previews as they would require additional processing */}
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <i className={`${getFileIconClass(document.fileType)} text-4xl`}></i>
        </div>
        <div className={`absolute top-2 right-2 ${getStatusBadgeColor(document.status)} text-white text-xs px-2 py-1 rounded-full`}>
          {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-gray-800 mb-1">{document.originalFilename}</h3>
        <p className="text-gray-500 text-sm mb-3">
          Uploaded {formatDistanceToNow(new Date(document.uploadDate), { addSuffix: true })}
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
            {getDocumentType(document.originalFilename, document.fileType)}
          </span>
          <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
            {formatFileType(document.fileType)}
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
              className="text-gray-500 hover:text-gray-700" 
              title="Delete"
              onClick={() => onDelete && onDelete(document.id)}
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
          {document.status === "completed" ? (
            <Link href={`/review/${document.id}`} className="text-primary text-sm font-medium hover:underline">
              View Details
            </Link>
          ) : document.status === "processing" ? (
            <span className="text-gray-400 cursor-not-allowed text-sm font-medium">Processing...</span>
          ) : document.status === "error" ? (
            <span className="text-red-500 text-sm font-medium">Error</span>
          ) : (
            <Link href={`/processing`} className="text-primary text-sm font-medium hover:underline">
              Process
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
