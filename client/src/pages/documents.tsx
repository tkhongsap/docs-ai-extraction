import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  SortAsc, 
  SortDesc, 
  FileText, 
  Calendar, 
  AlertTriangle, 
  RefreshCw, 
  Check, 
  Clock, 
  Upload, 
  PlusCircle, 
  X 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Document } from "@shared/schema";
import DocumentCard from "@/components/document-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // "all", "7days", "30days", "90days"
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("date"); // "name", "date", "status"
  const [sortOrder, setSortOrder] = useState("desc"); // "asc", "desc"
  const [viewMode, setViewMode] = useState("grid"); // "grid", "list"
  const [isVisible, setIsVisible] = useState(false);
  const itemsPerPage = 10;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // For animations
  useEffect(() => {
    setIsVisible(true);
  }, []);
  
  // Fetch documents with caching
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Mutation for document deletion
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log(`Attempting to delete document with ID: ${id}`);
      try {
        const response = await apiRequest('DELETE', `/api/documents/${id}`);
        console.log(`Delete request completed with status: ${response.status}`);
        return response;
      } catch (error) {
        console.error(`Error in delete mutation function:`, error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('Delete mutation succeeded, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Document Deleted",
        description: "The document has been removed successfully.",
      });
    },
    onError: (error) => {
      console.error("Error deleting document:", error);
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

  // Toggle sort order or change sort field
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc"); // Default to descending when changing fields
    }
  };

  // Apply filters, search, and sorting
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = documents?.filter(doc => {
      // Apply search filter
      if (searchQuery && !doc.originalFilename.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Apply type filter
      if (typeFilter && typeFilter !== "all") {
        const fileName = doc.originalFilename.toLowerCase();
        if (typeFilter === "invoice" && !fileName.includes("invoice")) return false;
        if (typeFilter === "receipt" && !fileName.includes("receipt")) return false;
        if (typeFilter === "note" && !fileName.includes("note")) return false;
      }
      
      // Apply status filter
      if (statusFilter && doc.status !== statusFilter) {
        return false;
      }
      
      // Apply date filter
      if (dateFilter !== "all") {
        const docDate = new Date(doc.uploadDate);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dateFilter === "7days" && daysDiff > 7) return false;
        if (dateFilter === "30days" && daysDiff > 30) return false;
        if (dateFilter === "90days" && daysDiff > 90) return false;
      }
      
      return true;
    }) || [];
    
    // Apply sorting
    return [...filtered].sort((a, b) => {
      if (sortBy === "name") {
        return sortOrder === "asc" 
          ? a.originalFilename.localeCompare(b.originalFilename)
          : b.originalFilename.localeCompare(a.originalFilename);
      } else if (sortBy === "date") {
        return sortOrder === "asc" 
          ? new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
          : new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
      } else if (sortBy === "status") {
        const statusOrder = { completed: 3, processing: 2, uploaded: 1, error: 0 };
        const statusA = statusOrder[a.status as keyof typeof statusOrder] || 0;
        const statusB = statusOrder[b.status as keyof typeof statusOrder] || 0;
        return sortOrder === "asc" ? statusA - statusB : statusB - statusA;
      }
      return 0;
    });
  }, [documents, searchQuery, typeFilter, statusFilter, dateFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedDocuments.length / itemsPerPage);
  const paginatedDocuments = filteredAndSortedDocuments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when filters change
  const resetPage = () => {
    setCurrentPage(1);
  };

  // Count documents by status
  const documentCounts = useMemo(() => {
    const counts = {
      all: documents?.length || 0,
      uploaded: 0,
      processing: 0,
      completed: 0,
      error: 0
    };
    
    documents?.forEach(doc => {
      if (counts[doc.status as keyof typeof counts] !== undefined) {
        counts[doc.status as keyof typeof counts]++;
      }
    });
    
    return counts;
  }, [documents]);

  return (
    <section className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header with gradient background */}
      <div className={`relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-indigo-600 to-blue-700 shadow-xl transform transition-all duration-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.7))]"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-300/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 p-8 flex flex-col md:flex-row justify-between items-center">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-sm font-medium mb-4 backdrop-blur-sm">
              Document Management
            </div>
            <h1 className="text-3xl font-bold mb-2 text-white">Document Library</h1>
            <p className="text-white/90 max-w-xl">
              View, manage, and organize your processed documents. Search, filter, and analyze your document data efficiently.
            </p>
          </div>
          <div className="mt-6 md:mt-0">
            <Button asChild className="bg-white text-indigo-700 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200 font-medium gap-2 py-6 px-8 h-auto rounded-xl">
              <Link href="/upload">
                <PlusCircle className="h-5 w-5" />
                Upload New Document
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className={`transform transition-all duration-700 delay-100 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <Tabs defaultValue="all" className="mb-6" onValueChange={(value) => {
          setStatusFilter(value === "all" ? "" : value);
          resetPage();
        }}>
          <TabsList className="grid grid-cols-5 w-full bg-white rounded-xl shadow-md p-1 border border-gray-100">
            <TabsTrigger value="all" className="relative data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg transition-all">
              All
              <Badge variant="outline" className="ml-1.5 bg-white text-indigo-700 border-0">{documentCounts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="uploaded" className="relative data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg transition-all">
              <Upload className="h-4 w-4 mr-1.5" />
              Uploaded
              <Badge variant="outline" className="ml-1.5 bg-white text-indigo-700 border-0">{documentCounts.uploaded}</Badge>
            </TabsTrigger>
            <TabsTrigger value="processing" className="relative data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg transition-all">
              <Clock className="h-4 w-4 mr-1.5" />
              Processing
              <Badge variant="outline" className="ml-1.5 bg-white text-indigo-700 border-0">{documentCounts.processing}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="relative data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg transition-all">
              <Check className="h-4 w-4 mr-1.5" />
              Completed
              <Badge variant="outline" className="ml-1.5 bg-white text-indigo-700 border-0">{documentCounts.completed}</Badge>
            </TabsTrigger>
            <TabsTrigger value="error" className="relative data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg transition-all">
              <AlertTriangle className="h-4 w-4 mr-1.5" />
              Error
              <Badge variant="outline" className="ml-1.5 bg-white text-indigo-700 border-0">{documentCounts.error}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Filters and Search */}
      <div className={`bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100 transform transition-all duration-700 delay-200 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                resetPage();
              }}
              className="pl-10 border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 rounded-lg"
            />
          </div>
          
          <div className="flex gap-3 flex-wrap md:flex-nowrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 border-gray-200 text-gray-700 hover:text-indigo-700 hover:border-indigo-300 transition-colors">
                  <Filter size={16} />
                  <span className="hidden sm:inline">Filter</span>
                  <ChevronDown size={14} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2 text-gray-800">Document Type</h4>
                    <Select value={typeFilter} onValueChange={(value) => {
                      setTypeFilter(value);
                      resetPage();
                    }}>
                      <SelectTrigger className="w-full border-gray-200">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="invoice">Invoices</SelectItem>
                        <SelectItem value="receipt">Receipts</SelectItem>
                        <SelectItem value="note">Notes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-2 text-gray-800">Date Range</h4>
                    <Select value={dateFilter} onValueChange={(value) => {
                      setDateFilter(value);
                      resetPage();
                    }}>
                      <SelectTrigger className="w-full border-gray-200">
                        <SelectValue placeholder="Select date range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="7days">Last 7 Days</SelectItem>
                        <SelectItem value="30days">Last 30 Days</SelectItem>
                        <SelectItem value="90days">Last 90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 border-gray-200 text-gray-700 hover:text-indigo-700 hover:border-indigo-300 transition-colors">
                  {sortBy === "name" ? (
                    <>
                      <span className="hidden sm:inline">Name</span>
                      {sortOrder === "asc" ? <SortAsc size={16} /> : <SortDesc size={16} />}
                    </>
                  ) : sortBy === "date" ? (
                    <>
                      <Calendar size={16} />
                      <span className="hidden sm:inline">Date</span>
                      {sortOrder === "asc" ? <SortAsc size={16} /> : <SortDesc size={16} />}
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Status</span>
                      {sortOrder === "asc" ? <SortAsc size={16} /> : <SortDesc size={16} />}
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem onClick={() => handleSort("name")} className="gap-2 cursor-pointer">
                  <span>Name</span>
                  {sortBy === "name" && (sortOrder === "asc" ? <SortAsc size={14} /> : <SortDesc size={14} />)}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort("date")} className="gap-2 cursor-pointer">
                  <span>Date</span>
                  {sortBy === "date" && (sortOrder === "asc" ? <SortAsc size={14} /> : <SortDesc size={14} />)}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort("status")} className="gap-2 cursor-pointer">
                  <span>Status</span>
                  {sortBy === "status" && (sortOrder === "asc" ? <SortAsc size={14} /> : <SortDesc size={14} />)}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="gap-2 cursor-pointer"
                >
                  {sortOrder === "asc" ? (
                    <>
                      <SortDesc size={14} />
                      <span>Sort Descending</span>
                    </>
                  ) : (
                    <>
                      <SortAsc size={14} />
                      <span>Sort Ascending</span>
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button
              variant="outline"
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="gap-2 border-gray-200 text-gray-700 hover:text-indigo-700 hover:border-indigo-300 transition-colors"
            >
              {viewMode === "grid" ? (
                <>
                  <FileText size={16} />
                  <span className="hidden sm:inline">List</span>
                </>
              ) : (
                <>
                  <div className="flex gap-0.5">
                    <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
                    <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
                  </div>
                  <div className="flex gap-0.5">
                    <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
                    <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
                  </div>
                  <span className="hidden sm:inline">Grid</span>
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Applied filters display */}
        {(searchQuery || typeFilter !== "all" || dateFilter !== "all" || statusFilter) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {searchQuery && (
              <Badge variant="outline" className="gap-1 py-1.5 px-3 bg-indigo-50 border-indigo-100 text-indigo-700">
                Search: {searchQuery}
                <button 
                  onClick={() => {
                    setSearchQuery("");
                    resetPage();
                  }}
                  className="ml-1 hover:bg-indigo-100 rounded-full p-0.5 transition-colors"
                >
                  <X size={14} />
                </button>
              </Badge>
            )}
            
            {typeFilter !== "all" && (
              <Badge variant="outline" className="gap-1 py-1.5 px-3 bg-indigo-50 border-indigo-100 text-indigo-700">
                Type: {typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}
                <button 
                  onClick={() => {
                    setTypeFilter("all");
                    resetPage();
                  }}
                  className="ml-1 hover:bg-indigo-100 rounded-full p-0.5 transition-colors"
                >
                  <X size={14} />
                </button>
              </Badge>
            )}
            
            {statusFilter && (
              <Badge variant="outline" className="gap-1 py-1.5 px-3 bg-indigo-50 border-indigo-100 text-indigo-700">
                Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                <button 
                  onClick={() => {
                    setStatusFilter("");
                    resetPage();
                  }}
                  className="ml-1 hover:bg-indigo-100 rounded-full p-0.5 transition-colors"
                >
                  <X size={14} />
                </button>
              </Badge>
            )}
            
            {dateFilter !== "all" && (
              <Badge variant="outline" className="gap-1 py-1.5 px-3 bg-indigo-50 border-indigo-100 text-indigo-700">
                Date: {dateFilter === "7days" ? "Last 7 Days" : dateFilter === "30days" ? "Last 30 Days" : "Last 90 Days"}
                <button 
                  onClick={() => {
                    setDateFilter("all");
                    resetPage();
                  }}
                  className="ml-1 hover:bg-indigo-100 rounded-full p-0.5 transition-colors"
                >
                  <X size={14} />
                </button>
              </Badge>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSearchQuery("");
                setTypeFilter("all");
                setStatusFilter("");
                setDateFilter("all");
                resetPage();
              }}
              className="text-gray-500 hover:text-indigo-700 py-1.5 h-auto transition-colors"
            >
              Clear All Filters
            </Button>
          </div>
        )}
      </div>

      {/* Documents Display */}
      {isLoading ? (
        <div className={`flex justify-center items-center h-64 transform transition-all duration-700 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 relative">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-600">Loading documents...</p>
          </div>
        </div>
      ) : filteredAndSortedDocuments.length === 0 ? (
        <div className={`bg-white rounded-xl shadow-lg border border-gray-100 p-12 text-center transform transition-all duration-700 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="mx-auto mb-6 w-24 h-24 bg-gradient-to-br from-indigo-100 to-blue-50 rounded-full flex items-center justify-center">
            <FileText className="h-10 w-10 text-indigo-600" />
          </div>
          <h3 className="text-xl font-bold mb-3 text-gray-800">No documents found</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            {searchQuery || typeFilter !== "all" || dateFilter !== "all" || statusFilter
              ? "No documents match your current filters. Try adjusting your search or filters."
              : "You haven't uploaded any documents yet. Upload your first document to get started."}
          </p>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6 py-5 h-auto rounded-lg shadow-md hover:shadow-lg transition-all duration-200">
            <Link href="/upload">
              <PlusCircle className="h-5 w-5" />
              Upload Document
            </Link>
          </Button>
        </div>
      ) : (
        <div className={`transform transition-all duration-700 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="flex justify-between items-center mb-4">
            <p className="text-gray-600">
              Showing <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredAndSortedDocuments.length)}</span> of <span className="font-medium">{filteredAndSortedDocuments.length}</span> documents
            </p>
            
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 h-8 w-8 border-gray-200"
                >
                  <ChevronLeft size={16} />
                </Button>
                
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                  let pageNumber: number;
                  
                  // Handle edge cases for pagination display
                  if (totalPages <= 5) {
                    pageNumber = idx + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = idx + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + idx;
                  } else {
                    pageNumber = currentPage - 2 + idx;
                  }
                  
                  // Only render if the calculated page number is valid
                  if (pageNumber > 0 && pageNumber <= totalPages) {
                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`h-8 w-8 p-0 ${currentPage === pageNumber ? 'bg-indigo-600 hover:bg-indigo-700' : 'border-gray-200'}`}
                      >
                        {pageNumber}
                      </Button>
                    );
                  }
                  
                  return null;
                })}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 h-8 w-8 border-gray-200"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </div>
          
          {/* Document grid */}
          <div className={`grid grid-cols-1 ${viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : ""} gap-6 mb-8`}>
            {paginatedDocuments.map((document, index) => (
              <div 
                key={document.id}
                className={`transform transition-all duration-500 hover:scale-[1.02] ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} 
                style={{ transitionDelay: `${300 + (index % 3) * 100}ms` }}
              >
                <DocumentCard document={document} onDelete={handleDeleteDocument} />
              </div>
            ))}
          </div>
          
          {/* Bottom pagination for mobile */}
          {totalPages > 1 && (
            <div className="flex justify-center mb-8 md:hidden">
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 h-8 w-8 border-gray-200"
                >
                  <ChevronLeft size={16} />
                </Button>
                
                <span className="text-sm text-gray-600 mx-2">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 h-8 w-8 border-gray-200"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
