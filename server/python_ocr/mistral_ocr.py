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
        
        # Parse response and add detailed logging
        if response.status_code != 200:
            print(f"Mistral API error - Status code: {response.status_code}")
            print(f"Response: {response.text[:500]}...")
            raise ValueError(f"Mistral API error - Status code: {response.status_code}, Response: {response.text[:100]}...")
            
        try:
            response_data = response.json()
        except Exception as e:
            print(f"Failed to parse Mistral response as JSON: {str(e)}")
            print(f"Raw response: {response.text[:500]}...")
            raise ValueError(f"Failed to parse Mistral response as JSON: {str(e)}")
        
        print(f"Mistral response status: {response.status_code}")
        print(f"Mistral response contains: {', '.join(response_data.keys())}")
        
        if "choices" not in response_data or not response_data["choices"]:
            print(f"Invalid Mistral response: {json.dumps(response_data)[:500]}...")
            raise ValueError("Invalid response from Mistral API: No choices in response")
        
        # Get the response text
        if not response_data["choices"][0]["message"]["content"]:
            print("WARNING: Empty content from Mistral AI")
            return json.dumps({
                "vendorName": "Could not extract vendor name",
                "invoiceNumber": "Unknown",
                "totalAmount": 0,
                "lineItems": [],
                "handwrittenNotes": [],
                "error": "Empty response from Mistral AI"
            })
            
        # Log the raw response content for debugging
        raw_content = response_data["choices"][0]["message"]["content"]
        print(f"Mistral raw response (first 100 chars): {raw_content[:100]}...")
        
        result = raw_content.strip()
        
        # Enhanced JSON extraction logic
        # First try to find JSON within markdown code blocks
        import re
        json_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
        json_matches = re.findall(json_pattern, result)
        
        if json_matches:
            # Use the first JSON block found
            result = json_matches[0].strip()
        else:
            # Try to find JSON with opening/closing braces if no code blocks found
            brace_pattern = r'(\{[\s\S]*\})'
            brace_matches = re.findall(brace_pattern, result)
            if brace_matches:
                result = brace_matches[0].strip()
            else:
                # No JSON found
                result = result.strip()
        
        # Additional cleanup to ensure we have valid JSON
        if result.startswith('```'):
            result = result.lstrip('`')
        if result.endswith('```'):
            result = result.rstrip('`')
        
        # Validate JSON format
        try:
            # Log the response for debugging
            print("Mistral extracted JSON candidate:", result[:100] + "..." if len(result) > 100 else result)
            parsed_json = json.loads(result)
            
            # Ensure we have the minimum required fields
            required_fields = ["vendorName", "invoiceNumber", "totalAmount"]
            missing_fields = [field for field in required_fields if field not in parsed_json]
            
            if missing_fields:
                print(f"Mistral JSON missing required fields: {missing_fields}")
                # Add missing fields with default values
                for field in missing_fields:
                    if field == "totalAmount":
                        parsed_json[field] = 0
                    else:
                        parsed_json[field] = "Unknown"
            
            # Ensure lineItems and handwrittenNotes exist
            if "lineItems" not in parsed_json:
                parsed_json["lineItems"] = []
            if "handwrittenNotes" not in parsed_json:
                parsed_json["handwrittenNotes"] = []
                
            return json.dumps(parsed_json)
            
        except json.JSONDecodeError as e:
            print(f"Mistral JSON decode error: {str(e)}")
            # If not valid JSON, create a basic JSON structure
            return json.dumps({
                "vendorName": "Could not extract vendor name",
                "invoiceNumber": "Unknown",
                "totalAmount": 0,
                "lineItems": [],
                "handwrittenNotes": [],
                "error": f"Failed to parse JSON from Mistral response: {str(e)}"
            })
        
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