"""
Main FastAPI application for OCR document processing.
Provides endpoints for different OCR services.
"""

import os
import sys
import json
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any, List

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
        return json.dumps({"error": "Azure Document Intelligence module is not available"})

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
        
        # Process with OpenAI
        extracted_data = openai_extract(processed_content, processed_content_type)
        
        # Try to parse JSON from response
        try:
            json_data = json.loads(extracted_data)
            return JSONResponse(content=json_data)
        except json.JSONDecodeError:
            # If not JSON, return raw text
            return JSONResponse(content={"result": extracted_data})
        
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
        
        # If it's a PDF, convert to image (for consistency with OpenAI endpoint)
        if content_type == 'application/pdf' or file_ext == 'pdf':
            # Keep PDF as is for Mistral, as it supports PDF directly
            pass
        
        # Process with Mistral
        extracted_data = mistral_extract(processed_content, processed_content_type)
        
        # Try to parse JSON from response
        try:
            json_data = json.loads(extracted_data)
            return JSONResponse(content=json_data)
        except json.JSONDecodeError:
            # If not JSON, return raw text
            return JSONResponse(content={"result": extracted_data})
        
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
        
        # Process with Azure (no need to convert PDF)
        extracted_data = azure_extract(file_content)
        
        # Try to parse JSON from response if not already JSON
        if isinstance(extracted_data, str):
            try:
                json_data = json.loads(extracted_data)
                return JSONResponse(content=json_data)
            except json.JSONDecodeError:
                # If not JSON, return raw text
                return JSONResponse(content={"result": extracted_data})
        else:
            # If already parsed, return as is
            return JSONResponse(content=extracted_data)
        
    except HTTPException:
        raise  # Reraise HTTP exceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint for API health check"""
    return {"status": "OK", "message": "OCR API is running", "endpoints": ["/openai-ocr", "/mistral-ocr", "/ms-azure-ocr"]}

if __name__ == "__main__":
    # Run server with uvicorn when executed directly
    uvicorn.run("main:app", host="0.0.0.0", port=8000)