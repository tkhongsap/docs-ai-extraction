import { Link } from "wouter";
import { 
  Download, Trash, FileText, AlertCircle, Clock, CheckCircle,
  Image, File, Eye, ArrowRight
} from "lucide-react";
import { Document } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

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
          textColor: "text-green-700",
          bgLight: "bg-green-50",
          borderColor: "border-green-200",
          icon: <CheckCircle className="h-4 w-4 mr-1.5" />,
          label: "Completed"
        };
      case "processing":
        return {
          bgColor: "bg-yellow-500",
          textColor: "text-yellow-700",
          bgLight: "bg-yellow-50",
          borderColor: "border-yellow-200",
          icon: <Clock className="h-4 w-4 mr-1.5 animate-pulse" />,
          label: "Processing"
        };
      case "error":
        return {
          bgColor: "bg-red-500",
          textColor: "text-red-700",
          bgLight: "bg-red-50",
          borderColor: "border-red-200",
          icon: <AlertCircle className="h-4 w-4 mr-1.5" />,
          label: "Error"
        };
      default:
        return {
          bgColor: "bg-gray-500",
          textColor: "text-gray-700",
          bgLight: "bg-gray-50",
          borderColor: "border-gray-200",
          icon: <FileText className="h-4 w-4 mr-1.5" />,
          label: "Uploaded"
        };
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) {
      return <FileText className="h-16 w-16 text-red-500" />;
    } else if (fileType.includes("image")) {
      return <Image className="h-16 w-16 text-blue-500" />;
    }
    return <File className="h-16 w-16 text-gray-500" />;
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
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-all duration-200 hover:border-gray-200 group">
      <div className="h-44 bg-gray-50 relative flex flex-col items-center justify-center p-6">
        {/* Document thumbnail */}
        <div className="mb-2">
          {getFileIcon(document.fileType)}
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">
            {formatFileType(document.fileType)}
          </p>
        </div>
        
        {/* Status badge */}
        <div className={`absolute top-3 right-3 ${statusInfo.bgLight} ${statusInfo.textColor} text-xs px-2.5 py-1 rounded-full flex items-center border ${statusInfo.borderColor}`}>
          {statusInfo.icon}
          {statusInfo.label}
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-gray-800 mb-1 truncate" title={document.originalFilename}>
          {document.originalFilename}
        </h3>
        <p className="text-gray-500 text-sm mb-4">
          Uploaded {formatDistanceToNow(new Date(document.uploadDate), { addSuffix: true })}
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
            {getDocumentType(document.originalFilename, document.fileType)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex space-x-3">
            <button 
              className={`p-1.5 rounded-full ${document.status === "completed" ? "text-gray-500 hover:text-gray-700 hover:bg-gray-100" : "text-gray-300 cursor-not-allowed"}`} 
              title="Download"
              disabled={document.status !== "completed"}
            >
              <Download className="h-4 w-4" />
            </button>
            <button 
              className="p-1.5 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50" 
              title="Delete"
              onClick={() => onDelete && onDelete(document.id)}
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
          
          {document.status === "completed" ? (
            <Link href={`/review/${document.id}`}>
              <Button size="sm" variant="outline" className="group-hover:bg-primary group-hover:text-white transition-colors">
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                View Details
              </Button>
            </Link>
          ) : document.status === "processing" ? (
            <Link href={`/processing`}>
              <Button size="sm" variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100">
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                View Progress
              </Button>
            </Link>
          ) : document.status === "error" ? (
            <Button size="sm" variant="outline" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-default">
              <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
              Error
            </Button>
          ) : (
            <Link href={`/processing`}>
              <Button size="sm" className="gap-1.5">
                Process
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
