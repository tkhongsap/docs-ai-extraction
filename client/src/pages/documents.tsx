import { useState, useMemo } from "react";
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
  PlusCircle 
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
  const itemsPerPage = 10;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch documents with caching
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Mutation for document deletion
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/documents/${id}`);
    },
    onSuccess: () => {
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
    <section className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Document Library</h1>
          <p className="text-gray-600">View and manage your processed documents</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/upload">
            <PlusCircle className="h-4 w-4" />
            Upload New Document
          </Link>
        </Button>
      </div>

      {/* Status tabs */}
      <Tabs defaultValue="all" className="mb-6" onValueChange={(value) => {
        setStatusFilter(value === "all" ? "" : value);
        resetPage();
      }}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="all" className="relative">
            All
            <Badge variant="outline" className="ml-1 bg-gray-100">{documentCounts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="uploaded" className="relative">
            <Upload className="h-4 w-4 mr-1" />
            Uploaded
            <Badge variant="outline" className="ml-1 bg-gray-100">{documentCounts.uploaded}</Badge>
          </TabsTrigger>
          <TabsTrigger value="processing" className="relative">
            <Clock className="h-4 w-4 mr-1" />
            Processing
            <Badge variant="outline" className="ml-1 bg-gray-100">{documentCounts.processing}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="relative">
            <Check className="h-4 w-4 mr-1" />
            Completed
            <Badge variant="outline" className="ml-1 bg-gray-100">{documentCounts.completed}</Badge>
          </TabsTrigger>
          <TabsTrigger value="error" className="relative">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Error
            <Badge variant="outline" className="ml-1 bg-gray-100">{documentCounts.error}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-grow">
            <Input
              placeholder="Search documents..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                resetPage();
              }}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              className="h-10"
              onClick={() => setViewMode("grid")}
            >
              <i className="fas fa-th-large mr-1"></i> Grid
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              className="h-10"
              onClick={() => setViewMode("list")}
            >
              <i className="fas fa-list mr-1"></i> List
            </Button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <span className="text-sm text-gray-500 mr-2">Filter by:</span>
          </div>
          
          <Select 
            value={typeFilter} 
            onValueChange={(value) => {
              setTypeFilter(value);
              resetPage();
            }}
          >
            <SelectTrigger className="w-[130px] h-9">
              <FileText className="h-4 w-4 mr-1 text-gray-400" />
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="invoice">Invoices</SelectItem>
              <SelectItem value="receipt">Receipts</SelectItem>
              <SelectItem value="note">Notes</SelectItem>
            </SelectContent>
          </Select>
          
          <Select 
            value={dateFilter} 
            onValueChange={(value) => {
              setDateFilter(value);
              resetPage();
            }}
          >
            <SelectTrigger className="w-[130px] h-9">
              <Calendar className="h-4 w-4 mr-1 text-gray-400" />
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1">
                  {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  Sort: {sortBy === "name" ? "Name" : sortBy === "date" ? "Date" : "Status"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSort("date")} className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Date {sortBy === "date" && (sortOrder === "asc" ? "(Oldest first)" : "(Newest first)")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort("name")} className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Name {sortBy === "name" && (sortOrder === "asc" ? "(A-Z)" : "(Z-A)")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort("status")} className="flex items-center">
                  <Check className="h-4 w-4 mr-2" />
                  Status {sortBy === "status" && (sortOrder === "asc" ? "(Asc)" : "(Desc)")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortOrder("asc")} className="flex items-center">
                  <SortAsc className="h-4 w-4 mr-2" />
                  Ascending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("desc")} className="flex items-center">
                  <SortDesc className="h-4 w-4 mr-2" />
                  Descending
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Active filters display */}
      {(searchQuery || (typeFilter && typeFilter !== "all") || statusFilter || dateFilter !== "all") && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-500">Active filters:</span>
          
          {searchQuery && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Search: {searchQuery}
              <button 
                className="ml-1 hover:text-gray-700" 
                onClick={() => setSearchQuery("")}
              >
                &times;
              </button>
            </Badge>
          )}
          
          {typeFilter && typeFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Type: {typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}
              <button 
                className="ml-1 hover:text-gray-700" 
                onClick={() => setTypeFilter("all")}
              >
                &times;
              </button>
            </Badge>
          )}
          
          {statusFilter && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              <button 
                className="ml-1 hover:text-gray-700" 
                onClick={() => setStatusFilter("")}
              >
                &times;
              </button>
            </Badge>
          )}
          
          {dateFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Date: {dateFilter === "7days" ? "Last 7 days" : dateFilter === "30days" ? "Last 30 days" : "Last 90 days"}
              <button 
                className="ml-1 hover:text-gray-700" 
                onClick={() => setDateFilter("all")}
              >
                &times;
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
            className="ml-auto text-xs text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Clear all filters
          </Button>
        </div>
      )}

      {/* Documents Grid/List */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : paginatedDocuments.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedDocuments.map(document => (
              <DocumentCard 
                key={document.id} 
                document={document} 
                onDelete={handleDeleteDocument}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedDocuments.map(document => {
                  const statusInfo = {
                    uploaded: { color: "bg-gray-100 text-gray-800", icon: <FileText className="h-4 w-4 mr-1" /> },
                    processing: { color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-4 w-4 mr-1 animate-pulse" /> },
                    completed: { color: "bg-green-100 text-green-800", icon: <Check className="h-4 w-4 mr-1" /> },
                    error: { color: "bg-red-100 text-red-800", icon: <AlertTriangle className="h-4 w-4 mr-1" /> }
                  };
                  
                  const status = statusInfo[document.status as keyof typeof statusInfo];
                  
                  return (
                    <tr key={document.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                            <i className={`${document.fileType.includes('pdf') ? 'fas fa-file-pdf text-red-500' : 'fas fa-file-image text-blue-500'} text-lg`}></i>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={document.originalFilename}>
                              {document.originalFilename}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {document.fileType.split('/')[1]?.toUpperCase() || 'FILE'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(document.uploadDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${status.color}`}>
                          {status.icon}
                          {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {document.status === "completed" ? (
                          <Link href={`/review/${document.id}`} className="text-primary hover:underline mr-4">
                            View
                          </Link>
                        ) : document.status === "processing" ? (
                          <Link href="/processing" className="text-yellow-600 hover:underline mr-4">
                            Progress
                          </Link>
                        ) : document.status === "uploaded" ? (
                          <Link href="/processing" className="text-primary hover:underline mr-4">
                            Process
                          </Link>
                        ) : (
                          <span className="text-gray-300 mr-4">View</span>
                        )}
                        <button 
                          className="text-red-600 hover:text-red-900"
                          onClick={() => handleDeleteDocument(document.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="bg-white rounded-lg p-8 text-center">
          <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-file-alt text-gray-400 text-2xl"></i>
          </div>
          <h3 className="text-lg font-bold mb-2">No documents found</h3>
          <p className="text-gray-600 mb-4">
            {documents?.length 
              ? "No documents match your current filters. Try adjusting your search criteria." 
              : "You haven't uploaded any documents yet. Start by uploading your first document."}
          </p>
          <Button asChild>
            <Link href="/upload">Upload New Document</Link>
          </Button>
        </div>
      )}

      {/* Pagination */}
      {filteredAndSortedDocuments.length > itemsPerPage && (
        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-500">
            Showing page {currentPage} of {totalPages} ({filteredAndSortedDocuments.length} documents)
          </div>
          <nav className="inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <Button
              variant="outline"
              size="icon"
              className="rounded-l-md"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {totalPages <= 5 ? (
              // Show all pages if there are 5 or fewer
              Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  className="rounded-none"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))
            ) : (
              // Show first, last, and pages around current
              <>
                {/* First page */}
                <Button
                  variant={currentPage === 1 ? "default" : "outline"}
                  className="rounded-none"
                  onClick={() => setCurrentPage(1)}
                >
                  1
                </Button>
                
                {/* Ellipsis if current page is not near the beginning */}
                {currentPage > 3 && (
                  <Button variant="outline" className="rounded-none cursor-default">
                    ...
                  </Button>
                )}
                
                {/* Pages around current */}
                {Array.from({ length: 3 }, (_, i) => {
                  const page = Math.min(Math.max(currentPage - 1 + i, 2), totalPages - 1);
                  return (
                    (page > 1 && page < totalPages) && (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        className="rounded-none"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    )
                  );
                })}
                
                {/* Ellipsis if current page is not near the end */}
                {currentPage < totalPages - 2 && (
                  <Button variant="outline" className="rounded-none cursor-default">
                    ...
                  </Button>
                )}
                
                {/* Last page */}
                <Button
                  variant={currentPage === totalPages ? "default" : "outline"}
                  className="rounded-none"
                  onClick={() => setCurrentPage(totalPages)}
                >
                  {totalPages}
                </Button>
              </>
            )}
            
            <Button
              variant="outline"
              size="icon"
              className="rounded-r-md"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      )}
    </section>
  );
}
