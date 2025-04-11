import { useState } from "react";
import { Document as DocumentType } from "@shared/schema";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentPreviewProps {
  document: DocumentType;
}

export default function DocumentPreview({ document }: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  
  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  const handleZoomIn = () => {
    if (zoom < 200) setZoom(zoom + 25);
  };
  
  const handleZoomOut = () => {
    if (zoom > 50) setZoom(zoom - 25);
  };
  
  const handleRotate = () => {
    setRotation((rotation + 90) % 360);
  };
  
  // Determine preview content based on file type
  const renderPreviewContent = () => {
    const fileUrl = `/api/documents/${document.id}/file`;
    
    if (document.fileType.includes("pdf")) {
      return (
        <iframe 
          src={`${fileUrl}#zoom=${zoom/100}`} 
          className="w-full h-full border-0"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      );
    } else if (document.fileType.includes("image")) {
      return (
        <img 
          src={fileUrl} 
          alt={document.originalFilename} 
          className="max-w-full max-h-full object-contain"
          style={{ 
            transform: `rotate(${rotation}deg) scale(${zoom/100})`,
            transformOrigin: 'center' 
          }}
        />
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center">
        <i className="fas fa-file text-gray-500 text-5xl mb-4"></i>
        <p className="text-gray-600">Preview not available for this file type</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col">
      <h2 className="text-lg font-bold mb-3">Original Document</h2>
      
      {/* Document Controls */}
      <div className="flex justify-end space-x-2 mb-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleZoomOut}
          disabled={zoom <= 50}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="py-1 px-2 text-sm">{zoom}%</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleZoomIn}
          disabled={zoom >= 200}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRotate}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Document Preview */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100 h-[500px] flex items-center justify-center">
        {renderPreviewContent()}
      </div>
      
      {/* Document Info */}
      <div className="flex justify-between mt-3">
        <div>
          <span className="text-sm text-gray-500">{document.originalFilename}</span>
          <span className="text-xs text-gray-400 ml-2">{formatFileSize(document.fileSize)}</span>
        </div>
        <a 
          href={`/api/documents/${document.id}/file`} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-primary text-sm hover:underline"
        >
          View Full Size
        </a>
      </div>
    </div>
  );
}
