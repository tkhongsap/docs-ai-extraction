import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FileDropzone from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";

export default function Upload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
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

    try {
      const uploadPromises = selectedFiles.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);

        try {
          const response = await fetch("/api/documents", {
            method: "POST",
            body: formData,
            credentials: "include",
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status} - ${response.statusText}`);
          }

          return await response.json();
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          throw error;
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      
      const successCount = results.filter(result => result.status === "fulfilled").length;
      const failCount = results.filter(result => result.status === "rejected").length;
      
      if (successCount > 0) {
        toast({
          title: "Upload successful",
          description: `Successfully uploaded ${successCount} document${successCount > 1 ? 's' : ''}${failCount ? `, ${failCount} failed` : ''}.`,
          variant: "default",
        });
        
        // Navigate to processing page
        navigate("/processing");
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
          <FileDropzone onFilesSelected={handleFilesSelected} />
        </form>
      </div>

      {/* Upload Tips */}
      <div className="bg-blue-50 rounded-lg p-5">
        <h3 className="font-bold text-primary mb-3">Tips for Best Results</h3>
        <ul className="text-gray-700 space-y-2">
          <li className="flex items-start">
            <CheckCircle className="text-primary h-5 w-5 mt-0.5 mr-2" />
            <span>Ensure documents are clearly scanned at 300 DPI or higher</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="text-primary h-5 w-5 mt-0.5 mr-2" />
            <span>Make sure text is clearly visible and not blurred</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="text-primary h-5 w-5 mt-0.5 mr-2" />
            <span>For handwritten notes, write clearly and avoid overlapping text</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="text-primary h-5 w-5 mt-0.5 mr-2" />
            <span>For best results with invoices, ensure all edges are visible</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
