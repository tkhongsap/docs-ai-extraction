"""
Main FastAPI application for OCR document processing.
Provides endpoints for different OCR services.
"""

import os
import sys
import json
import tempfile
import uuid
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

# Import required packages with error handling
try:
    from fastapi import FastAPI, File, UploadFile, HTTPException
    from fastapi.responses import JSONResponse
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
except ImportError as e:
    print(f"Error importing FastAPI-related packages: {e}")
    print("Please install FastAPI and its dependencies: pip install fastapi uvicorn")
    sys.exit(1)

# Try to import PDF handling library
try:
    from pdf2image import convert_from_bytes
except ImportError:
    print("Warning: pdf2image not available. PDF processing will be limited.")
    # Define a fallback function
    def convert_from_bytes(pdf_bytes, first_page=1, last_page=1):
        print("PDF conversion not available. Please install pdf2image.")
        return []

# Try to import environment variable handling
try:
    from dotenv import load_dotenv
    # Load environment variables
    load_dotenv(override=True)
except ImportError:
    print("Warning: python-dotenv not available. Environment variables must be set manually.")
    # Define a dummy function
    def load_dotenv(override=True):
        pass

# Import OCR service modules
# Import OCR service modules - use try/except to handle potential import errors
try:
    from .openai_ocr import extract_invoice_data as openai_extract
except ImportError:
    # Fallback function if import fails
    def openai_extract(file_content, content_type):
        return json.dumps({"error": "OpenAI module is not available"})

try:
    from .mistral_ocr import extract_invoice_data as mistral_extract
except ImportError:
    # Fallback function if import fails
    def mistral_extract(file_content, content_type):
        return json.dumps({"error": "Mistral module is not available"})

try:
    from .ms_azure_ocr import extract_invoice_data as azure_extract
except ImportError:
    # Fallback function if import fails
    def azure_extract(file_content):
        return {"error": "Azure Document Intelligence module is not available"}

# Create FastAPI app
app = FastAPI(title="Document OCR API", description="API for processing documents with various OCR services")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload folder if it doesn't exist
UPLOAD_FOLDER = Path("uploads")
UPLOAD_FOLDER.mkdir(exist_ok=True)

@app.post("/openai-ocr", response_class=JSONResponse)
async def process_with_openai(file: UploadFile = File(...)):
    """
    Process a document using OpenAI's OCR capabilities
    
    Args:
        file: The document file to process (image or PDF)
        
    Returns:
        JSON data extracted from the document
    """
    try:
        # Read file content
        file_content = await file.read()
        
        # Check if file is empty
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        # Save file to upload folder
        file_path = UPLOAD_FOLDER / file.filename
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Get content type
        content_type = file.content_type
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        
        processed_content = file_content
        processed_content_type = content_type
        
        # If it's a PDF, convert to image
        if content_type == 'application/pdf' or file_ext == 'pdf':
            try:
                # Convert first page of PDF to image
                images = convert_from_bytes(file_content, first_page=1, last_page=1)
                
                if images and len(images) > 0:
                    # Create temp file to save image
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                        temp_path = temp_file.name
                    
                    # Save first image to temp file
                    images[0].save(temp_path, 'PNG')
                    
                    # Read image from temp file
                    with open(temp_path, 'rb') as img_file:
                        processed_content = img_file.read()
                    
                    # Update content type
                    processed_content_type = 'image/png'
                    
                    # Delete temp file
                    os.unlink(temp_path)
                    
                    # Also save converted image to upload folder
                    converted_img_path = UPLOAD_FOLDER / f"{os.path.splitext(file.filename)[0]}_converted.png"
                    with open(converted_img_path, "wb") as f:
                        f.write(processed_content)
                else:
                    raise HTTPException(status_code=400, detail="Could not convert PDF to image (no pages found)")
            except Exception as pdf_err:
                raise HTTPException(status_code=400, detail=f"Error converting PDF: {str(pdf_err)}")
        
        # Process with OpenAI - wrap in additional try-except
        try:
            extracted_data = openai_extract(processed_content, processed_content_type)
            
            # Log the raw response for debugging
            print(f"OpenAI raw response from main.py: {extracted_data[:200]}...")
            
            # Try to parse JSON from response
            try:
                json_data = json.loads(extracted_data)
                return JSONResponse(content=json_data)
            except json.JSONDecodeError as e:
                print(f"JSON decode error in main.py: {str(e)}")
                
                # Create a default response with error details
                default_response = {
                    "vendorName": "Could not extract vendor name",
                    "invoiceNumber": "Unknown",
                    "totalAmount": 0,
                    "lineItems": [],
                    "handwrittenNotes": [],
                    "error": f"Failed to parse OpenAI response: {str(e)}",
                    "rawText": extracted_data[:200] + "..." if len(extracted_data) > 200 else extracted_data
                }
                
                return JSONResponse(content=default_response)
        except Exception as service_error:
            # Handle any errors from the OCR service
            print(f"OpenAI service error: {str(service_error)}")
            
            # Create a structured error response
            error_response = {
                "vendorName": "Error occurred",
                "invoiceNumber": "Error",
                "totalAmount": 0,
                "currency": "Unknown",
                "lineItems": [],
                "handwrittenNotes": [],
                "error": f"OpenAI OCR service error: {str(service_error)}",
                "status": "error",
                "confidence": 0
            }
            
            return JSONResponse(content=error_response)
        
    except HTTPException:
        raise  # Reraise HTTP exceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/mistral-ocr", response_class=JSONResponse)
