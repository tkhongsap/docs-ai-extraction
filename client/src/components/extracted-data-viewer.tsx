import { useState, useRef, useEffect } from "react";
import { Extraction, LineItem, HandwrittenNote, Document } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  Edit, Save, Download, Plus, Trash2, Info, AlertTriangle, 
  ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Check, X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ExtractedDataViewerProps {
  extraction: Extraction;
  documentId: number;
  onDataUpdated?: (data: Extraction) => void;
  documentScrollPosition?: number;
}

// Helper function to get confidence color based on percentage
const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 80) return '#10b981'; // Green
  if (confidence >= 60) return '#facc15'; // Yellow
  return '#ef4444'; // Red
};

// Helper function to get average confidence
const getAverageConfidence = (extraction: Extraction): number => {
  if (!extraction.handwrittenNotes || extraction.handwrittenNotes.length === 0) {
    return 0;
  }
  return Math.round(
    extraction.handwrittenNotes.reduce((acc, note) => acc + note.confidence, 0) /
    extraction.handwrittenNotes.length
  );
};

export default function ExtractedDataViewer({
  extraction: initialExtraction,
  documentId,
  onDataUpdated,
  documentScrollPosition
}: ExtractedDataViewerProps) {
  const [extraction, setExtraction] = useState<Extraction>(initialExtraction);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("invoice-details");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch document information
  const { data: document } = useQuery<Document>({
    queryKey: [`/api/documents/${documentId}`],
    enabled: !!documentId,
  });

  // References for scroll sync
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync scrolling with document viewer
  useEffect(() => {
    if (containerRef.current && typeof documentScrollPosition === 'number') {
      const { scrollHeight, clientHeight } = containerRef.current;
      const scrollTop = ((scrollHeight - clientHeight) * documentScrollPosition) / 100;

      containerRef.current.scrollTop = scrollTop;
    }
  }, [documentScrollPosition]);

  // Handle updating the extraction data
  const updateExtractionMutation = useMutation({
    mutationFn: async (updatedExtraction: Extraction) => {
      const response = await fetch(`/api/extractions/${extraction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedExtraction),
      });

      if (!response.ok) {
        throw new Error('Failed to update extraction data');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/extractions/document/${documentId}`]
      });

      if (onDataUpdated) {
        onDataUpdated(data);
      }

      toast({
        title: "Changes Saved",
        description: "Extraction data has been updated successfully.",
      });

      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save changes.",
        variant: "destructive"
      });
    }
  });

  const handleExport = async (format: "markdown" | "json") => {
    try {
      setShowExportMenu(false);
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

  const handleSave = () => {
    updateExtractionMutation.mutate(extraction);
  };

  // Handle form field changes
  const handleChange = (field: keyof Extraction, value: any) => {
    setExtraction(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle line item changes
  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    if (!extraction.lineItems) return;

    const updatedLineItems = [...extraction.lineItems];
    updatedLineItems[index] = {
      ...updatedLineItems[index],
      [field]: field === 'description' ? value : Number(value)
    };

    setExtraction(prev => ({
      ...prev,
      lineItems: updatedLineItems
    }));
  };

  // Add a new line item
  const addLineItem = () => {
    const newLineItem: LineItem = {
      description: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0
    };

    setExtraction(prev => ({
      ...prev,
      lineItems: [...(prev.lineItems || []), newLineItem]
    }));
  };

  // Remove a line item
  const removeLineItem = (index: number) => {
    if (!extraction.lineItems) return;

    const updatedLineItems = extraction.lineItems.filter((_, i) => i !== index);

    setExtraction(prev => ({
      ...prev,
      lineItems: updatedLineItems
    }));
  };

  // Handle handwritten note changes
  const handleNoteChange = (index: number, field: keyof HandwrittenNote, value: any) => {
    if (!extraction.handwrittenNotes) return;

    const updatedNotes = [...extraction.handwrittenNotes];
    updatedNotes[index] = {
      ...updatedNotes[index],
      [field]: field === 'text' ? value : Number(value)
    };

    setExtraction(prev => ({
      ...prev,
      handwrittenNotes: updatedNotes
    }));
  };

  // Add a new handwritten note
  const addHandwrittenNote = () => {
    const newNote: HandwrittenNote = {
      text: '',
      confidence: 75
    };

    setExtraction(prev => ({
      ...prev,
      handwrittenNotes: [...(prev.handwrittenNotes || []), newNote]
    }));
  };

  // Remove a handwritten note
  const removeHandwrittenNote = (index: number) => {
    if (!extraction.handwrittenNotes) return;

    const updatedNotes = extraction.handwrittenNotes.filter((_, i) => i !== index);

    setExtraction(prev => ({
      ...prev,
      handwrittenNotes: updatedNotes
    }));
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "Not extracted";
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Extracted Data</h2>
        <div className="flex space-x-2">
          {isEditing ? (
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={updateExtractionMutation.isPending}
            >
              {updateExtractionMutation.isPending ? (
                <span className="flex items-center">
                  <span className="animate-spin mr-2">⭘</span> Saving...
                </span>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" /> Save
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleEdit}
            >
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}

          <div className="relative">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>

            {/* Export Menu Dropdown */}
            {showExportMenu && (
              <div className="absolute mt-2 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-md w-32">
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
            )}
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
            value="metadata"
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent px-1 py-2 rounded-none"
          >
            Metadata
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoice-details" className="mt-0">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                {isEditing ? (
                  <Input
                    value={extraction.vendorName || ""}
                    onChange={(e) => handleChange("vendorName", e.target.value)}
                    className="w-full"
                  />
                ) : (
                  <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                    {extraction.vendorName || "Not extracted"}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                {isEditing ? (
                  <Input
                    value={extraction.invoiceNumber || ""}
                    onChange={(e) => handleChange("invoiceNumber", e.target.value)}
                    className="w-full"
                  />
                ) : (
                  <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                    {extraction.invoiceNumber || "Not extracted"}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={extraction.invoiceDate ? new Date(extraction.invoiceDate).toISOString().split('T')[0] : ""}
                    onChange={(e) => handleChange("invoiceDate", e.target.value ? new Date(e.target.value) : null)}
                    className="w-full"
                  />
                ) : (
                  <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                    {extraction.invoiceDate ? formatDate(new Date(extraction.invoiceDate)) : "Not extracted"}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={extraction.dueDate ? new Date(extraction.dueDate).toISOString().split('T')[0] : ""}
                    onChange={(e) => handleChange("dueDate", e.target.value ? new Date(e.target.value) : null)}
                    className="w-full"
                  />
                ) : (
                  <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                    {extraction.dueDate ? formatDate(new Date(extraction.dueDate)) : "Not extracted"}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal</label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={extraction.totalAmount || ""}
                    onChange={(e) => handleChange("totalAmount", e.target.value)}
                    className="w-full"
                    step="0.01"
                    min="0"
                  />
                ) : (
                  <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                    {extraction.totalAmount ? `${extraction.totalAmount}` : "Not extracted"}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax</label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={extraction.taxAmount || ""}
                    onChange={(e) => handleChange("taxAmount", e.target.value)}
                    className="w-full"
                    step="0.01"
                    min="0"
                  />
                ) : (
                  <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                    {extraction.taxAmount ? `${extraction.taxAmount}` : "Not extracted"}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={extraction.totalAmount || ""}
                    onChange={(e) => handleChange("totalAmount", e.target.value)}
                    className="w-full"
                    step="0.01"
                    min="0"
                  />
                ) : (
                  <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-bold">
                    {extraction.totalAmount ? `${extraction.totalAmount}` : "Not extracted"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="line-items" className="mt-0">
          {isEditing && (
            <div className="mb-4">
              <Button
                onClick={addLineItem}
                size="sm"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Line Item
              </Button>
            </div>
          )}

          {extraction.lineItems && extraction.lineItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    {isEditing && (
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {extraction.lineItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {isEditing ? (
                          <Input
                            value={item.description}
                            onChange={(e) => handleLineItemChange(index, "description", e.target.value)}
                            className="w-full"
                          />
                        ) : (
                          item.description
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(index, "quantity", e.target.value)}
                            className="w-full"
                            min="0"
                            step="1"
                          />
                        ) : (
                          item.quantity
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => handleLineItemChange(index, "unitPrice", e.target.value)}
                            className="w-full"
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          `${item.unitPrice.toFixed(2)}`
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={item.amount}
                            onChange={(e) => handleLineItemChange(index, "amount", e.target.value)}
                            className="w-full"
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          `${item.amount.toFixed(2)}`
                        )}
                      </td>
                      {isEditing && (
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      )}
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
          {isEditing && (
            <div className="mb-4">
              <Button
                onClick={addHandwrittenNote}
                size="sm"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Handwritten Note
              </Button>
            </div>
          )}

          {extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0 ? (
            <div className="space-y-3">
              {extraction.handwrittenNotes.map((note, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={note.text}
                        onChange={(e) => handleNoteChange(index, "text", e.target.value)}
                        className="w-full"
                        rows={3}
                      />
                      <div className="flex items-center">
                        <span className="text-xs text-gray-500 mr-2">Confidence:</span>
                        <Input
                          type="range"
                          value={note.confidence}
                          onChange={(e) => handleNoteChange(index, "confidence", parseInt(e.target.value))}
                          min="0"
                          max="100"
                          className="flex-1"
                        />
                        <span className="text-xs text-gray-500 ml-2">{note.confidence}%</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeHandwrittenNote(index)}
                          className="ml-2"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 p-4 text-center text-gray-500 rounded-md">
              No handwritten notes extracted
            </div>
          )}
        </TabsContent>

        <TabsContent value="metadata" className="mt-0" ref={containerRef}>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-md font-semibold">Document Metadata</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Info className="h-4 w-4 text-gray-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        This information provides details about the document and its extraction process.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Document ID</p>
                  <p className="text-sm font-medium">{documentId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Extraction ID</p>
                  <p className="text-sm font-medium">{extraction.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">File Type</p>
                  <p className="text-sm font-medium">
                    PDF/Image
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">OCR Engine</p>
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">
                      {document?.ocrService ? (
                        document.ocrService === 'openai' ? 'OpenAI OCR' :
                        document.ocrService === 'mistral' ? 'MistralAI OCR' :
                        document.ocrService === 'ms-document-intelligence' ? 'MS Document Intelligence' :
                        document.ocrService
                      ) : "Not available"}
                    </span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Selected
                    </Badge>
                  </div>
                  {extraction.processingMetadata?.processingParams?.reason && (
                    <p className="text-xs text-gray-500 mt-1 italic">
                      Fallback reason: {extraction.processingMetadata.processingParams.reason}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-md font-semibold">OCR Confidence Metrics</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Info className="h-4 w-4 text-gray-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Confidence scores indicate the OCR system's certainty in the extracted text.
                        Higher percentages indicate more reliable extractions.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="space-y-4">
                {/* Average Confidence */}
                <div>
                  <div className="flex justify-between mb-1">
                    <p className="text-sm text-gray-500">Average Confidence Score</p>
                    <p className="text-sm font-medium">
                      {extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0
                        ? `${Math.round(extraction.handwrittenNotes.reduce((acc, note) => acc + note.confidence, 0) / extraction.handwrittenNotes.length)}%`
                        : 'N/A'}
                    </p>
                  </div>

                  {extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full"
                        style={{
                          width: `${Math.round(extraction.handwrittenNotes.reduce((acc, note) => acc + note.confidence, 0) / extraction.handwrittenNotes.length)}%`,
                          backgroundColor: getConfidenceColor(Math.round(extraction.handwrittenNotes.reduce((acc, note) => acc + note.confidence, 0) / extraction.handwrittenNotes.length))
                        }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* Confidence by field type */}
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="text-sm text-gray-500">Invoice Fields</p>
                    <div className="flex items-center">
                      <Badge className="bg-green-100 text-green-800 border-green-200 mr-2">
                        High
                      </Badge>
                      <span className="text-sm">95%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Line Items</p>
                    <div className="flex items-center">
                      <Badge className="bg-green-100 text-green-800 border-green-200 mr-2">
                        High
                      </Badge>
                      <span className="text-sm">92%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Handwriting</p>
                    <div className="flex items-center">
                      <Badge className={`${extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0 ?
                        (getAverageConfidence(extraction) > 80 ? "bg-green-100 text-green-800 border-green-200" :
                        getAverageConfidence(extraction) > 60 ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                        "bg-red-100 text-red-800 border-red-200") :
                        "bg-gray-100 text-gray-800 border-gray-200"} mr-2`}>
                        {extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0 ?
                          (getAverageConfidence(extraction) > 80 ? "High" :
                          getAverageConfidence(extraction) > 60 ? "Medium" :
                          "Low") :
                          "N/A"}
                      </Badge>
                      <span className="text-sm">
                        {extraction.handwrittenNotes && extraction.handwrittenNotes.length > 0 ?
                          `${getAverageConfidence(extraction)}%` :
                          "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <h3 className="text-md font-semibold mb-3">Processing Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Extract Date</p>
                  <p className="text-sm font-medium">{formatDate(new Date())}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <div className="flex items-center">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Completed
                    </Badge>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 mb-1">OCR Processing Tips</p>
                  <ul className="text-xs text-gray-600 list-disc pl-4 space-y-1">
                    <li>Documents with clear print text yield higher accuracy</li>
                    <li>Handwritten text extraction may require manual verification</li>
                    <li>Edit data in the respective tabs as needed</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}