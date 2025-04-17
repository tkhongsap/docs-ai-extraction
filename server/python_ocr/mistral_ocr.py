"""
Mistral OCR Service Module

This module handles document OCR processing using Mistral AI.
"""

import os
import json
import base64
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

# Get API key from environment
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY")

def extract_invoice_data(file_content, content_type):
    """
    Use Mistral AI to analyze and extract data from invoices
    
    Args:
        file_content (bytes): The content of the file in binary format
        content_type (str): The MIME type of the file (e.g., 'image/jpeg', 'application/pdf')
        
    Returns:
        str: The extracted data in JSON string format
    """
    if not MISTRAL_API_KEY:
        raise ValueError("Mistral API key not found in environment variables")
    
    # Convert file to base64
    base64_encoded = base64.b64encode(file_content).decode("utf-8")
    
    # Determine file type and create appropriate image message
    if content_type.startswith("image/"):
        # For image files
        mime_type = content_type
    elif content_type == "application/pdf":
        # For PDF files (Mistral can handle PDFs directly)
        mime_type = content_type
    else:
        # Default to binary data
        mime_type = "application/octet-stream"
    
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
        # Using direct API call instead of SDK to avoid incompatibility issues
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {MISTRAL_API_KEY}"
        }
        
        # Create messages for Mistral API
        payload = {
            "model": "mistral-large-latest",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_encoded}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 2000
        }
        
        # Make API request
        response = requests.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers=headers,
            json=payload
        )
        
        # Parse response
        response_data = response.json()
        
        if "choices" not in response_data or not response_data["choices"]:
            raise ValueError("Invalid response from Mistral API")
        
        # Get the response text
        result = response_data["choices"][0]["message"]["content"].strip()
        
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
                "error": "Failed to parse JSON from Mistral response"
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
            "error": f"Mistral API error: {error_message}"
        })