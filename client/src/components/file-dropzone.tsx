import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { CloudUpload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileWithPreview extends File {
  preview?: string;
}

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

export default function FileDropzone({ onFilesSelected }: FileDropzoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => Object.assign(file, {
      preview: URL.createObjectURL(file)
    }));
    
    setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);
    onFilesSelected([...selectedFiles, ...newFiles]);
  }, [selectedFiles, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
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
  
  const getFileIconClass = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    if (extension === 'pdf') {
      return 'fas fa-file-pdf text-red-500';
    } else if (['jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(extension)) {
      return 'fas fa-file-image text-blue-500';
    }
    
    return 'fas fa-file text-gray-500';
  };

  return (
    <div>
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-blue-50' : 'border-gray-300 hover:border-primary'
        }`}
      >
        <input {...getInputProps()} />
        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <CloudUpload className="text-primary h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold mb-2">Drag & Drop Files Here</h3>
        <p className="text-gray-600 mb-4">or click to browse files from your computer</p>
        <Button>Select Files</Button>
        <p className="text-sm text-gray-500 mt-4">Supported formats: PDF, JPEG, PNG, TIFF (max 10MB)</p>
      </div>

      <div className="mt-6">
        <h3 className="font-medium mb-3">Selected Files</h3>
        
        {selectedFiles.length > 0 ? (
          <div>
            {selectedFiles.map((file, index) => (
              <div key={index} className="bg-gray-50 rounded-md p-3 mb-2 flex items-center justify-between">
                <div className="flex items-center">
                  <i className={`${getFileIconClass(file.name)} mr-3`}></i>
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-gray-500 text-sm">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button 
                  className="text-gray-500 hover:text-red-500"
                  onClick={() => removeFile(file)}
                >
                  <X size={18} />
                </button>
              </div>
            ))}
            
            <div className="mt-6 flex justify-end">
              <Button 
                variant="outline" 
                className="mr-3"
                onClick={clearAllFiles}
              >
                Clear All
              </Button>
              <Button 
                className="flex items-center"
                type="submit"
              >
                <span>Upload & Process</span>
                <i className="fas fa-arrow-right ml-2"></i>
              </Button>
            </div>
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
