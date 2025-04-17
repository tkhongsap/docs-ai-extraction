"""
Instructions for AI-based OCR extraction.
Contains queries and prompts for different OCR models.
"""

# Extraction query for invoice processing
extraction_query = """
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