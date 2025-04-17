"""
Microsoft Azure Document Intelligence Service Module

This module handles document OCR processing using Azure Document Intelligence.
"""

import os
import json
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

# Get API credentials from environment
AZURE_DOC_INTELLIGENCE_KEY = os.environ.get("AZURE_DOC_INTELLIGENCE_KEY")
AZURE_DOC_INTELLIGENCE_ENDPOINT = os.environ.get("AZURE_DOC_INTELLIGENCE_ENDPOINT", 
                                    "https://document-intelligence.cognitiveservices.azure.com/")

# Ensure endpoint ends with a slash
if AZURE_DOC_INTELLIGENCE_ENDPOINT and not AZURE_DOC_INTELLIGENCE_ENDPOINT.endswith('/'):
    AZURE_DOC_INTELLIGENCE_ENDPOINT = f"{AZURE_DOC_INTELLIGENCE_ENDPOINT}/"

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
    if not AZURE_DOC_INTELLIGENCE_KEY:
        raise ValueError("Azure Document Intelligence key not found in environment variables")
    
    if not AZURE_DOC_INTELLIGENCE_ENDPOINT:
        raise ValueError("Azure Document Intelligence endpoint not found in environment variables")
    
    try:
        # Use REST API directly instead of SDK to avoid dependency issues
        analyze_url = f"{AZURE_DOC_INTELLIGENCE_ENDPOINT}documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31"
        
        # Log the endpoint for debugging (without the sensitive key)
        print(f"Using Azure Document Intelligence endpoint: {AZURE_DOC_INTELLIGENCE_ENDPOINT}")
        
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
        
        # Add processing metadata
        extracted_data["processingMetadata"] = {
            "ocrEngine": "ms-document-intelligence",
            "processingTime": 0,  # We don't track this in this implementation
            "processingTimestamp": result.get("createdDateTime", ""),
            "documentClassification": "Invoice"
        }
        
        return json.dumps(extracted_data)
        
    except Exception as e:
        error_message = str(e)
        return json.dumps({
            "vendorName": "",
            "invoiceNumber": "",
            "totalAmount": 0,
            "lineItems": [],
            "handwrittenNotes": [],
            "error": f"Azure Document Intelligence error: {error_message}"
        })