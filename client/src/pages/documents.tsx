import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Filter, ChevronDown, ChevronLeft, ChevronRight, SortAsc, SortDesc } from "lucide-react";
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
} from "@/components/ui/dropdown-menu";

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // "all", "7days", "30days", "90days"
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("date"); // "name", "date", "status"
  const [sortOrder, setSortOrder] = useState("desc"); // "asc", "desc"
  const itemsPerPage = 10; // Changed to 10 per requirements
  
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
      if (typeFilter) {
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

  return (
    <section className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Document Library</h1>
        <p className="text-gray-600">View and manage your processed documents</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4">
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
        
        <div className="flex flex-wrap gap-3">
          <Select 
            value={typeFilter} 
            onValueChange={(value) => {
              setTypeFilter(value);
              resetPage();
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="invoice">Invoices</SelectItem>
              <SelectItem value="receipt">Receipts</SelectItem>
              <SelectItem value="note">Notes</SelectItem>
            </SelectContent>
          </Select>
          
          <Select 
            value={statusFilter} 
            onValueChange={(value) => {
              setStatusFilter(value);
              resetPage();
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Status</SelectItem>
              <SelectItem value="uploaded">Uploaded</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          
          <Select 
            value={dateFilter} 
            onValueChange={(value) => {
              setDateFilter(value);
              resetPage();
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1">
                Sort by: {sortBy === "name" ? "Name" : sortBy === "date" ? "Date" : "Status"}
                {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleSort("name")}>
                Name {sortBy === "name" && (sortOrder === "asc" ? "(A-Z)" : "(Z-A)")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort("date")}>
                Date {sortBy === "date" && (sortOrder === "asc" ? "(Oldest)" : "(Newest)")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort("status")}>
                Status
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : paginatedDocuments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedDocuments.map(document => (
            <DocumentCard 
              key={document.id} 
              document={document} 
              onDelete={handleDeleteDocument}
            />
          ))}
        </div>
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
            <a href="/upload">Upload New Document</a>
          </Button>
        </div>
      )}

      {/* Pagination */}
      {filteredAndSortedDocuments.length > itemsPerPage && (
        <div className="mt-8 flex justify-between items-center">
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
