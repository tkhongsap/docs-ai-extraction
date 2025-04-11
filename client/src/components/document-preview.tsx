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
  
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };
  
  const handleRotate = () => {
    setRotation((rotation + 90) % 360);
  };
  
  const handleResetView = () => {
    setZoom(100);
    setRotation(0);
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
  
  // Determine preview content based on file type
  const renderPreviewContent = () => {
    const fileUrl = `/api/documents/${document.id}/file`;
    
    if (document.fileType.includes("pdf")) {
      return (
        <iframe 
          src={`${fileUrl}#zoom=${zoom/100}`} 
          className="w-full h-full border-0"
          style={{ transform: `rotate(${rotation}deg)` }}
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
    <div className={`bg-white rounded-lg shadow-sm p-4 flex flex-col ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold">Original Document</h2>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            title={fullscreen ? "Exit full screen" : "Full screen"}
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
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
        className="border border-gray-200 rounded-lg overflow-auto bg-gray-100 h-[500px] flex items-center justify-center"
        onScroll={handleScroll}
      >
        <div className="min-h-full min-w-full flex items-center justify-center p-4">
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
