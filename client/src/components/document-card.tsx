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
          bgColor: "bg-amber-500",
          textColor: "text-amber-700",
          bgLight: "bg-amber-50",
          borderColor: "border-amber-200",
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
      return <FileText className="h-20 w-20 text-red-500 group-hover:text-red-600 transition-colors" />;
    } else if (fileType.includes("image")) {
      return <Image className="h-20 w-20 text-blue-500 group-hover:text-blue-600 transition-colors" />;
    }
    return <File className="h-20 w-20 text-gray-500 group-hover:text-gray-600 transition-colors" />;
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
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 group hover:border-indigo-100 h-full flex flex-col">
      <div className="h-48 bg-gradient-to-br from-gray-50 to-gray-100 relative flex flex-col items-center justify-center p-6 group-hover:from-indigo-50 group-hover:to-blue-50 transition-colors duration-300">
        {/* Document thumbnail */}
        <div className="mb-2 transform transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
          {getFileIcon(document.fileType)}
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 inline-block">
            {formatFileType(document.fileType)}
          </p>
        </div>
        
        {/* Status badge */}
        <div className={`absolute top-3 right-3 ${statusInfo.bgLight} ${statusInfo.textColor} text-xs px-3 py-1 rounded-full flex items-center border ${statusInfo.borderColor} shadow-sm`}>
          {statusInfo.icon}
          {statusInfo.label}
        </div>
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="font-semibold text-gray-800 text-lg mb-1 truncate group-hover:text-indigo-700 transition-colors duration-300" title={document.originalFilename}>
          {document.originalFilename}
        </h3>
        <p className="text-gray-500 text-sm mb-4">
          Uploaded {formatDistanceToNow(new Date(document.uploadDate), { addSuffix: true })}
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="bg-indigo-100 text-indigo-700 text-xs px-3 py-1 rounded-full font-medium">
            {getDocumentType(document.originalFilename, document.fileType)}
          </span>
        </div>
        <div className="mt-auto flex justify-between items-center">
          <div className="flex space-x-3">
            <button 
              className={`p-2 rounded-full transition-all duration-200 ${document.status === "completed" ? "text-gray-500 hover:text-gray-700 hover:bg-gray-100" : "text-gray-300 cursor-not-allowed"}`} 
              title="Download"
              disabled={document.status !== "completed"}
            >
              <Download className="h-4 w-4" />
            </button>
            <button 
              className="p-2 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200" 
              title="Delete"
              onClick={() => onDelete && onDelete(document.id)}
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
          
          {document.status === "completed" ? (
            <Link href={`/review/${document.id}`}>
              <Button size="sm" variant="outline" className="group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                View Details
              </Button>
            </Link>
          ) : document.status === "processing" ? (
            <Link href={`/processing`}>
              <Button size="sm" variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all">
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                View Progress
              </Button>
            </Link>
          ) : document.status === "error" ? (
            <Button size="sm" variant="outline" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-default transition-all">
              <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
              Error
            </Button>
          ) : (
            <Link href={`/processing`}>
              <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 transition-all">
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
