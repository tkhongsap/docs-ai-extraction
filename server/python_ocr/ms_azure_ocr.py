"""
Microsoft Azure Document Intelligence Service Module

This module handles document OCR processing using Azure Document Intelligence.
"""

import os
import json
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

# Don't get API credentials globally 
# We'll get them inside the function instead to ensure they're always fresh

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

def format_currency(currency_value):
    """Format currency value from Azure response"""
    if not currency_value:
        return None
    
    # Remove currency symbols and convert to float
    value_str = str(currency_value)
    value_str = ''.join(c for c in value_str if c.isdigit() or c == '.' or c == ',')
    value_str = value_str.replace(',', '')
    
    try:
        return float(value_str)
    except ValueError:
        return None

def extract_invoice_data(file_content):
    """
    Process an invoice using Azure Document Intelligence
    
    Args:
        file_content (bytes): The content of the file in binary format
        
    Returns:
        str: The extracted data in JSON string format
    """
    # Load environment variables inside the function to ensure they're always fresh
    load_dotenv(override=True)
    
    # Get API credentials
    AZURE_DOC_INTELLIGENCE_KEY = os.environ.get("AZURE_DOC_INTELLIGENCE_KEY", "")
    AZURE_DOC_INTELLIGENCE_ENDPOINT = os.environ.get("AZURE_DOC_INTELLIGENCE_ENDPOINT", "")
    
    # Validate API key and endpoint
    if not AZURE_DOC_INTELLIGENCE_KEY:
        raise ValueError("Azure Document Intelligence key not found in environment variables")
    
    if not AZURE_DOC_INTELLIGENCE_ENDPOINT:
        raise ValueError("Azure Document Intelligence endpoint not found in environment variables")
        
    # Ensure endpoint ends with a slash
    if not AZURE_DOC_INTELLIGENCE_ENDPOINT.endswith('/'):
        AZURE_DOC_INTELLIGENCE_ENDPOINT = f"{AZURE_DOC_INTELLIGENCE_ENDPOINT}/"
    
    try:
        # Check if the key and endpoint might be swapped
        if AZURE_DOC_INTELLIGENCE_KEY and (AZURE_DOC_INTELLIGENCE_KEY.startswith('http://') or AZURE_DOC_INTELLIGENCE_KEY.startswith('https://')):
            print(f"Warning: Key and endpoint appear to be swapped! Attempting to fix automatically...")
            
            # Check if the endpoint looks like a key (not starting with http)
            if AZURE_DOC_INTELLIGENCE_ENDPOINT and not AZURE_DOC_INTELLIGENCE_ENDPOINT.startswith('http'):
                print(f"Auto-fixing: Swapping key and endpoint values")
                # Swap them
                AZURE_DOC_INTELLIGENCE_KEY, AZURE_DOC_INTELLIGENCE_ENDPOINT = AZURE_DOC_INTELLIGENCE_ENDPOINT, AZURE_DOC_INTELLIGENCE_KEY
                print(f"After swap - Key length: {len(AZURE_DOC_INTELLIGENCE_KEY)}, Endpoint starts with: {AZURE_DOC_INTELLIGENCE_ENDPOINT[:15]}...")
            else:
                print(f"Warning: AZURE_DOC_INTELLIGENCE_KEY appears to be a URL but endpoint also looks like a URL")
                raise ValueError("Azure Document Intelligence key appears to be a URL instead of an API key")
            
        # Check if the endpoint is properly formatted after potential swap
        if not AZURE_DOC_INTELLIGENCE_ENDPOINT.startswith('https://'):
            print(f"Warning: AZURE_DOC_INTELLIGENCE_ENDPOINT is not a valid HTTPS URL")
            raise ValueError("Azure Document Intelligence endpoint must be a valid HTTPS URL")
        
        # Use REST API directly instead of SDK to avoid dependency issues
        # Azure Document Intelligence has two possible API endpoints patterns
        # Try to determine the right one based on the endpoint URL
        
        # The modern endpoint pattern (new resource names)
        if "document-intelligence" in AZURE_DOC_INTELLIGENCE_ENDPOINT.lower():
            analyze_url = f"{AZURE_DOC_INTELLIGENCE_ENDPOINT}documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31"
        # The legacy endpoint pattern (old Form Recognizer resources)
        elif "formrecognizer" in AZURE_DOC_INTELLIGENCE_ENDPOINT.lower():
            analyze_url = f"{AZURE_DOC_INTELLIGENCE_ENDPOINT}formrecognizer/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31"
        # If neither pattern matches, use the modern pattern but log a warning
        else:
            print(f"Warning: Could not determine Azure endpoint pattern from {AZURE_DOC_INTELLIGENCE_ENDPOINT}")
            analyze_url = f"{AZURE_DOC_INTELLIGENCE_ENDPOINT}documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31"
        
        # Log the endpoint for debugging (without the sensitive key)
        print(f"Using Azure Document Intelligence endpoint: {AZURE_DOC_INTELLIGENCE_ENDPOINT}")
        print(f"Using analyze URL: {analyze_url}")
        
        headers = {
            "Content-Type": "application/octet-stream",
            "Ocp-Apim-Subscription-Key": AZURE_DOC_INTELLIGENCE_KEY
        }
        
        # Set up parameters for the invoice analysis
        params = {
            "features": "indices,ocrHighResolution",
            "locale": "en"
        }
        
        # Send the request
        response = requests.post(analyze_url, headers=headers, params=params, data=file_content)
        
        # Handle errors
        if response.status_code != 202:
            error_detail = response.text
            try:
                error_json = response.json()
                if 'error' in error_json:
                    error_detail = error_json['error'].get('message', error_detail)
            except:
                pass
            
            raise ValueError(f"Azure Document Intelligence request failed with status {response.status_code}: {error_detail}")
        
        # Get the operation location for polling
        operation_location = response.headers.get("Operation-Location")
        if not operation_location:
            raise ValueError("No Operation-Location header in response")
        
        # Poll the operation status
        headers = {"Ocp-Apim-Subscription-Key": AZURE_DOC_INTELLIGENCE_KEY}
        
        # Simple polling mechanism - in production, use exponential backoff
        import time
        max_retries = 10
        retry_delay = 1  # seconds
        result = None  # Initialize result to avoid "possibly unbound" error
        
        for retry in range(max_retries):
            result_response = requests.get(operation_location, headers=headers)
            result = result_response.json()
            
            if result.get("status") == "succeeded":
                # Process successful result
                break
            
            if result.get("status") == "failed":
                error_detail = "Unknown error"
                if 'errors' in result and result['errors']:
                    error_detail = result['errors'][0].get('message', "Unknown error")
                raise ValueError(f"Azure Document Intelligence analysis failed: {error_detail}")
            
            # Wait before polling again
            time.sleep(retry_delay)
            
        # If we've exhausted retries without success or failure status
        if result is None or result.get("status") != "succeeded":
            raise ValueError("Azure Document Intelligence analysis timed out")
        
        # Extract invoice data from the result
        def serialize_address(address_value):
            if not address_value:
                return ""
            return ' '.join([str(part) for part in address_value.values() if part])
        
        def serialize_currency(currency_value):
            if not currency_value:
                return None
            
            amount = format_currency(currency_value.get('amount'))
            return amount
        
        # Extract invoice data
        extracted_data = {
            "vendorName": "",
            "vendorAddress": "",
            "vendorContact": "",
            "clientName": "",
            "clientAddress": "",
            "invoiceNumber": "",
            "invoiceDate": None,
            "dueDate": None,
            "totalAmount": 0,
            "subtotalAmount": 0,
            "taxAmount": 0,
            "currency": "USD",
            "lineItems": [],
            "handwrittenNotes": []
        }
        
        # Parse the document analysis result
        if "analyzeResult" in result:
            document = result["analyzeResult"]["documents"][0]
            fields = document.get("fields", {})
            
            # Basic invoice fields
            if "VendorName" in fields and fields["VendorName"].get("valueString"):
                extracted_data["vendorName"] = fields["VendorName"]["valueString"]
                
            if "VendorAddress" in fields and fields["VendorAddress"].get("valueString"):
                extracted_data["vendorAddress"] = fields["VendorAddress"]["valueString"]
                
            if "CustomerName" in fields and fields["CustomerName"].get("valueString"):
                extracted_data["clientName"] = fields["CustomerName"]["valueString"]
                
            if "CustomerAddress" in fields and fields["CustomerAddress"].get("valueString"):
                extracted_data["clientAddress"] = fields["CustomerAddress"]["valueString"]
                
            if "InvoiceId" in fields and fields["InvoiceId"].get("valueString"):
                extracted_data["invoiceNumber"] = fields["InvoiceId"]["valueString"]
            
            # Contact information - combine phone and email if available
            vendor_phone = fields.get("VendorPhoneNumber", {}).get("valueString", "")
            vendor_email = fields.get("VendorEmail", {}).get("valueString", "")
            
            if vendor_phone or vendor_email:
                contact_parts = []
                if vendor_phone:
                    contact_parts.append(vendor_phone)
                if vendor_email:
                    contact_parts.append(vendor_email)
                extracted_data["vendorContact"] = ", ".join(contact_parts)
            
            # Date fields
            if "InvoiceDate" in fields and fields["InvoiceDate"].get("valueDate"):
                extracted_data["invoiceDate"] = fields["InvoiceDate"]["valueDate"]
                
            if "DueDate" in fields and fields["DueDate"].get("valueDate"):
                extracted_data["dueDate"] = fields["DueDate"]["valueDate"]
            
            # Amount fields
            if "InvoiceTotal" in fields and fields["InvoiceTotal"].get("valueCurrency"):
                extracted_data["totalAmount"] = serialize_currency(fields["InvoiceTotal"]["valueCurrency"])
                
                # Get currency code if available
                currency_code = fields["InvoiceTotal"]["valueCurrency"].get("currencyCode")
                if currency_code:
                    extracted_data["currency"] = currency_code
                
            if "SubTotal" in fields and fields["SubTotal"].get("valueCurrency"):
                extracted_data["subtotalAmount"] = serialize_currency(fields["SubTotal"]["valueCurrency"])
                
            if "TotalTax" in fields and fields["TotalTax"].get("valueCurrency"):
                extracted_data["taxAmount"] = serialize_currency(fields["TotalTax"]["valueCurrency"])
            
            # Line items
            if "Items" in fields and fields["Items"].get("valueArray"):
                items = fields["Items"]["valueArray"]
                for item in items:
                    item_properties = item.get("valueObject", {}).get("properties", {})
                    
                    description = item_properties.get("Description", {}).get("valueString", "")
                    quantity = item_properties.get("Quantity", {}).get("valueNumber", 0)
                    
                    # Unit price
                    unit_price = 0
                    if "UnitPrice" in item_properties and item_properties["UnitPrice"].get("valueCurrency"):
                        unit_price = serialize_currency(item_properties["UnitPrice"]["valueCurrency"])
                    
                    # Amount
                    amount = 0
                    if "Amount" in item_properties and item_properties["Amount"].get("valueCurrency"):
                        amount = serialize_currency(item_properties["Amount"]["valueCurrency"])
                    
                    # Item code
                    item_code = item_properties.get("ProductCode", {}).get("valueString", "")
                    
                    line_item = {
                        "description": description,
                        "quantity": quantity,
                        "unitPrice": unit_price or 0,
                        "amount": amount or 0,
                        "itemCode": item_code,
                        "confidence": 0.9  # Default confidence for Azure
                    }
                    
                    extracted_data["lineItems"].append(line_item)
        
        # Add confidence scores
        extracted_data["confidenceScores"] = {
            "overall": 0.85,  # Default value
            "vendorInfo": 0.90 if extracted_data["vendorName"] else 0.5,
            "invoiceDetails": 0.90 if extracted_data["invoiceNumber"] else 0.5,
            "lineItems": 0.85 if extracted_data["lineItems"] else 0.5,
            "totals": 0.90 if extracted_data["totalAmount"] and float(extracted_data["totalAmount"]) > 0 else 0.5,
            "handwrittenNotes": 0.0  # Azure doesn't explicitly handle handwritten notes
        }
        
        # Create a response in the format matching the example/ms_azure_response.txt
        # This format matches what Azure Document Intelligence returns
        standardized_response = [{
            "vendor_name": {
                "value": extracted_data.get("vendorName", "")
            },
            "vendor_address": {
                "value": extracted_data.get("vendorAddress", "")
            },
            "vendor_address_recipient": {
                "value": extracted_data.get("vendorContact", "")
            },
            "customer_name": {
                "value": extracted_data.get("clientName", "")
            },
            "customer_id": {
                "value": ""
            },
            "customer_address": {
                "value": extracted_data.get("clientAddress", "")
            },
            "customer_address_recipient": {
                "value": ""
            },
            "invoice_id": {
                "value": extracted_data.get("invoiceNumber", "")
            },
            "invoice_date": {
                "value": extracted_data.get("invoiceDate").isoformat() if isinstance(extracted_data.get("invoiceDate"), datetime) else extracted_data.get("invoiceDate", "")
            },
            "invoice_total": {
                "value": {
                    "amount": float(extracted_data.get("totalAmount", 0)) if extracted_data.get("totalAmount") else 0,
                    "currency_symbol": None
                }
            },
            "due_date": None if not extracted_data.get("dueDate") else {
                "value": extracted_data.get("dueDate").isoformat() if isinstance(extracted_data.get("dueDate"), datetime) else extracted_data.get("dueDate", "")
            },
            "purchase_order": {
                "value": ""
            },
            "billing_address": None,
            "billing_address_recipient": None,
            "shipping_address": {
                "value": ""
            },
            "shipping_address_recipient": {
                "value": ""
            },
            "items": [],
            "subtotal": {
                "value": {
                    "amount": float(extracted_data.get("subtotalAmount", 0)) if extracted_data.get("subtotalAmount") else 0,
                    "currency_symbol": None
                }
            },
            "total_tax": {
                "value": {
                    "amount": float(extracted_data.get("taxAmount", 0)) if extracted_data.get("taxAmount") else 0,
                    "currency_symbol": None
                }
            },
            "previous_unpaid_balance": None,
            "amount_due": None,
            "service_start_date": None,
            "service_end_date": None,
            "service_address": None,
            "service_address_recipient": None,
            "remittance_address": None,
            "remittance_address_recipient": None,
            
            # Additional fields for our system
            "status": "success"
        }]
        
        # Add line items
        for item in extracted_data.get("lineItems", []):
            formatted_item = {
                "description": {
                    "value": item.get("description", "")
                },
                "quantity": {
                    "value": float(item.get("quantity", 0))
                },
                "unit": {
                    "value": None
                },
                "unit_price": {
                    "value": {
                        "amount": float(item.get("unitPrice", 0)),
                        "currency_symbol": None
                    }
                },
                "product_code": {
                    "value": item.get("itemCode", "")
                },
                "amount": {
                    "value": {
                        "amount": float(item.get("amount", 0)),
                        "currency_symbol": None
                    }
                }
            }
            standardized_response[0]["items"].append(formatted_item)
        
        # Convert back to the internal format for markdown generation
        internal_format = {
            "vendorName": extracted_data.get("vendorName", ""),
            "vendorAddress": extracted_data.get("vendorAddress", ""),
            "vendorContact": extracted_data.get("vendorContact", ""),
            "clientName": extracted_data.get("clientName", ""),
            "clientAddress": extracted_data.get("clientAddress", ""),
            "invoiceNumber": extracted_data.get("invoiceNumber", ""),
            "invoiceDate": extracted_data.get("invoiceDate", ""),
            "dueDate": extracted_data.get("dueDate", ""),
            "totalAmount": extracted_data.get("totalAmount", 0),
            "subtotalAmount": extracted_data.get("subtotalAmount", 0),
            "taxAmount": extracted_data.get("taxAmount", 0),
            "currency": extracted_data.get("currency", ""),
            "lineItems": extracted_data.get("lineItems", []),
            "handwrittenNotes": extracted_data.get("handwrittenNotes", [])
        }
        
        # Generate markdown output
        markdown_output = generate_markdown_from_extraction(internal_format)
        
        # Add our custom fields needed by the frontend
        standardized_response[0]["markdownOutput"] = markdown_output
        standardized_response[0]["auto_navigation"] = True
        
        # Return the standardized_response as a dictionary instead of a JSON string
        # This allows the FastAPI to properly serialize it
        return standardized_response
        
    except Exception as e:
        error_message = str(e)
        print(f"Azure Document Intelligence error: {error_message}")
        
        # Create error response in the same format as success but with error details
        internal_error = {
            "vendorName": "Error processing document",
            "vendorAddress": "",
            "vendorContact": "",
            "clientName": "",
            "clientAddress": "",
            "invoiceNumber": "Error",
            "totalAmount": 0,
            "currency": "",
            "lineItems": [],
            "handwrittenNotes": [],
            "additionalInfo": f"Error: {error_message}"
        }
        
        # Generate markdown output for error case
        markdown_output = generate_markdown_from_extraction(internal_error)
        
        # Create error response in the format that matches Azure Document Intelligence output
        error_response = [{
            "vendor_name": {"value": "Error processing document"},
            "vendor_address": {"value": ""},
            "customer_name": {"value": ""},
            "customer_address": {"value": ""},
            "invoice_id": {"value": "Error"},
            "invoice_date": {"value": ""},
            "invoice_total": {"value": {"amount": 0, "currency_symbol": null}},
            "items": [],
            "status": "error",
            "error": f"Azure Document Intelligence error: {error_message}",
            "markdownOutput": markdown_output,
            "auto_navigation": False
        }]
        
        # Return the error_response as a list with a single dictionary
        return error_response