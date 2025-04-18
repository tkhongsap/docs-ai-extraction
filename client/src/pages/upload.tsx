import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle, UploadCloud as UploadIcon, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FileDropzone from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function Upload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [ocrService, setOcrService] = useState<string>("openai"); // Default to OpenAI
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  
  // For animations
  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);

    // Reset progress and errors when files are selected
    setUploadProgress({});
    setUploadErrors({});
  };

  const trackUploadProgress = (file: File, progress: number) => {
    setUploadProgress(prev => ({
      ...prev,
      [file.name]: progress
    }));
  };

  const setFileError = (file: File, error: string) => {
    setUploadErrors(prev => ({
      ...prev,
      [file.name]: error
    }));
  };

  const uploadFile = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("ocrService", ocrService);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          trackUploadProgress(file, percentComplete);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          const errorMessage = `Upload failed: ${xhr.status} - ${xhr.statusText}`;
          setFileError(file, errorMessage);
          reject(new Error(errorMessage));
        }
      });

      xhr.addEventListener("error", () => {
        const errorMessage = "Network error occurred during upload";
        setFileError(file, errorMessage);
        reject(new Error(errorMessage));
      });

      xhr.addEventListener("timeout", () => {
        const errorMessage = "Upload timed out";
        setFileError(file, errorMessage);
        reject(new Error(errorMessage));
      });

      xhr.open("POST", "/api/documents", true);
      xhr.send(formData);
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress({});
    setUploadErrors({});

    try {
      const uploadPromises = selectedFiles.map(file => uploadFile(file));
      const results = await Promise.allSettled(uploadPromises);

      const successCount = results.filter(result => result.status === "fulfilled").length;
      const failCount = results.filter(result => result.status === "rejected").length;

      if (successCount > 0) {
        toast({
          title: "Upload successful",
          description: `Successfully uploaded ${successCount} document${successCount > 1 ? 's' : ''}${failCount ? `, ${failCount} failed` : ''}.`,
          variant: "default",
        });

        // If all files were uploaded successfully, navigate to processing page
        if (failCount === 0) {
          navigate("/processing");
        }
      } else {
        toast({
          title: "Upload failed",
          description: "Failed to upload documents. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error during upload:", error);
      toast({
        title: "Upload failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header with gradient background */}
      <div className={`relative rounded-xl overflow-hidden mb-8 bg-gradient-to-r from-indigo-600 to-blue-600 shadow-lg transform transition-all duration-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.7))]"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-300/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 p-8">
          <div className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-sm font-medium mb-4 backdrop-blur-sm">
            Document Processing
          </div>
          <h1 className="text-3xl font-bold mb-2 text-white">Upload Documents</h1>
          <p className="text-white/90 mb-1 max-w-2xl">
            Upload documents for OCR processing and data extraction. Our AI will automatically detect and extract text, tables, and handwritten content.
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <div className={`bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-100 transform transition-all duration-700 delay-100 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <form onSubmit={(e) => {
          e.preventDefault();
          handleUpload();
        }}>
          <FileDropzone 
            onFilesSelected={handleFilesSelected} 
            uploadProgress={uploadProgress}
            uploadErrors={uploadErrors}
            isUploading={isUploading}
          />

          {/* OCR Service Selection */}
          <div className="mt-8 border-t border-gray-100 pt-6">
            <div className="mb-4">
              <div className="flex items-center mb-3">
                <div className="h-1 w-5 bg-indigo-600 rounded-full mr-2"></div>
                <Label htmlFor="ocr-service" className="font-medium text-gray-800">OCR Service</Label>
              </div>
              <Select
                value={ocrService}
                onValueChange={setOcrService}
                disabled={isUploading}
              >
                <SelectTrigger id="ocr-service" className="w-full sm:w-[300px] border-gray-200 focus:ring-indigo-500 focus:border-indigo-500">
                  <SelectValue placeholder="Select OCR service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI OCR</SelectItem>
                  <SelectItem value="mistral">MistralAI OCR</SelectItem>
                  <SelectItem value="ms-document-intelligence">MS Document Intelligence</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                {ocrService === 'openai' ? (
                    <>
                      <h4 className="font-medium text-indigo-700 mb-1">OpenAI OCR</h4>
                      <p className="text-gray-600">
                        Advanced OCR with excellent accuracy for complex layouts and mixed content.
                        Great for documents with handwritten notes and annotations.
                      </p>
                    </>
                  ) : ocrService === 'mistral' ? (
                    <>
                      <h4 className="font-medium text-indigo-700 mb-1">MistralAI OCR</h4>
                      <p className="text-gray-600">
                        General-purpose OCR with good balance of speed and accuracy.
                        Suitable for standard document formats and multilingual content.
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="font-medium text-indigo-700 mb-1">MS Document Intelligence</h4>
                      <p className="text-gray-600">
                        Enterprise-grade document processing with high accuracy.
                        Excellent for forms, tables, and structured documents.
                      </p>
                    </>
                  )}
              </div>
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-6 flex justify-end">
              <Button 
                type="submit"
                disabled={isUploading || selectedFiles.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 py-6 px-8 h-auto rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-base"
              >
                {isUploading ? 'Uploading...' : 'Upload & Process'}
                {!isUploading && <UploadIcon className="h-5 w-5" />}
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* File Requirements and Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* File Requirements */}
        <div className={`bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden transform transition-all duration-700 delay-200 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4">
            <h3 className="font-semibold text-lg text-indigo-700">File Requirements</h3>
          </div>
          <div className="p-6">
            <ul className="text-gray-700 space-y-3">
              <li className="flex items-start gap-3">
                <div className="bg-indigo-100 p-1.5 rounded-full text-indigo-600 flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span><strong>Supported formats:</strong> PDF, JPEG, PNG, TIFF, GIF, WEBP</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-indigo-100 p-1.5 rounded-full text-indigo-600 flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span><strong>Maximum file size:</strong> 10MB per file</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-indigo-100 p-1.5 rounded-full text-indigo-600 flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span><strong>Multiple files:</strong> Upload up to 10 files at once</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-amber-100 p-1.5 rounded-full text-amber-600 flex-shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <span>For best OCR results, ensure documents are clearly scanned at 300 DPI or higher</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Upload Tips */}
        <div className={`bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg overflow-hidden relative transform transition-all duration-700 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.7))]"></div>
          <div className="p-6 relative z-10">
            <h3 className="font-bold text-white mb-4 text-lg">Tips for Best Results with {ocrService === 'openai' ? 'OpenAI OCR' : ocrService === 'mistral' ? 'MistralAI OCR' : 'MS Document Intelligence'}</h3>
            <ul className="text-white/90 space-y-3">
              <li className="flex items-start gap-3">
                <div className="bg-white/20 p-1.5 rounded-full text-white flex-shrink-0 mt-0.5 backdrop-blur-sm">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span>Ensure documents are clearly scanned at 300 DPI or higher</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-white/20 p-1.5 rounded-full text-white flex-shrink-0 mt-0.5 backdrop-blur-sm">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span>For handwritten notes, use clean backgrounds and avoid overlapping text</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-white/20 p-1.5 rounded-full text-white flex-shrink-0 mt-0.5 backdrop-blur-sm">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span>For tables, prefer uncompressed images with high contrast</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-white/20 p-1.5 rounded-full text-white flex-shrink-0 mt-0.5 backdrop-blur-sm">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span>Process similar document types together for more consistent results</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-white/20 p-1.5 rounded-full text-white flex-shrink-0 mt-0.5 backdrop-blur-sm">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span>Use our review tools to verify extracted data after processing</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}