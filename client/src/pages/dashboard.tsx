import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  CloudUpload, Folder, LoaderPinwheel, FileText, Pencil, 
  Table, AlertCircle, CheckCircle, BarChart, Zap, 
  Brain, ArrowRightCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Document } from "@shared/schema";
import DocumentCard from "@/components/document-card";
import FeatureCard from "@/components/feature-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
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

  // Mutation for document deletion
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const response = await apiRequest('DELETE', `/api/documents/${id}`);
        return response;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Document Deleted",
        description: "The document has been removed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Deletion Failed",
        description: "Failed to delete the document. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleDeleteDocument = (id: number) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      deleteDocumentMutation.mutate(id);
    }
  };

  return (
    <section className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden mb-12 bg-gradient-to-r from-primary/90 to-primary">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.7))]"></div>
        <div className="relative z-10 p-8 md:p-14 flex flex-col md:flex-row items-center">
          <div className="md:w-3/5 mb-8 md:mb-0 md:pr-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Document Intelligence Platform
            </h1>
            <p className="text-blue-100 mb-8 text-lg leading-relaxed">
              Transform any document into structured data using our AI-powered OCR technology. Extract text, tables, and handwritten notes with unprecedented accuracy.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button 
                size="lg"
                onClick={navigateToUpload}
                className="bg-white text-primary hover:bg-blue-50"
              >
                <CloudUpload className="mr-2 h-5 w-5" />
                Upload Document
              </Button>
              <Button 
                size="lg"
                variant="outline" 
                onClick={navigateToDocuments}
                className="border-white text-white hover:bg-white/20"
              >
                <Folder className="mr-2 h-5 w-5" />
                View Documents
              </Button>
            </div>
          </div>
          <div className="md:w-2/5 flex justify-center">
            <div className="relative w-64 h-64 md:w-80 md:h-80">
              <div className="absolute inset-0 bg-white/10 rounded-xl transform rotate-6 scale-95"></div>
              <div className="absolute inset-0 bg-white/20 rounded-xl transform rotate-3 scale-90"></div>
              <div className="absolute inset-0 bg-white rounded-xl shadow-lg flex items-center justify-center">
                <div className="w-3/4 space-y-2">
                  <div className="h-8 w-16 bg-primary/20 rounded-md"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                  <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-12 bg-gray-100 rounded-md my-4"></div>
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 bg-primary/20 rounded-full"></div>
                    <div>
                      <div className="h-2 bg-gray-200 rounded w-24"></div>
                      <div className="h-2 bg-gray-200 rounded w-16 mt-1"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-50 p-3 rounded-full">
              <Folder className="h-6 w-6 text-primary" />
            </div>
            <div className="ml-4">
              <h3 className="font-bold text-2xl">{totalDocuments}</h3>
              <p className="text-gray-500 text-sm">Total Documents</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-50 p-3 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div className="ml-4">
              <h3 className="font-bold text-2xl">{completedCount}</h3>
              <p className="text-gray-500 text-sm">Processed</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-50 p-3 rounded-full">
              <LoaderPinwheel className="h-6 w-6 text-yellow-500" />
            </div>
            <div className="ml-4">
              <h3 className="font-bold text-2xl">{processingCount}</h3>
              <p className="text-gray-500 text-sm">Processing</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-red-50 p-3 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <div className="ml-4">
              <h3 className="font-bold text-2xl">{errorCount}</h3>
              <p className="text-gray-500 text-sm">Errors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Upload Card */}
      <div className="bg-gradient-to-r from-primary to-primary/90 rounded-xl shadow-md overflow-hidden mb-12">
        <div className="relative p-8">
          <div className="absolute top-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-white/10 rounded-full transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between">
            <div className="mb-6 md:mb-0">
              <h3 className="font-bold text-2xl text-white mb-2">Ready to Process Your Document?</h3>
              <p className="text-blue-100 mb-0">
                Our AI technology supports multiple formats including PDFs, images, and scanned documents
              </p>
            </div>
            <div className="flex-shrink-0">
              <Button 
                className="bg-white text-primary hover:bg-blue-50 shadow-md text-base px-6 py-6 h-auto"
                onClick={navigateToUpload}
              >
                <CloudUpload className="mr-2 h-5 w-5" />
                Upload Document
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8">
          <div>
            <h4 className="text-primary font-medium mb-2">POWERFUL CAPABILITIES</h4>
            <h2 className="text-2xl md:text-3xl font-bold">Key Features</h2>
          </div>
          <p className="text-gray-500 mt-2 md:mt-0 md:w-1/2">
            Our platform combines multiple AI technologies to deliver comprehensive document processing capabilities.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            title="Smart Text Extraction"
            description="Extract text with context-aware AI that understands document structure and meaning"
            icon={<FileText className="h-5 w-5" />}
            iconClassName="bg-blue-100 text-primary"
          />
          
          <FeatureCard
            title="Handwriting Recognition"
            description="Industry-leading recognition of handwritten notes using advanced neural networks"
            icon={<Pencil className="h-5 w-5" />}
            iconClassName="bg-teal-100 text-[#38b2ac]"
          />
          
          <FeatureCard
            title="Intelligent Data Structuring"
            description="Transform unstructured data into JSON, CSV, or database-ready formats automatically"
            icon={<Table className="h-5 w-5" />}
            iconClassName="bg-purple-100 text-[#805ad5]"
          />

          <FeatureCard
            title="Multi-Model AI Processing"
            description="Leverages multiple AI models for enhanced accuracy and context understanding"
            icon={<Brain className="h-5 w-5" />}
            iconClassName="bg-green-100 text-green-600"
          />
          
          <FeatureCard
            title="Real-time Analytics"
            description="View extraction confidence scores and processing metrics in real-time dashboards"
            icon={<BarChart className="h-5 w-5" />}
            iconClassName="bg-amber-100 text-amber-600"
          />
          
          <FeatureCard
            title="High-Speed Processing"
            description="Process documents in seconds with our optimized parallel processing architecture"
            icon={<Zap className="h-5 w-5" />}
            iconClassName="bg-red-100 text-red-600"
          />
        </div>
      </div>

      {/* Recent Documents */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-primary font-medium mb-1">DOCUMENTS</h4>
            <h2 className="text-2xl font-bold">Recent Uploads</h2>
          </div>
          <Link href="/documents" className="text-primary font-medium hover:text-primary/80 transition-colors flex items-center">
            View all
            <ArrowRightCircle className="ml-1 h-4 w-4" />
          </Link>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-t-primary border-r-transparent border-b-primary border-l-transparent"></div>
          </div>
        ) : recentDocuments && recentDocuments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentDocuments.map(document => (
              <DocumentCard key={document.id} document={document} onDelete={handleDeleteDocument} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="text-primary h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold mb-3">No documents yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Upload your first document to start extracting valuable data with our AI-powered processing
            </p>
            <Button onClick={navigateToUpload} size="lg" className="px-6">
              <CloudUpload className="mr-2 h-5 w-5" />
              Upload Your First Document
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
