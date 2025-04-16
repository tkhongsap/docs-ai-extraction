import { useState } from "react";
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
  const [ocrService, setOcrService] = useState<string>("llamaparse");
  const { toast } = useToast();
  const [, navigate] = useLocation();

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
    <section className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Upload Documents</h1>
        <p className="text-gray-600">Upload documents for OCR processing and data extraction</p>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
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
          <div className="mt-6 border-t pt-4">
            <div className="mb-4">
              <Label htmlFor="ocr-service" className="mb-2 block">OCR Service</Label>
              <Select
                value={ocrService}
                onValueChange={setOcrService}
                disabled={isUploading}
              >
                <SelectTrigger id="ocr-service" className="w-full sm:w-[250px]">
                  <SelectValue placeholder="Select OCR service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mistral">Mistral AI</SelectItem>
                  <SelectItem value="openai">OpenAI Vision</SelectItem>
                  <SelectItem value="llamaparse">LlamaParse</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-2 text-sm text-gray-500">
                {ocrService === 'llamaparse' ? (
                  <>
                    <strong>LlamaParse:</strong> Specialized in extracting structured data from invoices with high accuracy. 
                    Perfect for capturing vendor details, line items, and payment information.
                  </>
                ) : ocrService === 'openai' ? (
                  <>
                    <strong>OpenAI Vision:</strong> Excellent at understanding complex layouts and mixed content.
                    Great for documents with handwritten notes and annotations.
                  </>
                ) : (
                  <>
                    <strong>Mistral AI:</strong> General-purpose OCR with good balance of speed and accuracy.
                    Suitable for standard document formats.
                  </>
                )}
              </p>
            </div>
          </div>
          
          {selectedFiles.length > 0 && (
            <div className="mt-6 flex justify-end">
              <Button 
                type="submit"
                disabled={isUploading || selectedFiles.length === 0}
                className="flex items-center gap-2"
              >
                {isUploading ? 'Uploading...' : 'Upload & Process'}
                {!isUploading && <UploadIcon className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* File Requirements Summary */}
      <Alert className="mb-8">
        <AlertTitle className="text-primary font-medium">File Requirements</AlertTitle>
        <AlertDescription>
          <ul className="text-sm text-gray-700 mt-2 space-y-1">
            <li className="flex items-start gap-2">
              <CheckCircle className="text-primary h-4 w-4 mt-0.5" />
              <span><strong>Supported formats:</strong> PDF, JPEG, PNG, TIFF</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="text-primary h-4 w-4 mt-0.5" />
              <span><strong>Maximum file size:</strong> 10MB per file</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="text-primary h-4 w-4 mt-0.5" />
              <span><strong>Multiple files:</strong> Upload up to 10 files at once</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="text-amber-500 h-4 w-4 mt-0.5" />
              <span>For best OCR results, ensure documents are clearly scanned at 300 DPI or higher</span>
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Upload Tips */}
      <div className="bg-blue-50 rounded-lg p-5">
        <h3 className="font-bold text-primary mb-3">Tips for Best Results with {ocrService === 'llamaparse' ? 'LlamaParse' : ocrService === 'openai' ? 'OpenAI' : 'Mistral'}</h3>
        <ul className="text-gray-700 space-y-2">
          <li className="flex items-start">
            <CheckCircle className="text-primary h-5 w-5 mt-0.5 mr-2" />
            <span>Ensure documents are clearly scanned at 300 DPI or higher</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="text-primary h-5 w-5 mt-0.5 mr-2" />
            <span>Make sure text is clearly visible and not blurred</span>
          </li>
          {ocrService === 'llamaparse' && (
            <>
              <li className="flex items-start">
                <CheckCircle className="text-primary h-5 w-5 mt-0.5 mr-2" />
                <span><strong>Invoice Processing:</strong> Ensure invoice headers, line items, and totals are clearly visible</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="text-primary h-5 w-5 mt-0.5 mr-2" />
                <span>Original digital invoices perform better than scanned copies</span>
              </li>
            </>
          )}
          {ocrService === 'openai' && (
            <li className="flex items-start">
              <CheckCircle className="text-primary h-5 w-5 mt-0.5 mr-2" />
              <span>For handwritten notes, write clearly and avoid overlapping text</span>
            </li>
          )}
          <li className="flex items-start">
            <CheckCircle className="text-primary h-5 w-5 mt-0.5 mr-2" />
            <span>For best results with invoices, ensure all edges and table borders are visible</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
