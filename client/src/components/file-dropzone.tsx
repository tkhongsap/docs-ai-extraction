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
      'image/tiff': ['.tiff', '.tif']
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
      return <FileText className="h-5 w-5 text-red-500" />;
    } else if (['jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(extension)) {
      return <FileImage className="h-5 w-5 text-blue-500" />; 
    }
    
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  return (
    <div>
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive && !isDragReject ? 'border-primary bg-blue-50' : ''}
          ${isDragReject ? 'border-red-500 bg-red-50' : ''}
          ${!isDragActive && !isDragReject ? 'border-gray-300 hover:border-primary hover:bg-gray-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <CloudUpload className="text-primary h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold mb-2">
          {isDragActive 
            ? isDragReject 
              ? "File type not accepted" 
              : "Drop files here" 
            : "Drag & Drop Files Here"}
        </h3>
        <p className="text-gray-600 mb-4">or click to browse files from your computer</p>
        <Button type="button">Select Files</Button>
        <p className="text-sm text-gray-500 mt-4">
          Supported formats: PDF, JPEG, PNG, TIFF (max 10MB, up to 10 files)
        </p>
      </div>

      {/* Error Messages */}
      {(fileTypeError || fileSizeError) && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              {fileTypeError && <p>{fileTypeError}</p>}
              {fileSizeError && <p>{fileSizeError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Selected Files List */}
      <div className="mt-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium">Selected Files ({selectedFiles.length}/10)</h3>
          {selectedFiles.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearAllFiles}
              disabled={isUploading}
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
                <div key={index} className="bg-gray-50 rounded-md p-3 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {getFileIcon(file.name)}
                      <div className="ml-3">
                        <p className="font-medium truncate max-w-md">{file.name}</p>
                        <p className="text-gray-500 text-sm">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button 
                      className="text-gray-500 hover:text-red-500 focus:outline-none"
                      onClick={() => removeFile(file)}
                      disabled={isUploading}
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  
                  {/* Progress bar */}
                  {isUploading && (
                    <div className="mt-1">
                      <Progress value={progress} className="h-2" />
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-gray-500">{progress}% uploaded</span>
                        {error && (
                          <span className="text-xs text-red-500">{error}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-md p-5 text-center text-gray-500">
            No files selected
          </div>
        )}
      </div>
    </div>
  );
}
