"""
Microsoft Azure Document Intelligence Service Module

This module handles document OCR processing using Azure Document Intelligence.
"""

import os
import json
from datetime import datetime
from dotenv import load_dotenv
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest

# Load environment variables
load_dotenv(override=True)

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

def extract_invoice_data(file_content):
    """
    Process an invoice using Azure Document Intelligence
    
    Args:
        file_content (bytes): The content of the file in binary format
        
    Returns:
        list: The extracted data in the format matching Azure Document Intelligence API
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
        
    # Ensure endpoint doesn't end with a slash
    if AZURE_DOC_INTELLIGENCE_ENDPOINT.endswith('/'):
        AZURE_DOC_INTELLIGENCE_ENDPOINT = AZURE_DOC_INTELLIGENCE_ENDPOINT[:-1]
    
    try:
        # Create client
        document_intelligence_client = DocumentIntelligenceClient(
            endpoint=AZURE_DOC_INTELLIGENCE_ENDPOINT, 
            credential=AzureKeyCredential(AZURE_DOC_INTELLIGENCE_KEY)
        )
        
        # Log the process
        print(f"Using Azure Document Intelligence at: {AZURE_DOC_INTELLIGENCE_ENDPOINT}")
        print(f"Processing document...")
        
        # Start analysis process
        poller = document_intelligence_client.begin_analyze_document(
            "prebuilt-invoice", 
            AnalyzeDocumentRequest(bytes_source=file_content)
        )
        
        # Wait for the result
        invoices = poller.result()
        
        # Helper functions for serialization
        def serialize_address(address_value):
            if address_value:
                return str(address_value)
            return None

        def serialize_currency(currency_value):
            if currency_value:
                return {
                    "amount": currency_value.amount,
                    "currency_symbol": currency_value.currency_symbol
                }
            return None
        
        # Extract invoice data
        extracted_invoices = []
        
        # Process each document
        for idx, invoice in enumerate(invoices.documents):
            invoice_data = {
                "vendor_name": None,
                "vendor_address": None,
                "vendor_address_recipient": None,
                "customer_name": None,
                "customer_id": None,
                "customer_address": None,
                "customer_address_recipient": None,
                "invoice_id": None,
                "invoice_date": None,
                "invoice_total": None,
                "due_date": None,
                "purchase_order": None,
                "billing_address": None,
                "billing_address_recipient": None,
                "shipping_address": None,
                "shipping_address_recipient": None,
                "items": [],
                "subtotal": None,
                "total_tax": None,
                "previous_unpaid_balance": None,
                "amount_due": None,
                "service_start_date": None,
                "service_end_date": None,
                "service_address": None,
                "service_address_recipient": None,
                "remittance_address": None,
                "remittance_address_recipient": None,
            }
            
            # Extract vendor details
            vendor_name = invoice.fields.get("VendorName")
            if vendor_name:
                invoice_data["vendor_name"] = {
                    "value": vendor_name.value_string
                }
                
            vendor_address = invoice.fields.get("VendorAddress")
            if vendor_address:
                invoice_data["vendor_address"] = {
                    "value": serialize_address(vendor_address.value_address)
                }
                
            vendor_address_recipient = invoice.fields.get("VendorAddressRecipient")
            if vendor_address_recipient:
                invoice_data["vendor_address_recipient"] = {
                    "value": vendor_address_recipient.value_string
                }
                
            # Extract customer details
            customer_name = invoice.fields.get("CustomerName")
            if customer_name:
                invoice_data["customer_name"] = {
                    "value": customer_name.value_string
                }
                
            customer_id = invoice.fields.get("CustomerId")
            if customer_id:
                invoice_data["customer_id"] = {
                    "value": customer_id.value_string
                }
                
            customer_address = invoice.fields.get("CustomerAddress")
            if customer_address:
                invoice_data["customer_address"] = {
                    "value": serialize_address(customer_address.value_address)
                }
                
            customer_address_recipient = invoice.fields.get("CustomerAddressRecipient")
            if customer_address_recipient:
                invoice_data["customer_address_recipient"] = {
                    "value": customer_address_recipient.value_string
                }
                
            # Extract invoice details
            invoice_id = invoice.fields.get("InvoiceId")
            if invoice_id:
                invoice_data["invoice_id"] = {
                    "value": invoice_id.value_string
                }
                
            invoice_date = invoice.fields.get("InvoiceDate")
            if invoice_date:
                invoice_data["invoice_date"] = {
                    "value": invoice_date.value_date.isoformat() if invoice_date.value_date else None
                }
                
            invoice_total = invoice.fields.get("InvoiceTotal")
            if invoice_total:
                invoice_data["invoice_total"] = {
                    "value": serialize_currency(invoice_total.value_currency)
                }
                
            due_date = invoice.fields.get("DueDate")
            if due_date:
                invoice_data["due_date"] = {
                    "value": due_date.value_date.isoformat() if due_date.value_date else None
                }
                
            purchase_order = invoice.fields.get("PurchaseOrder")
            if purchase_order:
                invoice_data["purchase_order"] = {
                    "value": purchase_order.value_string
                }
                
            # Extract billing and shipping details
            billing_address = invoice.fields.get("BillingAddress")
            if billing_address:
                invoice_data["billing_address"] = {
                    "value": serialize_address(billing_address.value_address)
                }
                
            billing_address_recipient = invoice.fields.get("BillingAddressRecipient")
            if billing_address_recipient:
                invoice_data["billing_address_recipient"] = {
                    "value": billing_address_recipient.value_string
                }
                
            shipping_address = invoice.fields.get("ShippingAddress")
            if shipping_address:
                invoice_data["shipping_address"] = {
                    "value": serialize_address(shipping_address.value_address)
                }
                
            shipping_address_recipient = invoice.fields.get("ShippingAddressRecipient")
            if shipping_address_recipient:
                invoice_data["shipping_address_recipient"] = {
                    "value": shipping_address_recipient.value_string
                }
                
            # Extract invoice items
            items = invoice.fields.get("Items")
            if items:
                for item in items.value_array:
                    item_data = {}
                    
                    item_description = item.value_object.get("Description")
                    if item_description:
                        item_data["description"] = {
                            "value": item_description.value_string
                        }
                        
                    item_quantity = item.value_object.get("Quantity")
                    if item_quantity:
                        item_data["quantity"] = {
                            "value": item_quantity.value_number
                        }
                        
                    unit = item.value_object.get("Unit")
                    if unit:
                        item_data["unit"] = {
                            "value": unit.value_string
                        }
                        
                    unit_price = item.value_object.get("UnitPrice")
                    if unit_price:
                        item_data["unit_price"] = {
                            "value": serialize_currency(unit_price.value_currency)
                        }
                        
                    product_code = item.value_object.get("ProductCode")
                    if product_code:
                        item_data["product_code"] = {
                            "value": product_code.value_string
                        }
                        
                    item_date = item.value_object.get("Date")
                    if item_date:
                        item_data["date"] = {
                            "value": item_date.value_date.isoformat() if item_date.value_date else None
                        }
                        
                    tax = item.value_object.get("Tax")
                    if tax:
                        item_data["tax"] = {
                            "value": serialize_currency(tax.value_currency) if hasattr(tax, "value_currency") else tax.value_string
                        }
                        
                    amount = item.value_object.get("Amount")
                    if amount:
                        item_data["amount"] = {
                            "value": serialize_currency(amount.value_currency)
                        }
                        
                    invoice_data["items"].append(item_data)
                    
            # Extract additional invoice totals
            subtotal = invoice.fields.get("SubTotal")
            if subtotal:
                invoice_data["subtotal"] = {
                    "value": serialize_currency(subtotal.value_currency)
                }
                
            total_tax = invoice.fields.get("TotalTax")
            if total_tax:
                invoice_data["total_tax"] = {
                    "value": serialize_currency(total_tax.value_currency)
                }
                
            previous_unpaid_balance = invoice.fields.get("PreviousUnpaidBalance")
            if previous_unpaid_balance:
                invoice_data["previous_unpaid_balance"] = {
                    "value": serialize_currency(previous_unpaid_balance.value_currency)
                }
                
            amount_due = invoice.fields.get("AmountDue")
            if amount_due:
                invoice_data["amount_due"] = {
                    "value": serialize_currency(amount_due.value_currency)
                }
                
            # Add custom fields for our system
            invoice_data["status"] = "success"
            invoice_data["auto_navigation"] = True
            
            # Convert extracted data to our internal format for markdown generation
            internal_format = {
                "vendorName": invoice_data.get("vendor_name", {}).get("value", "") if invoice_data.get("vendor_name") else "",
                "vendorAddress": invoice_data.get("vendor_address", {}).get("value", "") if invoice_data.get("vendor_address") else "",
                "vendorContact": invoice_data.get("vendor_address_recipient", {}).get("value", "") if invoice_data.get("vendor_address_recipient") else "",
                "clientName": invoice_data.get("customer_name", {}).get("value", "") if invoice_data.get("customer_name") else "",
                "clientAddress": invoice_data.get("customer_address", {}).get("value", "") if invoice_data.get("customer_address") else "",
                "invoiceNumber": invoice_data.get("invoice_id", {}).get("value", "") if invoice_data.get("invoice_id") else "",
                "invoiceDate": invoice_data.get("invoice_date", {}).get("value", "") if invoice_data.get("invoice_date") else "",
                "dueDate": invoice_data.get("due_date", {}).get("value", "") if invoice_data.get("due_date") else "",
                "totalAmount": invoice_data.get("invoice_total", {}).get("value", {}).get("amount", 0) if invoice_data.get("invoice_total") and invoice_data.get("invoice_total").get("value") else 0,
                "subtotalAmount": invoice_data.get("subtotal", {}).get("value", {}).get("amount", 0) if invoice_data.get("subtotal") and invoice_data.get("subtotal").get("value") else 0,
                "taxAmount": invoice_data.get("total_tax", {}).get("value", {}).get("amount", 0) if invoice_data.get("total_tax") and invoice_data.get("total_tax").get("value") else 0,
                "currency": invoice_data.get("invoice_total", {}).get("value", {}).get("currency_symbol", "") if invoice_data.get("invoice_total") and invoice_data.get("invoice_total").get("value") else "",
                "lineItems": [],
                "handwrittenNotes": []
            }
            
            # Convert line items to our internal format
            for item in invoice_data.get("items", []):
                line_item = {
                    "description": item.get("description", {}).get("value", "") if item.get("description") else "",
                    "quantity": item.get("quantity", {}).get("value", 0) if item.get("quantity") else 0,
                    "unitPrice": item.get("unit_price", {}).get("value", {}).get("amount", 0) if item.get("unit_price") and item.get("unit_price").get("value") else 0,
                    "amount": item.get("amount", {}).get("value", {}).get("amount", 0) if item.get("amount") and item.get("amount").get("value") else 0,
                    "itemCode": item.get("product_code", {}).get("value", "") if item.get("product_code") else "",
                    "confidence": 0.9  # Default confidence score
                }
                internal_format["lineItems"].append(line_item)
                
            # Generate markdown output
            markdown_output = generate_markdown_from_extraction(internal_format)
            
            # Add markdown output to the invoice data
            invoice_data["markdownOutput"] = markdown_output
            
            extracted_invoices.append(invoice_data)
            
        return extracted_invoices
        
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
            "invoice_total": {"value": {"amount": 0, "currency_symbol": None}},
            "items": [],
            "status": "error",
            "error": f"Azure Document Intelligence error: {error_message}",
            "markdownOutput": markdown_output,
            "auto_navigation": False
        }]
        
        # Return the error_response as a list with a single dictionary
        return error_response