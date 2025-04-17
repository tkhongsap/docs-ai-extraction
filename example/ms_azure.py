import json
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest, AnalyzeResult
from azure.ai.documentintelligence import DocumentIntelligenceClient
import hashlib
from dotenv import dotenv_values

def create_doc_intel_client(endpoint, key):
    document_intelligence_client = DocumentIntelligenceClient(
        endpoint=endpoint, credential=AzureKeyCredential(key)
    )
    return document_intelligence_client


def format_currency(currency_value):
    if currency_value:
        return currency_value.amount
    return None


# Safe concatenation method
def safe_get_value(data, key):
    """
    Safely extract value from nested dictionary or handle None

    Args:
        data (dict): The dictionary to extract value from
        key (str): The key to look up

    Returns:
        str: The value as a string, or empty string if not found
    """
    if data is None or key not in data:
        return ""

    # For nested dictionaries with 'value' key
    if isinstance(data[key], dict):
        return str(data[key].get("value", "") or "")

    # For direct values or None
    return str(data[key] or "")


def extract_receipts(
    document_intelligence_client, bytes_source: bytes = None
):
    """
    There is a logic that calculate discount and status which implement this only for poc
    in production we will not use this logic since it's consider only one receipt
    """

    poller = document_intelligence_client.begin_analyze_document(
        'prebuilt-receipt',
        AnalyzeDocumentRequest(bytes_source=bytes_source),
        string_index_type="Utf16CodeUnit",
        features=["queryFields", "languages", "ocrHighResolution"],
        query_fields=["Tax_Id", "Receipt_No"],
    )

    receipts: AnalyzeResult = poller.result()
    
    receipts_data = []

    if receipts.documents:
        for receipt in receipts.documents:
            receipt_data = {
                "merchant_name": None,
                "transaction_date": None,
                "transaction_time": None,
                "items": [],
                "total": None,
                "tax_id": None,
                "receipt_no": None,
                "address": None,
                "discount": 0,
                "status": False,
                "hashed_receipt": None,
            }

            if receipt.fields:
                merchant_name = receipt.fields.get("MerchantName")
                if merchant_name:
                    receipt_data["merchant_name"] = {
                        "value": merchant_name.get("valueString")
                    }

                transaction_date = receipt.fields.get("TransactionDate")
                if transaction_date:
                    receipt_data["transaction_date"] = {
                        "value": transaction_date.get("valueDate")
                    }
                transaction_time = receipt.fields.get("TransactionTime")
                if transaction_time:
                    receipt_data["transaction_time"] = {
                        "value": transaction_time.get("valueTime")
                    }

                receipt_no = receipt.fields.get("Receipt_No")
                if receipt_no:
                    receipt_data["receipt_no"] = {
                        "value": receipt_no.get("valueString")
                    }

                address = receipt.fields.get("MerchantAddress")
                if address:
                    receipt_data["address"] = {"value": address.get("content")}

                items = receipt.fields.get("Items")
                if items:
                    for item in items.get("valueArray", []):
                        item_data = {}

                        item_description = item.get("valueObject", {}).get(
                            "Description"
                        )
                        if item_description:
                            item_data["description"] = {
                                "value": item_description.get("valueString")
                            }

                        item_quantity = item.get("valueObject", {}).get("Quantity")
                        if item_quantity:
                            item_data["quantity"] = {
                                "value": item_quantity.get("valueNumber")
                            }

                        item_total_price = item.get("valueObject", {}).get("TotalPrice")
                        if item_total_price:
                            item_data["total_price"] = {
                                "value": format_currency(
                                    item_total_price.get("valueCurrency")
                                )
                            }

                        receipt_data["items"].append(item_data)

                total = receipt.fields.get("Total")
                if total:
                    receipt_data["total"] = {
                        "value": format_currency(total.get("valueCurrency"))
                    }

                tax_id = receipt.fields.get("Tax_Id")
                if tax_id:
                    receipt_data["tax_id"] = {"value": tax_id.get("valueString")}

                # this logic is calculate only for poc
                if receipt_data["total"]:
                    total_amount = receipt_data["total"]["value"]
                    if total_amount:
                        if total_amount >= 5000:
                            receipt_data["discount"] = 8
                        elif total_amount >= 2000:
                            receipt_data["discount"] = 6
                        elif total_amount >= 500:
                            receipt_data["discount"] = 4
                        else:
                            receipt_data["discount"] = 0

                data_to_hash = (
                    safe_get_value(receipt_data, "tax_id")
                    + safe_get_value(receipt_data, "transaction_date")
                    + safe_get_value(receipt_data, "transaction_time")
                    + safe_get_value(receipt_data, "total")
                )
                hashed_receipt = hashlib.sha256(
                    data_to_hash.encode("utf-8")
                ).hexdigest()
                receipt_data["hashed_receipt"] = hashed_receipt

                if (
                    receipt_data["transaction_date"] is None
                    or receipt_data["transaction_date"].get("value") is None
                    or receipt_data["transaction_time"] is None
                    or receipt_data["transaction_time"].get("value") is None
                    or receipt_data["total"] is None
                    or receipt_data["total"].get("value") is None
                    or receipt_data["tax_id"] is None
                    or receipt_data["tax_id"].get("value") is None
                ):
                    receipt_data["status"] = False
                    receipt_data["discount"] = 0
                else:
                    receipt_data["status"] = True

            receipts_data.append(receipt_data)

    return json.dumps(receipts_data, indent=4, ensure_ascii=False)