async def process_with_mistral(file: UploadFile = File(...)):
    """
    Process a document using Mistral AI's OCR capabilities
    
    Args:
        file: The document file to process (image or PDF)
        
    Returns:
        JSON data extracted from the document
    """
    try:
        # Read file content
        file_content = await file.read()
        
        # Check if file is empty
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        # Save file to upload folder
        file_path = UPLOAD_FOLDER / file.filename
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Get content type
        content_type = file.content_type
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        
        processed_content = file_content
        processed_content_type = content_type
        
        # If it's a PDF, convert to image
        if content_type == 'application/pdf' or file_ext == 'pdf':
            try:
                print("Converting PDF to image for Mistral processing...")
                # Convert first page of PDF to image
                try:
                    pdf_images = convert_from_bytes(processed_content, first_page=1, last_page=1)
                except Exception as pdf_err:
                    print(f"Error in PDF conversion: {str(pdf_err)}")
                    raise HTTPException(status_code=400, detail=f"PDF conversion error: {str(pdf_err)}")
                
                if pdf_images and len(pdf_images) > 0:
                    # Save the image to a temporary file
                    temp_path = os.path.join(tempfile.gettempdir(), f"pdf_to_img_{uuid.uuid4()}.png")
                    pdf_images[0].save(temp_path, 'PNG')
                    
                    # Read the image back
                    with open(temp_path, 'rb') as img_file:
                        processed_content = img_file.read()
                    
                    # Update content type
                    processed_content_type = 'image/png'
                    
                    # Delete temp file
                    os.unlink(temp_path)
                    
                    # Also save converted image to upload folder for debugging
                    converted_img_path = UPLOAD_FOLDER / f"{os.path.splitext(file.filename)[0]}_mistral_converted.png"
                    with open(converted_img_path, "wb") as f:
                        f.write(processed_content)
                    
                    print(f"PDF successfully converted to image for Mistral processing: {converted_img_path}")
                else:
                    raise HTTPException(status_code=400, detail="Could not convert PDF to image (no pages found)")
            except Exception as pdf_err:
                print(f"Failed to convert PDF for Mistral: {str(pdf_err)}")
                raise HTTPException(status_code=400, detail=f"Error converting PDF for Mistral: {str(pdf_err)}")
        
        # Process with Mistral - wrap in additional try-except
        try:
            extracted_data = mistral_extract(processed_content, processed_content_type)
            
            # Log the raw response for debugging
            print(f"Mistral raw response from main.py: {extracted_data[:200]}...")
            
            # Try to parse JSON from response
            try:
                json_data = json.loads(extracted_data)
                return JSONResponse(content=json_data)
            except json.JSONDecodeError as e:
                print(f"JSON decode error in main.py (Mistral): {str(e)}")
                
                # Create a default response with error details
                default_response = {
                    "vendorName": "Could not extract vendor name",
                    "invoiceNumber": "Unknown",
                    "totalAmount": 0,
                    "lineItems": [],
                    "handwrittenNotes": [],
                    "error": f"Failed to parse Mistral response: {str(e)}",
                    "rawText": extracted_data[:200] + "..." if len(extracted_data) > 200 else extracted_data
                }
                
                return JSONResponse(content=default_response)
        except Exception as service_error:
            # Handle any errors from the OCR service
            print(f"Mistral service error: {str(service_error)}")
            
            # Create a structured error response
            error_response = {
                "vendorName": "Error occurred",
                "invoiceNumber": "Error",
                "totalAmount": 0,
                "currency": "Unknown",
                "lineItems": [],
                "handwrittenNotes": [],
                "error": f"Mistral OCR service error: {str(service_error)}",
                "status": "error",
                "confidence": 0
            }
            
            return JSONResponse(content=error_response)
        
    except HTTPException:
        raise  # Reraise HTTP exceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/ms-azure-ocr", response_class=JSONResponse)
