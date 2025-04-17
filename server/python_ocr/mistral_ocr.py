"""
Mistral OCR Service Module

This module handles document OCR processing using Mistral AI.
"""

import os
import json
import base64
import re
import uuid
import tempfile
from datetime import datetime
from dotenv import load_dotenv
from mistralai import Mistral

# Load environment variables
load_dotenv(override=True)

# Get API key from environment
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY")

# Extraction query for invoice processing
EXTRACTION_QUERY = """
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

def extract_json_from_text(text):
    """
    Extract JSON from text that may include markdown or other content
    
    Args:
        text (str): The text containing JSON data
        
    Returns:
        str: Extracted JSON string
    """
    # First try to find JSON within markdown code blocks
    json_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
    json_matches = re.findall(json_pattern, text)
    
    if json_matches:
        # Use the first JSON block found
        result = json_matches[0].strip()
    else:
        # Try to find JSON with opening/closing braces if no code blocks found
        brace_pattern = r'(\{[\s\S]*\})'
        brace_matches = re.findall(brace_pattern, text)
        if brace_matches:
            result = brace_matches[0].strip()
        else:
            # No JSON found
            result = text.strip()
    
    # Additional cleanup to ensure we have valid JSON
    if result.startswith('```'):
        result = result.lstrip('`')
    if result.endswith('```'):
        result = result.rstrip('`')
    
    return result

def create_error_response(error_message, processing_time=0):
    """
    Create a standardized error response
    
    Args:
        error_message (str): The error message
        processing_time (float): The processing time in seconds
        
    Returns:
        dict: Standardized error response
    """
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
            "overall": 0,
            "vendorInfo": 0,
            "invoiceDetails": 0,
            "lineItems": 0,
            "totals": 0,
            "handwrittenNotes": 0,
            "fieldSpecific": {}
        },
        "layoutData": [],
        "processingMetadata": {
            "ocrEngine": "mistral",
            "processingTime": processing_time,
            "processingTimestamp": datetime.now().isoformat(),
            "documentClassification": "invoice",
            "error": error_message
        }
    }
    
    # Generate markdown output for error case
    markdown_output = generate_markdown_from_extraction(error_response)
    error_response["markdownOutput"] = markdown_output
    
    return error_response

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
    
    print(f"Processing document with content type: {content_type} using Mistral")
    
    # Create Mistral client
    client = Mistral(api_key=MISTRAL_API_KEY)
    
    # Determine if it's a PDF file
    is_pdf = content_type == "application/pdf"
    
    start_time = datetime.now()
    
    try:
        if is_pdf:
            print("Processing PDF file with Mistral service...")
            
            # For PDFs, upload the file and get a signed URL
            uploaded_file = client.files.upload(
                file={
                    "file_name": f"invoice_document_{uuid.uuid4()}.pdf",
                    "content": file_content
                },
                purpose="ocr"
            )
            
            # Get a signed URL for the uploaded file
            signed_url = client.files.get_signed_url(file_id=uploaded_file.id)
            
            print(f"File uploaded to Mistral with ID: {uploaded_file.id}")
            
            # Using the document understanding capability with the signed URL
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": EXTRACTION_QUERY
                        },
                        {
                            "type": "document_url",
                            "document_url": signed_url.url
                        }
                    ]
                }
            ]
            
            # Use an appropriate model for document understanding
            chat_response = client.chat.complete(
                model="mistral-small-latest",  # or mistral-medium-latest for better accuracy
                messages=messages
            )
            
            # Clean up by deleting the uploaded file
            try:
                client.files.delete(file_id=uploaded_file.id)
                print(f"Successfully deleted file {uploaded_file.id} from Mistral")
            except Exception as e:
                print(f"Warning: Could not delete file {uploaded_file.id} from Mistral: {str(e)}")
                
        else:
            # For images and other formats, use base64 encoding
            print("Processing image file with Mistral service...")
            
            # Convert file to base64
            base64_image = base64.b64encode(file_content).decode('utf-8')
            data_uri = f"data:{content_type};base64,{base64_image}"
            
            # Create messages for chat completion
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": EXTRACTION_QUERY
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": data_uri
                            }
                        }
                    ]
                }
            ]
            
            # Use an appropriate model for image understanding
            chat_response = client.chat.complete(
                model="mistral-small-latest",  # or mistral-medium-latest
                messages=messages
            )
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        print(f"Mistral processing completed in {processing_time:.2f} seconds")
        
        # Get the extracted text from the response
        if not hasattr(chat_response, 'choices') or not chat_response.choices:
            print("WARNING: Empty content from Mistral AI")
            error_resp = create_error_response("Empty response from Mistral AI", processing_time)
            return json.dumps(error_resp)
            
        # Extract the content from the response
        extracted_text = chat_response.choices[0].message.content
        if not extracted_text:
            print("WARNING: Empty content from Mistral AI")
            error_resp = create_error_response("Empty content from Mistral AI", processing_time)
            return json.dumps(error_resp)
            
        print(f"Received response from Mistral: {len(extracted_text)} chars")
        
        # Extract JSON from the response text
        result = extract_json_from_text(extracted_text)
        
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
                "invoiceDate": parsed_json.get("invoiceDate", ""),
                "dueDate": parsed_json.get("dueDate", ""),
                "totalAmount": parsed_json.get("totalAmount", 0),
                "subtotalAmount": parsed_json.get("subtotalAmount", 0),
                "taxAmount": parsed_json.get("taxAmount", 0),
                "discountAmount": parsed_json.get("discountAmount", 0),
                "currency": parsed_json.get("currency", ""),
                "paymentTerms": parsed_json.get("paymentTerms", ""),
                "paymentMethod": parsed_json.get("paymentMethod", ""),
                "lineItems": parsed_json.get("lineItems", []),
                "handwrittenNotes": parsed_json.get("handwrittenNotes", []),
                "additionalInfo": parsed_json.get("additionalInfo", ""),
                "confidenceScores": {
                    "overall": 85,
                    "vendorInfo": 85,
                    "invoiceDetails": 85,
                    "lineItems": 85,
                    "totals": 85,
                    "handwrittenNotes": 70,
                    "fieldSpecific": {}
                },
                "layoutData": [],
                "processingMetadata": {
                    "ocrEngine": "mistral",
                    "processingTime": processing_time,
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
            error_resp = create_error_response(f"Failed to parse JSON from Mistral response: {str(e)}", processing_time)
            return json.dumps(error_resp)
        
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds()
        error_message = str(e)
        print(f"Mistral AI service error: {error_message}")
        error_resp = create_error_response(f"Mistral AI service error: {error_message}", processing_time)
        return json.dumps(error_resp)