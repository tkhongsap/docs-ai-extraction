import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { CloudUpload, X, AlertCircle, FileText, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface FileWithPreview extends File {
  preview?: string;
  progress?: number;
  error?: string;
  status?: 'idle' | 'uploading' | 'success' | 'error';
}

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  uploadProgress?: Record<string, number>;
  uploadErrors?: Record<string, string>;
  isUploading?: boolean;
}

export default function FileDropzone({ 
  onFilesSelected, 
  uploadProgress = {}, 
  uploadErrors = {},
  isUploading = false
}: FileDropzoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [fileTypeError, setFileTypeError] = useState<string | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Clear previous errors
    setFileTypeError(null);
    setFileSizeError(null);
    
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach(rejected => {
        if (rejected.errors[0].code === 'file-too-large') {
          setFileSizeError(`File "${rejected.file.name}" exceeds the 10MB size limit`);
        } else if (rejected.errors[0].code === 'file-invalid-type') {
          setFileTypeError(`File "${rejected.file.name}" is not a supported file type`);
        }
      });
    }
    
    // If we're already at max files, don't add more
    if (selectedFiles.length + acceptedFiles.length > 10) {
      setFileTypeError("Maximum of 10 files allowed");
      const availableSlots = Math.max(0, 10 - selectedFiles.length);
      acceptedFiles = acceptedFiles.slice(0, availableSlots);
    }
    
    const newFiles = acceptedFiles.map(file => Object.assign(file, {
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'idle' as const
    }));
    
    setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);
    onFilesSelected([...selectedFiles, ...acceptedFiles]);
  }, [selectedFiles, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tiff', '.tif'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10
  });

  const removeFile = (fileToRemove: FileWithPreview) => {
    const updatedFiles = selectedFiles.filter(file => file !== fileToRemove);
    setSelectedFiles(updatedFiles);
    onFilesSelected(updatedFiles);
    
    // Clean up preview URL
    if (fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  };

  const clearAllFiles = () => {
    // Clean up all preview URLs
    selectedFiles.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    
    setSelectedFiles([]);
    onFilesSelected([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    if (extension === 'pdf') {
      return <FileText className="h-6 w-6 text-red-500" />;
    } else if (['jpg', 'jpeg', 'png', 'tiff', 'tif', 'gif', 'webp'].includes(extension)) {
      return <FileImage className="h-6 w-6 text-blue-500" />; 
    }
    
    return <FileText className="h-6 w-6 text-gray-500" />;
  };

  return (
    <div>
      <div 
        {...getRootProps()} 
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 group overflow-hidden
          ${isDragActive && !isDragReject ? 'border-indigo-500 bg-indigo-50/50' : ''}
          ${isDragReject ? 'border-red-500 bg-red-50/50' : ''}
          ${!isDragActive && !isDragReject ? 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30' : ''}
        `}
      >
        {/* Background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-r from-indigo-100/20 to-blue-100/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isDragActive ? 'opacity-100' : ''}`}></div>
        
        <input {...getInputProps()} />
        <div className="relative z-10">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500 shadow-md">
            <CloudUpload className="text-indigo-600 h-10 w-10 group-hover:rotate-[-8deg] transition-transform duration-500" />
          </div>
          <h3 className="text-xl font-bold mb-3 text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">
            {isDragActive 
              ? isDragReject 
                ? "File type not accepted" 
                : "Drop files here" 
              : "Drag & Drop Files Here"}
          </h3>
          <p className="text-gray-600 mb-5 max-w-md mx-auto">or click to browse files from your computer</p>
          <Button 
            type="button"
            className="bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-200 px-5 shadow-md hover:shadow-lg"
          >
            Select Files
          </Button>
          <p className="text-sm text-gray-500 mt-5">
            Supported formats: PDF*, JPEG, PNG, GIF, WEBP, TIFF (max 10MB, up to 10 files)
          </p>
          <p className="text-xs text-amber-600 mt-1">
            *PDF files have limited OCR capabilities. For best results, use image formats.
          </p>
        </div>
      </div>

      {/* Error Messages */}
      {(fileTypeError || fileSizeError) && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 shadow-sm">
          <div className="flex items-start">
            <div className="bg-red-100 p-1 rounded-full text-red-500 flex-shrink-0 mt-0.5 mr-3">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              {fileTypeError && <p className="font-medium mb-1">{fileTypeError}</p>}
              {fileSizeError && <p className="font-medium">{fileSizeError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Selected Files List */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className="h-1 w-5 bg-indigo-600 rounded-full mr-2"></div>
            <h3 className="font-medium text-gray-800">Selected Files ({selectedFiles.length}/10)</h3>
          </div>
          {selectedFiles.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearAllFiles}
              disabled={isUploading}
              className="border-gray-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              Clear All
            </Button>
          )}
        </div>
        
        {selectedFiles.length > 0 ? (
          <div className="space-y-3">
            {selectedFiles.map((file, index) => {
              // Get the progress for this file if it's uploading
              const progress = uploadProgress[file.name] || 0;
              const error = uploadErrors[file.name];
              
              return (
                <div 
                  key={index} 
                  className="bg-gray-50 rounded-lg p-4 border border-gray-100 hover:border-indigo-100 hover:shadow-sm transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="bg-gradient-to-br from-gray-100 to-white p-2 rounded-lg shadow-sm group-hover:scale-105 transition-transform duration-300">
                        {getFileIcon(file.name)}
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-800 truncate max-w-md group-hover:text-indigo-600 transition-colors duration-300">{file.name}</p>
                        <p className="text-gray-500 text-sm">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button 
                      className="text-gray-400 hover:text-red-500 focus:outline-none p-1.5 rounded-full hover:bg-red-50 transition-colors duration-200"
                      onClick={() => removeFile(file)}
                      disabled={isUploading}
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  {/* Progress bar */}
                  {isUploading && (
                    <div className="mt-2">
                      <Progress value={progress} className="h-1.5 bg-gray-200" indicatorClassName="bg-indigo-600" />
                      <div className="flex justify-between mt-1.5">
                        <span className="text-xs text-gray-500">{progress}% uploaded</span>
                        {error && (
                          <span className="text-xs text-red-500 font-medium">{error}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500 border border-gray-100">
            No files selected
          </div>
        )}
      </div>
    </div>
  );
}
