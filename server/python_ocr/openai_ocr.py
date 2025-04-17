"""
OpenAI OCR Service Module

This module handles document OCR processing using OpenAI's vision capability.
"""

import os
import json
import base64
from dotenv import load_dotenv
import openai

# Load environment variables
load_dotenv(override=True)

# Get API key from environment
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

# Set the API key for the OpenAI client
openai.api_key = OPENAI_API_KEY

def extract_invoice_data(file_content, content_type):
    """
    Use OpenAI API to extract data from an invoice image
    
    Args:
        file_content: The content of the file (image or PDF)
        content_type: The MIME type of the content (e.g., image/jpeg)
        
    Returns:
        The extracted data in text format (JSON string)
    """
    if not OPENAI_API_KEY:
        raise ValueError("OpenAI API key not found in environment variables")
    
    # Convert binary content to base64
    encoded_content = base64.b64encode(file_content).decode('utf-8')
    
    # Create prompt with detailed invoice extraction instructions
    prompt = """
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
    
    try:
        # Call the OpenAI API with the image
        response = openai.chat.completions.create(
            model="gpt-4-vision-preview",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{content_type};base64,{encoded_content}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=2000
        )
        
        # Get the response text
        result = response.choices[0].message.content.strip()
        
        # Ensure it's a valid JSON (remove any markdown formatting)
        if result.startswith("```json"):
            result = result.replace("```json", "", 1)
        if result.endswith("```"):
            result = result.rsplit("```", 1)[0]
            
        result = result.strip()
        
        # Validate JSON format
        try:
            json.loads(result)
        except json.JSONDecodeError:
            # If not valid JSON, create a basic JSON structure
            return json.dumps({
                "vendorName": "Could not extract vendor name",
                "invoiceNumber": "Unknown",
                "totalAmount": 0,
                "lineItems": [],
                "handwrittenNotes": [],
                "error": "Failed to parse JSON from OpenAI response"
            })
        
        return result
        
    except Exception as e:
        error_message = str(e)
        return json.dumps({
            "vendorName": "",
            "invoiceNumber": "",
            "totalAmount": 0,
            "lineItems": [],
            "handwrittenNotes": [],
            "error": f"OpenAI API error: {error_message}"
        })