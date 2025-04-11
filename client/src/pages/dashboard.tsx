import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { CloudUpload, Folder, LoaderPinwheel, FileText, Pencil, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Document } from "@shared/schema";
import DocumentCard from "@/components/document-card";
import FeatureCard from "@/components/feature-card";

export default function Dashboard() {
  const [, navigate] = useLocation();
  
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
  });
  
  // Get documents for the recent documents section (max 3)
  const recentDocuments = documents?.slice(0, 3);

  const navigateToUpload = () => {
    navigate('/upload');
  };

  const navigateToDocuments = () => {
    navigate('/documents');
  };

  const navigateToProcessing = () => {
    navigate('/processing');
  };

  // Count documents by status
  const processingCount = documents?.filter(doc => doc.status === 'processing').length || 0;
  const totalDocuments = documents?.length || 0;

  return (
    <section className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-600">Extract and process your document data with AI-powered OCR</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-primary text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xl mb-1">Upload Document</h3>
              <p className="text-blue-100">Process a new document</p>
            </div>
            <CloudUpload className="h-8 w-8 text-blue-200" />
          </div>
          <Button 
            className="mt-4 bg-white text-primary hover:bg-blue-50"
            onClick={navigateToUpload}
          >
            Upload Now
          </Button>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xl mb-1">{totalDocuments} Documents</h3>
              <p className="text-gray-600">In your library</p>
            </div>
            <Folder className="h-8 w-8 text-gray-300" />
          </div>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={navigateToDocuments}
          >
            View All
          </Button>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xl mb-1">{processingCount} Processing</h3>
              <p className="text-gray-600">Documents in progress</p>
            </div>
            <LoaderPinwheel className="h-8 w-8 text-gray-300" />
          </div>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={navigateToProcessing}
          >
            Check Status
          </Button>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            title="Text Extraction"
            description="Accurately extract text from scanned documents and convert to editable format"
            icon={<FileText className="h-5 w-5" />}
            iconClassName="bg-blue-100 text-primary"
          />
          
          <FeatureCard
            title="Handwriting Recognition"
            description="Process handwritten notes with advanced AI recognition technology"
            icon={<Pencil className="h-5 w-5" />}
            iconClassName="bg-teal-100 text-[#38b2ac]"
          />
          
          <FeatureCard
            title="Data Structuring"
            description="Convert unstructured document data into organized, usable formats"
            icon={<Table className="h-5 w-5" />}
            iconClassName="bg-purple-100 text-[#805ad5]"
          />
        </div>
      </div>

      {/* Recent Documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Documents</h2>
          <Link href="/documents" className="text-primary text-sm font-medium hover:underline">View all</Link>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : recentDocuments && recentDocuments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentDocuments.map(document => (
              <DocumentCard key={document.id} document={document} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-8 text-center">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-primary h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">No documents yet</h3>
            <p className="text-gray-600 mb-4">Upload your first document to get started</p>
            <Button onClick={navigateToUpload}>
              Upload Document
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
