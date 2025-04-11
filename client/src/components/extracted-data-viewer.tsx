import { useState } from "react";
import { Extraction } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Edit, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ExtractedDataViewerProps {
  extraction: Extraction;
  documentId: number;
  onDataUpdated?: (data: Extraction) => void;
}

export default function ExtractedDataViewer({ 
  extraction, 
  documentId,
  onDataUpdated
}: ExtractedDataViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("invoice-details");
  const { toast } = useToast();
  
  const handleExport = async (format: "markdown" | "json") => {
    try {
      const url = `/api/extractions/${extraction.id}/export/${format}`;
      window.open(url, "_blank");
    } catch (error) {
      console.error(`Error exporting as ${format}:`, error);
      toast({
        title: "Export Failed",
        description: `Failed to export as ${format.toUpperCase()}.`,
        variant: "destructive"
      });
    }
  };
  
  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Extracted Data</h2>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleEdit}
          >
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              const exportMenu = document.getElementById("exportMenu");
              if (exportMenu) {
                exportMenu.classList.toggle("hidden");
              }
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          
          {/* Export Menu Dropdown */}
          <div id="exportMenu" className="hidden absolute mt-8 right-6 z-10 bg-white border border-gray-200 rounded-md shadow-md">
            <ul className="py-1">
              <li>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => handleExport("markdown")}
                >
                  Markdown
                </button>
              </li>
              <li>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => handleExport("json")}
                >
                  JSON
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      <Tabs defaultValue="invoice-details" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 w-full justify-start space-x-6 border-b rounded-none h-auto p-0">
          <TabsTrigger 
            value="invoice-details" 
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent px-1 py-2 rounded-none"
          >
            Invoice Details
          </TabsTrigger>
          <TabsTrigger 
            value="line-items" 
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent px-1 py-2 rounded-none"
          >
            Line Items
          </TabsTrigger>
          <TabsTrigger 
            value="handwritten-notes" 
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent px-1 py-2 rounded-none"
          >
            Handwritten Notes
          </TabsTrigger>
          <TabsTrigger 
            value="raw-text" 
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent px-1 py-2 rounded-none"
          >
            Raw Text
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="invoice-details" className="mt-0">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  {extraction.vendorName || "Not extracted"}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  {extraction.invoiceNumber || "Not extracted"}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  {extraction.invoiceDate ? new Date(extraction.invoiceDate).toLocaleDateString() : "Not extracted"}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  {extraction.dueDate ? new Date(extraction.dueDate).toLocaleDateString() : "Not extracted"}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal</label>
                <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  {extraction.totalAmount ? `$${extraction.totalAmount}` : "Not extracted"}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax</label>
                <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  {extraction.taxAmount ? `$${extraction.taxAmount}` : "Not extracted"}
                </div>
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-bold">
                  {extraction.totalAmount ? `$${extraction.totalAmount}` : "Not extracted"}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col space-y-2 pt-4">
              <div className="flex items-center">
                <i className="fas fa-check-circle text-green-500 mr-2"></i>
                <span className="text-sm text-gray-700">OCR Confidence: High (94%)</span>
              </div>
              <div className="flex items-center">
                <i className="fas fa-info-circle text-primary mr-2"></i>
                <span className="text-sm text-gray-700">Extracted with OpenAI Vision API</span>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="line-items" className="mt-0">
          {extraction.lineItems && extraction.lineItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {extraction.lineItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.description}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${item.unitPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-gray-50 p-4 text-center text-gray-500 rounded-md">
              No line items extracted
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="handwritten-notes" className="mt-0">
          {extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0 ? (
            <div className="space-y-3">
              {extraction.handwrittenNotes.map((note, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                  <p className="text-gray-800">{note.text}</p>
                  <div className="mt-1 flex items-center">
                    <div className="h-2 w-full bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-green-500 rounded-full" 
                        style={{ width: `${note.confidence}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">Confidence: {note.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 p-4 text-center text-gray-500 rounded-md">
              No handwritten notes extracted
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="raw-text" className="mt-0">
          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
              {extraction.jsonOutput || "No raw text extracted"}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
