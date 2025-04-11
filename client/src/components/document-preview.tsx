import { Document } from "@shared/schema";

interface DocumentPreviewProps {
  document: Document;
}

export default function DocumentPreview({ document }: DocumentPreviewProps) {
  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // In a real implementation, we would show a document preview using a library
  // like react-pdf for PDFs, or a simple image for image files
  const getFileIconClass = (fileType: string) => {
    if (fileType.includes("pdf")) {
      return "fas fa-file-pdf text-red-500";
    } else if (fileType.includes("image")) {
      return "fas fa-file-image text-blue-500";
    }
    return "fas fa-file text-gray-500";
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h2 className="text-lg font-bold mb-3">Original Document</h2>
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-3 bg-gray-100 h-80 flex items-center justify-center">
        <i className={`${getFileIconClass(document.fileType)} text-5xl`}></i>
      </div>
      <div className="flex justify-between">
        <div>
          <span className="text-sm text-gray-500">{document.originalFilename}</span>
          <span className="text-xs text-gray-400 ml-2">{formatFileSize(document.fileSize)}</span>
        </div>
        <button className="text-primary text-sm hover:underline">View Full Size</button>
      </div>
    </div>
  );
}
