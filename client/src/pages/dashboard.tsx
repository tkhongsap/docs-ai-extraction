import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  CloudUpload, Folder, LoaderPinwheel, FileText, Pencil, 
  Table, AlertCircle, CheckCircle, BarChart, Zap, 
  Brain, ArrowRightCircle, Activity, Database, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Document } from "@shared/schema";
import DocumentCard from "@/components/document-card";
import FeatureCard from "@/components/feature-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  
  // For staggered animations
  useEffect(() => {
    setIsVisible(true);
  }, []);
  
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
    <section className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Hero Section - Gradient background with mesh */}
      <div className={`relative rounded-2xl overflow-hidden mb-12 bg-gradient-to-br from-blue-600 to-indigo-800 transform transition-all duration-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.7))]"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-300/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 p-10 md:p-16 flex flex-col md:flex-row items-center">
          <div className="md:w-3/5 mb-8 md:mb-0 md:pr-10">
            <div className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-sm font-medium mb-4 backdrop-blur-sm">
              AI-Powered Document Processing
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-6 text-white leading-tight">
              Document Intelligence Platform
            </h1>
            <p className="text-white/90 mb-8 text-lg leading-relaxed max-w-2xl">
              Transform any document into structured data using our AI-powered OCR technology. Extract text, tables, and handwritten notes with unprecedented accuracy.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button 
                size="lg"
                onClick={navigateToUpload}
                className="bg-white text-indigo-700 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
              >
                <CloudUpload className="mr-2 h-5 w-5" />
                Upload Document
              </Button>
              <Button 
                size="lg"
                variant="outline" 
                onClick={navigateToDocuments}
                className="border-white text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <Folder className="mr-2 h-5 w-5" />
                View Documents
              </Button>
            </div>
          </div>
          <div className="md:w-2/5 flex justify-center">
            <div className="relative w-64 h-64 md:w-96 md:h-96 transform transition-all duration-500 hover:scale-105">
              <div className="absolute inset-0 bg-white/10 rounded-xl transform rotate-6 scale-95 backdrop-blur-sm"></div>
              <div className="absolute inset-0 bg-white/20 rounded-xl transform rotate-3 scale-90 backdrop-blur-sm"></div>
              <div className="absolute inset-0 bg-white/90 rounded-xl shadow-2xl flex items-center justify-center backdrop-blur-md">
                <div className="w-3/4 space-y-3">
                  <div className="h-10 w-20 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-md"></div>
                  <div className="h-2 bg-gray-200 rounded-full"></div>
                  <div className="h-2 bg-gray-200 rounded-full"></div>
                  <div className="h-2 bg-gray-200 rounded-full w-3/4"></div>
                  <div className="h-14 bg-gray-100 rounded-md my-4 border border-gray-200"></div>
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="h-2 bg-gray-200 rounded-full w-24"></div>
                      <div className="h-2 bg-gray-200 rounded-full w-16 mt-1"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Statistics - Glass Morphism Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 transform transition-all duration-700 delay-100 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-200 hover:border-blue-100 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center relative z-10">
            <div className="flex-shrink-0 bg-gradient-to-br from-blue-100 to-blue-50 p-4 rounded-xl group-hover:scale-110 transition-transform duration-200">
              <Folder className="h-7 w-7 text-blue-600" />
            </div>
            <div className="ml-5">
              <div className="font-bold text-3xl text-gray-800 mb-1 flex items-end">
                {totalDocuments}
                <span className="text-sm text-blue-500 ml-2 font-medium">Total</span>
              </div>
              <p className="text-gray-500 text-sm font-medium">Documents</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-200 hover:border-green-100 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center relative z-10">
            <div className="flex-shrink-0 bg-gradient-to-br from-green-100 to-green-50 p-4 rounded-xl group-hover:scale-110 transition-transform duration-200">
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
            <div className="ml-5">
              <div className="font-bold text-3xl text-gray-800 mb-1 flex items-end">
                {completedCount}
                <span className="text-sm text-green-500 ml-2 font-medium">{successRate}%</span>
              </div>
              <p className="text-gray-500 text-sm font-medium">Processed</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-200 hover:border-amber-100 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center relative z-10">
            <div className="flex-shrink-0 bg-gradient-to-br from-amber-100 to-amber-50 p-4 rounded-xl group-hover:scale-110 transition-transform duration-200">
              <LoaderPinwheel className="h-7 w-7 text-amber-600 animate-spin animate-[2s_linear_infinite]" />
            </div>
            <div className="ml-5">
              <div className="font-bold text-3xl text-gray-800 mb-1 flex items-end">
                {processingCount}
                <span className="text-sm text-amber-500 ml-2 font-medium">Active</span>
              </div>
              <p className="text-gray-500 text-sm font-medium">Processing</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-200 hover:border-red-100 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center relative z-10">
            <div className="flex-shrink-0 bg-gradient-to-br from-red-100 to-red-50 p-4 rounded-xl group-hover:scale-110 transition-transform duration-200">
              <AlertCircle className="h-7 w-7 text-red-600" />
            </div>
            <div className="ml-5">
              <div className="font-bold text-3xl text-gray-800 mb-1 flex items-end">
                {errorCount}
                <span className="text-sm text-red-500 ml-2 font-medium">Failed</span>
              </div>
              <p className="text-gray-500 text-sm font-medium">Errors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Upload Card - Modern glass card with gradient */}
      <div className={`bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl shadow-xl overflow-hidden mb-12 group transform transition-all duration-700 delay-200 hover:scale-[1.01] ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="relative p-8 md:p-10">
          <div className="absolute top-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-white/10 rounded-full transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 md:w-44 md:h-44 bg-indigo-500/20 rounded-full transform -translate-x-1/3 translate-y-1/3"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between">
            <div className="mb-6 md:mb-0 md:max-w-2xl">
              <h3 className="font-bold text-2xl md:text-3xl text-white mb-3 leading-tight">Ready to Process Your Document?</h3>
              <p className="text-white/90 mb-0 text-lg leading-relaxed">
                Our AI technology supports multiple formats including PDFs, images, and scanned documents with unmatched accuracy
              </p>
            </div>
            <div className="flex-shrink-0">
              <Button 
                className="bg-white text-indigo-700 hover:bg-blue-50 shadow-xl hover:shadow-2xl text-base px-8 py-6 h-auto rounded-xl group-hover:scale-105 transition-all duration-200"
                onClick={navigateToUpload}
              >
                <CloudUpload className="mr-2 h-5 w-5" />
                Upload Document
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Documents Section - Animated appearance */}
      {recentDocuments && recentDocuments.length > 0 && (
        <div className={`mb-12 transform transition-all duration-700 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8">
            <div>
              <div className="flex items-center mb-2">
                <div className="h-1 w-6 bg-indigo-600 rounded-full mr-2"></div>
                <span className="text-indigo-600 font-medium">RECENT ACTIVITY</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Your Documents</h2>
            </div>
            <Button 
              variant="outline"
              onClick={navigateToDocuments}
              className="mt-4 md:mt-0 text-gray-700 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
            >
              View All Documents
              <ArrowRightCircle className="ml-2 h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentDocuments.map((doc, index) => (
              <div key={doc.id} 
                className={`transform transition-all duration-500 hover:scale-[1.02] ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} 
                style={{ transitionDelay: `${300 + index * 100}ms` }}
              >
                <DocumentCard document={doc} onDelete={handleDeleteDocument} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Highlights - Modern cards with hover effects */}
      <div className={`mb-12 transform transition-all duration-700 delay-400 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8">
          <div>
            <div className="flex items-center mb-2">
              <div className="h-1 w-6 bg-indigo-600 rounded-full mr-2"></div>
              <span className="text-indigo-600 font-medium">POWERFUL CAPABILITIES</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Key Features</h2>
          </div>
          <p className="text-gray-600 mt-2 md:mt-0 md:w-1/2 leading-relaxed">
            Our platform combines multiple AI technologies to deliver comprehensive document processing capabilities.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            title="Smart Text Extraction"
            description="Extract text with context-aware AI that understands document structure and meaning"
            icon={<FileText className="h-6 w-6" />}
            iconClassName="bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600"
          />
          
          <FeatureCard
            title="Handwriting Recognition"
            description="Industry-leading recognition of handwritten notes using advanced neural networks"
            icon={<Pencil className="h-6 w-6" />}
            iconClassName="bg-gradient-to-br from-teal-100 to-teal-50 text-teal-600"
          />
          
          <FeatureCard
            title="Intelligent Data Structuring"
            description="Transform unstructured data into JSON, CSV, or database-ready formats automatically"
            icon={<Table className="h-6 w-6" />}
            iconClassName="bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600"
          />

          <FeatureCard
            title="Multi-Model AI Processing"
            description="Leverages multiple AI models for enhanced accuracy and context understanding"
            icon={<Brain className="h-6 w-6" />}
            iconClassName="bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600"
          />
          
          <FeatureCard
            title="Advanced Analytics"
            description="Gain insights from your documents with built-in analytics and visualization tools"
            icon={<Activity className="h-6 w-6" />}
            iconClassName="bg-gradient-to-br from-rose-100 to-rose-50 text-rose-600"
          />
          
          <FeatureCard
            title="Secure Data Storage"
            description="Enterprise-grade security for all your sensitive document information and extracted data"
            icon={<Database className="h-6 w-6" />}
            iconClassName="bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600"
          />
        </div>
      </div>

      {/* Performance Metrics Section */}
      <div className={`bg-white rounded-xl shadow-lg p-8 border border-gray-100 mb-12 transform transition-all duration-700 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <div className="flex items-center mb-2">
              <div className="h-1 w-6 bg-indigo-600 rounded-full mr-2"></div>
              <span className="text-indigo-600 font-medium">PERFORMANCE</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Processing Statistics</h2>
          </div>
          <div className="mt-4 md:mt-0">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700">
              <TrendingUp className="h-4 w-4 mr-1.5" />
              <span className="text-sm font-medium">{successRate}% Success Rate</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-white border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="text-gray-500 text-sm font-medium">Documents Processed</div>
              <div className="text-green-500">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-800">{completedCount}</div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full" 
                style={{ width: `${(completedCount / (totalDocuments || 1)) * 100}%` }}
              ></div>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-white border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="text-gray-500 text-sm font-medium">Avg. Processing Time</div>
              <div className="text-amber-500">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-800">1.2 min</div>
            <div className="text-gray-500 text-xs mt-1">Per document on average</div>
          </div>
          
          <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-white border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="text-gray-500 text-sm font-medium">AI Confidence</div>
              <div className="text-green-500">
                <CheckCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-800">98.7%</div>
            <div className="text-gray-500 text-xs mt-1">Average extraction accuracy</div>
          </div>
          
          <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-white border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="text-gray-500 text-sm font-medium">Data Extracted</div>
              <div className="text-blue-500">
                <Database className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-800">2.4 GB</div>
            <div className="text-gray-500 text-xs mt-1">Total structured data</div>
          </div>
        </div>
      </div>
      
      {/* Footer CTA */}
      <div className={`bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-700 rounded-xl shadow-xl p-8 text-center transform transition-all duration-700 delay-600 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Start Processing Your Documents Today</h2>
        <p className="text-white/90 mb-6 max-w-2xl mx-auto text-lg">
          Experience the power of AI-driven document intelligence and transform how your organization handles information
        </p>
        <Button 
          size="lg"
          onClick={navigateToUpload}
          className="bg-white text-indigo-700 hover:bg-blue-50 shadow-xl hover:shadow-2xl text-base px-8 py-6 h-auto rounded-xl transition-all duration-200 font-medium"
        >
          <CloudUpload className="mr-2 h-5 w-5" />
          Start Processing
        </Button>
      </div>
    </section>
  );
}