def extract_invoices(document_intelligence_client, bytes_source: bytes = None):
    poller = document_intelligence_client.begin_analyze_document(
        "prebuilt-invoice", AnalyzeDocumentRequest(bytes_source=bytes_source)
    )
    invoices = poller.result()

    extracted_invoices = []

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

        # Helper function to convert AddressValue to a string
        def serialize_address(address_value):
            if address_value:
                return str(address_value)  # Convert AddressValue to its string representation
            return None

        # Helper function to convert CurrencyValue to a dictionary
        def serialize_currency(currency_value):
            if currency_value:
                return {
                    "amount": currency_value.amount,
                    "currency_symbol": currency_value.currency_symbol,
                }
            return None

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
                        "value": unit.value_number
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

        # Extract service details
        service_start_date = invoice.fields.get("ServiceStartDate")
        if service_start_date:
            invoice_data["service_start_date"] = {
                "value": service_start_date.value_date.isoformat() if service_start_date.value_date else None
            }

        service_end_date = invoice.fields.get("ServiceEndDate")
        if service_end_date:
            invoice_data["service_end_date"] = {
                "value": service_end_date.value_date.isoformat() if service_end_date.value_date else None
            }

        service_address = invoice.fields.get("ServiceAddress")
        if service_address:
            invoice_data["service_address"] = {
                "value": serialize_address(service_address.value_address)
            }

        service_address_recipient = invoice.fields.get("ServiceAddressRecipient")
        if service_address_recipient:
            invoice_data["service_address_recipient"] = {
                "value": service_address_recipient.value_string
            }

        remittance_address = invoice.fields.get("RemittanceAddress")
        if remittance_address:
            invoice_data["remittance_address"] = {
                "value": serialize_address(remittance_address.value_address)
            }

        remittance_address_recipient = invoice.fields.get("RemittanceAddressRecipient")
        if remittance_address_recipient:
            invoice_data["remittance_address_recipient"] = {
                "value": remittance_address_recipient.value_string
            }

        # Add the invoice data to the list
        extracted_invoices.append(invoice_data)

    # Return all the extracted invoices
    return extracted_invoices


def intel_main(source, doc_type):
    config = dotenv_values(".env")

    endpoint = config["endpoint_s0_doc_int"]
    key = config["key_s0_doc_int"]

    doc_intel_client = create_doc_intel_client(endpoint, key)

    if doc_type == 'receipt':
        extracted_receipts = extract_receipts(
            bytes_source=source, document_intelligence_client=doc_intel_client
            )
        
        return extracted_receipts
    elif doc_type == 'invoice':
        extracted_invoices = extract_invoices(
        bytes_source=source, document_intelligence_client=doc_intel_client
        )
            
        return extracted_invoices