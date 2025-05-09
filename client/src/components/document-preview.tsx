import { useState, useRef, useEffect } from "react";
import { Document as DocumentType } from "@shared/schema";
import { ZoomIn, ZoomOut, RotateCw, Maximize, Minimize, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface DocumentPreviewProps {
  document: DocumentType;
  onScroll?: (scrollPosition: number) => void;
}

export default function DocumentPreview({ document, onScroll }: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  // Updated zoom functions that interact with embedded PDF viewer
  const handleZoomIn = () => {
    if (zoom < 200) {
      const newZoom = zoom + 25;
      setZoom(newZoom);
      updatePdfZoom(newZoom);
    }
  };
  
  const handleZoomOut = () => {
    if (zoom > 50) {
      const newZoom = zoom - 25;
      setZoom(newZoom);
      updatePdfZoom(newZoom);
    }
  };
  
  const handleZoomChange = (value: number[]) => {
    const newZoom = value[0];
    setZoom(newZoom);
    updatePdfZoom(newZoom);
  };
  
  // Function to update PDF zoom level
  const updatePdfZoom = (zoomLevel: number) => {
    if (iframeRef.current && document.fileType.includes("pdf")) {
      // Force iframe refresh with new zoom level
      const iframe = iframeRef.current;
      const fileUrl = `/api/documents/${document.id}/file`;
      
      // Map zoom percentages to PDF viewer zoom levels
      let pdfZoom;
      if (zoomLevel <= 50) pdfZoom = 0.5;      // 50%
      else if (zoomLevel <= 75) pdfZoom = 0.75;  // 75% 
      else if (zoomLevel <= 100) pdfZoom = 1.0;  // 100%
      else if (zoomLevel <= 125) pdfZoom = 1.25; // 125%
      else if (zoomLevel <= 150) pdfZoom = 1.5;  // 150%
      else if (zoomLevel <= 175) pdfZoom = 1.75; // 175%
      else pdfZoom = 2.0;                      // 200%
      
      iframe.src = `${fileUrl}#zoom=${pdfZoom}`;
    }
  };
  
  const handleRotate = () => {
    setRotation((rotation + 90) % 360);
  };
  
  const handleResetView = () => {
    const newZoom = 100;
    setZoom(newZoom);
    setRotation(0);
    updatePdfZoom(newZoom);
  };
  
  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };
  
  // Handle scrolling and sync with extracted data
  const handleScroll = () => {
    if (containerRef.current && onScroll) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const scrollPercentage = (scrollTop / (scrollHeight - clientHeight)) * 100;
      onScroll(scrollPercentage);
    }
  };
  
  // Add keyboard shortcuts for zoom and rotation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        handleRotate();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoom, rotation]);
  
  // Update PDF zoom when zoom level changes
  useEffect(() => {
    if (document.fileType && document.fileType.includes("pdf") && iframeRef.current) {
      updatePdfZoom(zoom);
    }
  }, [zoom, document.fileType]);
  
  // Determine preview content based on file type
  const renderPreviewContent = () => {
    const fileUrl = `/api/documents/${document.id}/file`;
    
    if (document.fileType.includes("pdf")) {
      // Calculate initial PDF zoom level
      let pdfZoom;
      if (zoom <= 50) pdfZoom = 0.5;      // 50%
      else if (zoom <= 75) pdfZoom = 0.75;  // 75% 
      else if (zoom <= 100) pdfZoom = 1.0;  // 100%
      else if (zoom <= 125) pdfZoom = 1.25; // 125%
      else if (zoom <= 150) pdfZoom = 1.5;  // 150%
      else if (zoom <= 175) pdfZoom = 1.75; // 175%
      else pdfZoom = 2.0;                 // 200%
      
      return (
        <iframe 
          ref={iframeRef}
          src={`${fileUrl}#zoom=${pdfZoom}`} 
          className="w-full h-full border-0"
          style={{ 
            transform: `rotate(${rotation}deg)`,
            height: "100%",
            display: "block"
          }}
          title={document.originalFilename}
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
        <div className="text-gray-500 text-5xl mb-4">📄</div>
        <p className="text-gray-600">Preview not available for this file type</p>
      </div>
    );
  };

  return (
    <div className={`flex flex-col ${fullscreen ? 'fixed inset-0 z-50 bg-white p-4' : ''}`}>
      {fullscreen && (
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">Document Viewer - {document.originalFilename}</h2>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              title="Exit full screen"
            >
              <Minimize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Only show controls if not embedded in review page with its own header */}
      {!fullscreen && (
        <div className="flex justify-end items-center mb-2">
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              title="Full screen"
            >
              <Maximize className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetView}
              title="Reset view"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Document Controls */}
      <div className="flex flex-col space-y-2 mb-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Zoom</span>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="py-1 px-2 text-sm font-medium">{zoom}%</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Slider
            value={[zoom]}
            min={50}
            max={200}
            step={5}
            onValueChange={handleZoomChange}
            className="flex-1"
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRotate}
            title="Rotate 90°"
          >
            <RotateCw className="h-4 w-4" />
            <span className="ml-1 text-xs">{rotation}°</span>
          </Button>
        </div>
      </div>
      
      {/* Document Preview */}
      <div 
        ref={containerRef}
        className="border border-gray-200 rounded-lg overflow-auto bg-gray-100 h-[700px] flex items-center justify-center"
        onScroll={handleScroll}
      >
        <div className="h-full w-full flex items-center justify-center">
          {renderPreviewContent()}
        </div>
      </div>
      
      {/* Help text */}
      <div className="mt-2 text-xs text-gray-500">
        <span className="block">Keyboard shortcuts: Ctrl+= (Zoom in), Ctrl+- (Zoom out), Ctrl+R (Rotate)</span>
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