async def process_with_azure(file: UploadFile = File(...)):
    """
    Process a document using Microsoft Azure Document Intelligence
    
    Args:
        file: The document file to process (image or PDF)
        
    Returns:
        JSON data extracted from the document
    """
    try:
        # Read file content
        file_content = await file.read()
        
        # Check if file is empty
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        # Save file to upload folder
        file_path = UPLOAD_FOLDER / file.filename
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Process with Azure (no need to convert PDF) - wrap in additional try-except
        try:
            extracted_data = azure_extract(file_content)
            
            # Log the raw response for debugging (first 200 chars)
            print(f"Azure raw response from main.py: {str(extracted_data)[:200]}...")
            
            # The Azure handler now returns a list of dictionaries
            # We need to convert to our standard format
            
            if isinstance(extracted_data, list) and len(extracted_data) > 0:
                # We got data in Azure format, need to convert to our application format
                print("Converting Azure list response to application format...")
                
                azure_data = extracted_data[0]  # Take the first invoice
                
                # Create our standard response format using a simplified format for our application
                # Print all keys at top level for debugging
                print(f"Azure data keys: {list(azure_data.keys())}")
                
                # Create a more direct mapping to how our application expects data
                standard_response = {
                    # Direct field mappings that match our application's expected format
                    "vendorName": azure_data.get("vendor_name", {}).get("value", "") if azure_data.get("vendor_name") else "",
                    "vendorAddress": azure_data.get("vendor_address", {}).get("value", "") if azure_data.get("vendor_address") else "",
                    "vendorContact": azure_data.get("vendor_address_recipient", {}).get("value", "") if azure_data.get("vendor_address_recipient") else "",
                    "clientName": azure_data.get("customer_name", {}).get("value", "") if azure_data.get("customer_name") else "",
                    "clientAddress": azure_data.get("customer_address", {}).get("value", "") if azure_data.get("customer_address") else "",
                    "invoiceNumber": azure_data.get("invoice_id", {}).get("value", "") if azure_data.get("invoice_id") else "",
                    "invoiceDate": azure_data.get("invoice_date", {}).get("value", "") if azure_data.get("invoice_date") else None,
                    "dueDate": azure_data.get("due_date", {}).get("value", "") if azure_data.get("due_date") else None,
                    "totalAmount": azure_data.get("invoice_total", {}).get("value", {}).get("amount", 0) if azure_data.get("invoice_total") and azure_data.get("invoice_total").get("value") else 0,
                    "subtotalAmount": azure_data.get("subtotal", {}).get("value", {}).get("amount", 0) if azure_data.get("subtotal") and azure_data.get("subtotal").get("value") else 0,
                    "taxAmount": azure_data.get("total_tax", {}).get("value", {}).get("amount", 0) if azure_data.get("total_tax") and azure_data.get("total_tax").get("value") else 0,
                    "currency": azure_data.get("invoice_total", {}).get("value", {}).get("currency_symbol", "") if azure_data.get("invoice_total") and azure_data.get("invoice_total").get("value") else "",
                    "paymentTerms": "",
                    "paymentMethod": "",
                    
                    # Default empty arrays for structured data
                    "lineItems": [],
                    "handwrittenNotes": [],
                    
                    # Additional info field
                    "additionalInfo": "",
                    
                    # Metadata fields
                    "processingMetadata": {
                        "ocrEngine": "ms-document-intelligence",
                        "processingTime": 0,
                        "processingTimestamp": datetime.now().isoformat(),
                        "documentClassification": "invoice"
                    },
                    "confidenceScores": {
                        "overall": 80,
                        "vendorInfo": 80,
                        "invoiceDetails": 80,
                        "lineItems": 80,
                        "totals": 80,
                        "handwrittenNotes": 50,
                        "fieldSpecific": {}
                    }
                }
                
                # Convert line items
                if "items" in azure_data and isinstance(azure_data["items"], list):
                    for item in azure_data["items"]:
                        line_item = {
                            "description": item.get("description", {}).get("value", "") if item.get("description") else "",
                            "quantity": item.get("quantity", {}).get("value", 0) if item.get("quantity") else 0,
                            "unitPrice": item.get("unit_price", {}).get("value", {}).get("amount", 0) if item.get("unit_price") and item.get("unit_price").get("value") else 0,
                            "amount": item.get("amount", {}).get("value", {}).get("amount", 0) if item.get("amount") and item.get("amount").get("value") else 0,
                            "itemCode": item.get("product_code", {}).get("value", "") if item.get("product_code") else "",
                        }
                        standard_response["lineItems"].append(line_item)
                
                # Add the markdown output if available
                if "markdownOutput" in azure_data:
                    standard_response["markdownOutput"] = azure_data["markdownOutput"]
                
                print(f"Converted response: {str(standard_response)[:200]}...")
                
                # Return the converted response
                return JSONResponse(content=standard_response)
                
            elif isinstance(extracted_data, dict):
                # Handle dictionary response (older format or error format)
                # Ensure date fields are properly formatted
                for date_field in ['invoiceDate', 'dueDate']:
                    if date_field in extracted_data and extracted_data[date_field]:
                        # Convert dates to ISO string format if they aren't already
                        if isinstance(extracted_data[date_field], datetime):
                            try:
                                extracted_data[date_field] = extracted_data[date_field].isoformat()
                            except:
                                # If conversion fails, use string representation
                                extracted_data[date_field] = str(extracted_data[date_field])
                        elif not isinstance(extracted_data[date_field], str):
                            # For any other non-string type, convert to string
                            extracted_data[date_field] = str(extracted_data[date_field])

                # Ensure we have all required fields
                if "status" not in extracted_data:
                    extracted_data["status"] = "success"
                
                # Return properly structured data
                return JSONResponse(content=extracted_data)
                
            elif isinstance(extracted_data, str):
                # Fallback for old responses that might still return strings
                try:
                    json_data = json.loads(extracted_data)
                    return JSONResponse(content=json_data)
                except json.JSONDecodeError as e:
                    print(f"JSON decode error in main.py (Azure): {str(e)}")
                    # If not JSON, return raw text with error details
                    return JSONResponse(content={
                        "documentInfo": {
                            "vendor": "Could not extract vendor name",
                            "invoiceNumber": "Unknown",
                            "totalAmount": 0
                        },
                        "lineItems": [],
                        "handwrittenNotes": [],
                        "additionalInfo": f"Failed to parse Azure response: {str(e)}",
                        "metadata": {
                            "ocrEngine": "ms-document-intelligence",
                            "processingTime": 0,
                            "processingTimestamp": datetime.now().isoformat(),
                            "documentClassification": "error",
                            "error": f"Failed to parse Azure response: {str(e)}"
                        },
                        "rawText": extracted_data[:200] + "..." if len(extracted_data) > 200 else extracted_data
                    })
            else:
                # Unexpected response type
                return JSONResponse(content={
                    "documentInfo": {
                        "vendor": "Error in Azure processing",
                        "invoiceNumber": "Unknown",
                        "totalAmount": 0
                    },
                    "lineItems": [],
                    "handwrittenNotes": [],
                    "additionalInfo": "Unexpected response type from Azure OCR module",
                    "metadata": {
                        "ocrEngine": "ms-document-intelligence",
                        "processingTime": 0,
                        "processingTimestamp": datetime.now().isoformat(),
                        "documentClassification": "error",
                        "error": "Unexpected response type from Azure OCR module"
                    }
                })
        except Exception as service_error:
            # Handle any errors from the Azure OCR service
            print(f"Azure service error: {str(service_error)}")
            
            # Create a structured error response that matches the expected format
            error_response = {
                "documentInfo": {
                    "vendor": "Error occurred",
                    "vendorAddress": "",
                    "vendorContact": "",
                    "client": "",
                    "clientAddress": "",
                    "invoiceNumber": "Error",
                    "invoiceDate": None,
                    "dueDate": None,
                    "totalAmount": 0,
                    "subtotalAmount": None,
                    "taxAmount": None,
                    "currency": "Unknown",
                    "paymentTerms": "",
                    "paymentMethod": ""
                },
                "lineItems": [],
                "handwrittenNotes": [],
                "additionalInfo": f"Azure OCR service error: {str(service_error)}",
                "metadata": {
                    "ocrEngine": "ms-document-intelligence",
                    "processingTime": 0,
                    "processingTimestamp": datetime.now().isoformat(),
                    "documentClassification": "error",
                    "error": f"Azure OCR service error: {str(service_error)}"
                },
                "confidenceScores": {
                    "overall": 0,
                    "vendorInfo": 0,
                    "invoiceDetails": 0,
                    "lineItems": 0,
                    "totals": 0,
                    "handwrittenNotes": 0,
                    "fieldSpecific": {}
                }
            }
            
            return JSONResponse(content=error_response)
        
    except HTTPException:
        raise  # Reraise HTTP exceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint for API health check"""
    return {"status": "OK", "message": "OCR API is running", "endpoints": ["/openai-ocr", "/mistral-ocr", "/ms-azure-ocr"]}

@app.get("/health")
async def health_check():
    """Dedicated health check endpoint"""
    # Check if OpenAI API key is available
    openai_api_key = os.environ.get("OPENAI_API_KEY", "")
    # Check if Mistral API key is available
    mistral_api_key = os.environ.get("MISTRAL_API_KEY", "")
    # Check if Azure Document Intelligence key is available
    azure_key = os.environ.get("AZURE_DOC_INTELLIGENCE_KEY", "")
    
    services_status = {
        "openai": "available" if openai_api_key else "api_key_missing",
        "mistral": "available" if mistral_api_key else "api_key_missing",
        "azure": "available" if azure_key else "api_key_missing"
    }
    
    return {
        "status": "healthy",
        "services": services_status,
        "upload_directory": str(UPLOAD_FOLDER),
        "upload_directory_exists": UPLOAD_FOLDER.exists()
    }

if __name__ == "__main__":
    # Run server with uvicorn when executed directly
    uvicorn.run("main:app", host="0.0.0.0", port=8000)