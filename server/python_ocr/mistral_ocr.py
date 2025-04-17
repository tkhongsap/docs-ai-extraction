"""
Mistral OCR Service Module

This module handles document OCR processing using Mistral AI.
"""

import os
import json
import base64
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

# Get API key from environment
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY")

def generate_markdown_from_extraction(data):
    """
    Generate a markdown representation of the extracted invoice data
    
    Args:
        data (dict): The extracted invoice data
        
    Returns:
        str: Markdown formatted text
    """
    # Initialize markdown content
    md = ["# Invoice Extraction Result", ""]
    
    # Vendor Information section
    md.append("## Vendor Information")
    vendor_name = data.get("vendorName", "")
    vendor_address = data.get("vendorAddress", "")
    vendor_contact = data.get("vendorContact", "")
    
    md.append(f"- **Vendor Name**: {vendor_name if vendor_name else 'N/A'}")
    md.append(f"- **Vendor Address**: {vendor_address if vendor_address else 'N/A'}")
    md.append(f"- **Vendor Contact**: {vendor_contact if vendor_contact else 'N/A'}")
    md.append("")
    
    # Invoice Details section
    md.append("## Invoice Details")
    invoice_number = data.get("invoiceNumber", "")
    invoice_date = data.get("invoiceDate", None)
    due_date = data.get("dueDate", None)
    
    # Format dates if they exist
    invoice_date_str = "N/A"
    if invoice_date:
        try:
            if isinstance(invoice_date, str) and "T" in invoice_date:
                invoice_date_str = invoice_date.split("T")[0].replace("-", "/")
            else:
                invoice_date_str = str(invoice_date)
        except:
            invoice_date_str = str(invoice_date)
    
    due_date_str = "N/A"
    if due_date:
        try:
            if isinstance(due_date, str) and "T" in due_date:
                due_date_str = due_date.split("T")[0].replace("-", "/")
            else:
                due_date_str = str(due_date)
        except:
            due_date_str = str(due_date)
    
    md.append(f"- **Invoice Number**: {invoice_number if invoice_number else 'N/A'}")
    md.append(f"- **Invoice Date**: {invoice_date_str}")
    md.append(f"- **Due Date**: {due_date_str}")
    md.append("")
    
    # Line Items section
    md.append("## Line Items")
    md.append("")
    
    line_items = data.get("lineItems", [])
    if line_items and len(line_items) > 0:
        # Create table header
        md.append("| Description | Quantity | Unit Price | Amount |")
        md.append("| ----------- | -------- | ---------- | ------ |")
        
        # Add each line item
        for item in line_items:
            description = item.get("description", "")
            quantity = item.get("quantity", "")
            unit_price = item.get("unitPrice", "")
            amount = item.get("amount", "")
            
            md.append(f"| {description} | {quantity} | {unit_price} | {amount} |")
    else:
        md.append("No line items found.")
    
    md.append("")
    
    # Totals section
    md.append("## Totals")
    subtotal = data.get("subtotalAmount", "N/A")
    tax = data.get("taxAmount", "N/A")
    discount = data.get("discountAmount", "N/A")
    total = data.get("totalAmount", "N/A")
    
    md.append(f"- **Subtotal**: {subtotal if subtotal != 'N/A' else 'N/A'}")
    md.append(f"- **Tax**: {tax if tax != 'N/A' else 'N/A'}")
    md.append(f"- **Discount**: {discount if discount != 'N/A' else 'N/A'}")
    md.append(f"- **Total**: {total if total != 'N/A' else 'N/A'}")
    
    # Handwritten notes section (if any)
    handwritten_notes = data.get("handwrittenNotes", [])
    if handwritten_notes and len(handwritten_notes) > 0:
        md.append("")
        md.append("## Handwritten Notes")
        for i, note in enumerate(handwritten_notes, 1):
            text = note.get("text", "")
            md.append(f"{i}. {text}")
    
    # Join all lines with newlines
    return "\n".join(md)

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
        
        # Create messages for Mistral API with simpler format
        # Mistral requires the image to be sent as part of the message content
        payload = {
            "model": "mistral-large-latest",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url", 
                            "image_url": {"url": f"data:{mime_type};base64,{base64_encoded}"}
                        }
                    ]
                }
            ],
            "max_tokens": 2000
        }
        
        # For now, let's simplify and focus on getting a valid response structure
        # We'll implement actual image handling once we understand the Mistral API expectations better
        
        # Debug the payload structure (without the actual base64 content)
        debug_payload = payload.copy()
        if "messages" in debug_payload and debug_payload["messages"]:
            for msg_idx, msg in enumerate(debug_payload["messages"]):
                if "content" in msg and isinstance(msg["content"], list):
                    for content_idx, content_item in enumerate(msg["content"]):
                        if isinstance(content_item, dict) and "image_url" in content_item:
                            debug_payload["messages"][msg_idx]["content"][content_idx]["image_url"]["url"] = "[BASE64_DATA]"
        
        print(f"Mistral API payload structure: {json.dumps(debug_payload, indent=2)[:500]}...")
        
        # Make API request with a timeout to avoid hanging indefinitely
        # Default to 30 seconds, can be adjusted based on expected response times
        timeout = 30  # seconds
        print(f"Making request to Mistral API with {timeout}s timeout...")
        
        response = requests.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=timeout
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
            error_response = {
                "vendorName": "",
                "vendorAddress": "",
                "vendorContact": "",
                "clientName": "",
                "clientAddress": "",
                "invoiceNumber": "",
                "totalAmount": 0,
                "currency": "",
                "paymentTerms": "",
                "paymentMethod": "",
                "lineItems": [],
                "handwrittenNotes": [],
                "additionalInfo": "",
                "confidenceScores": {
                    "overall": 80,
                    "vendorInfo": 80,
                    "invoiceDetails": 80,
                    "lineItems": 80,
                    "totals": 80,
                    "handwrittenNotes": 50,
                    "fieldSpecific": {}
                },
                "layoutData": [],
                "processingMetadata": {
                    "ocrEngine": "mistral",
                    "processingTime": 0,
                    "processingTimestamp": datetime.now().isoformat(),
                    "documentClassification": "invoice",
                    "error": "Empty response from Mistral AI"
                }
            }
            
            # Generate markdown output for error case
            markdown_output = generate_markdown_from_extraction(error_response)
            error_response["markdownOutput"] = markdown_output
            
            return json.dumps(error_response)
            
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
                
            # Create a standardized response structure based on template
            standardized_response = {
                "vendorName": parsed_json.get("vendorName", ""),
                "vendorAddress": parsed_json.get("vendorAddress", ""),
                "vendorContact": parsed_json.get("vendorContact", ""),
                "clientName": parsed_json.get("clientName", ""),
                "clientAddress": parsed_json.get("clientAddress", ""),
                "invoiceNumber": parsed_json.get("invoiceNumber", ""),
                "invoiceDate": parsed_json.get("invoiceDate", None),
                "dueDate": parsed_json.get("dueDate", None),
                "totalAmount": parsed_json.get("totalAmount", 0),
                "subtotalAmount": parsed_json.get("subtotalAmount", 0),
                "taxAmount": parsed_json.get("taxAmount", 0),
                "currency": parsed_json.get("currency", ""),
                "paymentTerms": parsed_json.get("paymentTerms", ""),
                "paymentMethod": parsed_json.get("paymentMethod", ""),
                "lineItems": parsed_json.get("lineItems", []),
                "handwrittenNotes": parsed_json.get("handwrittenNotes", []),
                "additionalInfo": parsed_json.get("additionalInfo", ""),
                "confidenceScores": {
                    "overall": 80,
                    "vendorInfo": 80,
                    "invoiceDetails": 80,
                    "lineItems": 80,
                    "totals": 80,
                    "handwrittenNotes": 50,
                    "fieldSpecific": {}
                },
                "layoutData": [],
                "processingMetadata": {
                    "ocrEngine": "mistral",
                    "processingTime": 0,
                    "processingTimestamp": datetime.now().isoformat(),
                    "documentClassification": "invoice"
                }
            }
            
            # Generate markdown output
            markdown_output = generate_markdown_from_extraction(standardized_response)
            standardized_response["markdownOutput"] = markdown_output
            
            return json.dumps(standardized_response)
            
        except json.JSONDecodeError as e:
            print(f"Mistral JSON decode error: {str(e)}")
            # If not valid JSON, create a basic JSON structure with standardized format
            error_response = {
                "vendorName": "",
                "vendorAddress": "",
                "vendorContact": "",
                "clientName": "",
                "clientAddress": "",
                "invoiceNumber": "",
                "totalAmount": 0,
                "currency": "",
                "paymentTerms": "",
                "paymentMethod": "",
                "lineItems": [],
                "handwrittenNotes": [],
                "additionalInfo": "",
                "confidenceScores": {
                    "overall": 80,
                    "vendorInfo": 80,
                    "invoiceDetails": 80,
                    "lineItems": 80,
                    "totals": 80,
                    "handwrittenNotes": 50,
                    "fieldSpecific": {}
                },
                "layoutData": [],
                "processingMetadata": {
                    "ocrEngine": "mistral",
                    "processingTime": 0,
                    "processingTimestamp": datetime.now().isoformat(),
                    "documentClassification": "invoice",
                    "error": f"Failed to parse JSON from Mistral response: {str(e)}"
                }
            }
            
            # Generate markdown output for error case
            markdown_output = generate_markdown_from_extraction(error_response)
            error_response["markdownOutput"] = markdown_output
            
            return json.dumps(error_response)
        
    except requests.exceptions.Timeout:
        print("Mistral API request timed out")
        error_response = {
            "vendorName": "",
            "vendorAddress": "",
            "vendorContact": "",
            "clientName": "",
            "clientAddress": "",
            "invoiceNumber": "",
            "totalAmount": 0,
            "currency": "",
            "paymentTerms": "",
            "paymentMethod": "",
            "lineItems": [],
            "handwrittenNotes": [],
            "additionalInfo": "",
            "confidenceScores": {
                "overall": 80,
                "vendorInfo": 80,
                "invoiceDetails": 80,
                "lineItems": 80,
                "totals": 80,
                "handwrittenNotes": 50,
                "fieldSpecific": {}
            },
            "layoutData": [],
            "processingMetadata": {
                "ocrEngine": "mistral",
                "processingTime": 0,
                "processingTimestamp": datetime.now().isoformat(),
                "documentClassification": "invoice",
                "error": "Mistral API request timed out after 30 seconds"
            }
        }
        
        # Generate markdown output for error case
        markdown_output = generate_markdown_from_extraction(error_response)
        error_response["markdownOutput"] = markdown_output
        
        return json.dumps(error_response)
    except requests.exceptions.ConnectionError:
        print("Mistral API connection error")
        error_response = {
            "vendorName": "",
            "vendorAddress": "",
            "vendorContact": "",
            "clientName": "",
            "clientAddress": "",
            "invoiceNumber": "",
            "totalAmount": 0,
            "currency": "",
            "paymentTerms": "",
            "paymentMethod": "",
            "lineItems": [],
            "handwrittenNotes": [],
            "additionalInfo": "",
            "confidenceScores": {
                "overall": 80,
                "vendorInfo": 80,
                "invoiceDetails": 80,
                "lineItems": 80,
                "totals": 80,
                "handwrittenNotes": 50,
                "fieldSpecific": {}
            },
            "layoutData": [],
            "processingMetadata": {
                "ocrEngine": "mistral",
                "processingTime": 0,
                "processingTimestamp": datetime.now().isoformat(),
                "documentClassification": "invoice",
                "error": "Failed to connect to Mistral API: connection error"
            }
        }
        
        # Generate markdown output for error case
        markdown_output = generate_markdown_from_extraction(error_response)
        error_response["markdownOutput"] = markdown_output
        
        return json.dumps(error_response)
    except Exception as e:
        error_message = str(e)
        print(f"Mistral API general error: {error_message}")
        error_response = {
            "vendorName": "",
            "vendorAddress": "",
            "vendorContact": "",
            "clientName": "",
            "clientAddress": "",
            "invoiceNumber": "",
            "totalAmount": 0,
            "currency": "",
            "paymentTerms": "",
            "paymentMethod": "",
            "lineItems": [],
            "handwrittenNotes": [],
            "additionalInfo": "",
            "confidenceScores": {
                "overall": 80,
                "vendorInfo": 80,
                "invoiceDetails": 80,
                "lineItems": 80,
                "totals": 80,
                "handwrittenNotes": 50,
                "fieldSpecific": {}
            },
            "layoutData": [],
            "processingMetadata": {
                "ocrEngine": "mistral",
                "processingTime": 0,
                "processingTimestamp": datetime.now().isoformat(),
                "documentClassification": "invoice",
                "error": f"Mistral API error: {error_message}"
            }
        }
        
        # Generate markdown output for error case
        markdown_output = generate_markdown_from_extraction(error_response)
        error_response["markdownOutput"] = markdown_output
        
        return json.dumps(error_response)