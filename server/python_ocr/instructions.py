"""
Instructions for AI-based OCR extraction.
Contains queries and prompts for different OCR models.
"""

# Common invoice extraction prompt format
INVOICE_EXTRACTION_PROMPT = """
Extract all invoice information from this document. The extracted information should be organized in the following JSON format:
{
    "vendorName": "Company Name",
    "vendorAddress": "Full address",
    "vendorContact": "Phone, email, or website", 
    "clientName": "Client name",
    "clientAddress": "Client address",
    "invoiceNumber": "INV-12345",
    "invoiceDate": "YYYY-MM-DD", 
    "dueDate": "YYYY-MM-DD",
    "totalAmount": 1234.56,
    "subtotalAmount": 1000.00,
    "taxAmount": 234.56,
    "currency": "USD",
    "lineItems": [
        {
            "description": "Item description",
            "quantity": 2,
            "unitPrice": 500.00,
            "amount": 1000.00,
            "itemCode": "IT-001"
        }
    ],
    "handwrittenNotes": [
        {
            "text": "Handwritten note content",
            "confidence": 80
        }
    ]
}

Make sure to:
1. Extract all line items with their details
2. Identify any handwritten notes or annotations
3. Provide numeric values without currency symbols
4. Format dates in ISO format (YYYY-MM-DD)
5. Include empty arrays if no line items or notes are present

Return ONLY the JSON with no additional text.
"""

# OpenAI-specific prompts
OPENAI_HANDWRITTEN_DETECTION = """
Please analyze this document and extract only the handwritten notes or annotations. 
For each handwritten element:
1. Extract the text content
2. Estimate a confidence score (0-100)
3. Describe its position (top, bottom, margin, etc.)

Format your response as a JSON array of objects, where each object has:
- text: The handwritten text content
- confidence: Your confidence in the extraction (0-100)
- position: Description of where it appears in the document

If no handwritten notes are detected, return an empty array: []
"""

# Mistral-specific prompts
MISTRAL_INVOICE_EXTRACTION = """
Analyze this invoice and extract the structured data into a clean JSON format.

Required fields:
- vendor information (name, address, contact)
- client information (name, address)
- invoice details (number, date, due date)
- financial information (subtotal, tax, total amount, currency)
- line items (description, quantity, unit price, amount)
- any handwritten notes

Follow these guidelines:
- Use consistent formatting (dates as YYYY-MM-DD)
- Include empty arrays when no data exists
- Remove currency symbols from numeric values
- Verify tax calculations where possible
- Include confidence scores for handwritten text

Return only valid JSON with no additional commentary.
"""

# Azure Document Intelligence specific queries
AZURE_ANALYSIS_QUERIES = {
    "vendor_details": "Extract the complete vendor information including name, address, and contact details.",
    "invoice_totals": "Verify the mathematical accuracy of subtotal, tax, and total amount calculations.",
    "payment_terms": "Identify any payment terms, due dates, or early payment discount information.",
    "handwritten_notes": "Locate and extract any handwritten notes, annotations, or signatures on the document."
}

# Default OCR settings
DEFAULT_OCR_SETTINGS = {
    "confidence_threshold": 0.75,
    "enable_handwriting_detection": True,
    "max_line_items": 50,
    "json_output": True,
    "fallback_to_raw_text": False
}