import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { CloudUpload, Folder, LoaderPinwheel, FileText, Pencil, Table, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Document } from "@shared/schema";
import DocumentCard from "@/components/document-card";
import FeatureCard from "@/components/feature-card";

export default function Dashboard() {
  const [, navigate] = useLocation();
  
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
  });
  
  // Get documents for the recent documents section (max 5)
  const recentDocuments = documents?.slice(0, 5);

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
  const errorCount = documents?.filter(doc => doc.status === 'error').length || 0;
  const completedCount = documents?.filter(doc => doc.status === 'completed').length || 0;
  const totalDocuments = documents?.length || 0;
  
  // Calculate success rate if we have processed documents
  const successRate = totalDocuments > 0 
    ? Math.round((completedCount / totalDocuments) * 100)
    : 0;

  return (
    <section className="container mx-auto px-4 py-6">
      {/* Hero Section */}
      <div className="bg-blue-50 rounded-lg p-8 mb-8">
        <h1 className="text-3xl font-bold mb-3">OCR Document Extraction</h1>
        <p className="text-gray-700 mb-6 text-lg">Quickly extract and review data from invoices, receipts, and more with AI-powered OCR technology.</p>
        <div className="flex flex-wrap gap-3">
          <Button 
            size="lg"
            onClick={navigateToUpload}
            className="bg-primary hover:bg-primary/90"
          >
            <CloudUpload className="mr-2 h-5 w-5" />
            Upload Document
          </Button>
          <Button 
            size="lg"
            variant="outline" 
            onClick={navigateToDocuments}
          >
            <Folder className="mr-2 h-5 w-5" />
            View Documents
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xl mb-1">{totalDocuments}</h3>
              <p className="text-gray-600">Total Documents</p>
            </div>
            <Folder className="h-8 w-8 text-gray-300" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xl mb-1">{completedCount}</h3>
              <p className="text-gray-600">Processed</p>
            </div>
            <FileText className="h-8 w-8 text-green-300" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xl mb-1">{processingCount}</h3>
              <p className="text-gray-600">Processing</p>
            </div>
            <LoaderPinwheel className="h-8 w-8 text-yellow-300" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xl mb-1">{errorCount}</h3>
              <p className="text-gray-600">Errors</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-300" />
          </div>
        </div>
      </div>

      {/* Quick Upload Button */}
      <div className="bg-primary text-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xl mb-1">Upload Document</h3>
            <p className="text-blue-100">Process a new document with our OCR technology</p>
          </div>
          <CloudUpload className="h-10 w-10 text-blue-200" />
        </div>
        <Button 
          className="mt-4 bg-white text-primary hover:bg-blue-50"
          size="lg"
          onClick={navigateToUpload}
        >
          Upload Now
        </Button>
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
