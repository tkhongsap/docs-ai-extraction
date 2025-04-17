"""
Script to start the FastAPI server for OCR processing.
"""

import os
import sys
import json
import traceback

# Try to import uvicorn, handling potential import errors
try:
    import uvicorn
except ImportError:
    print("Error: uvicorn package is not installed. Please install it with 'pip install uvicorn'")
    sys.exit(1)

def print_server_info():
    """Print information about the server configuration."""
    # Check for required environment variables
    ocr_services = []
    
    if os.environ.get("OPENAI_API_KEY"):
        ocr_services.append("OpenAI OCR")
    else:
        print("WARNING: OPENAI_API_KEY not set. OpenAI OCR service will not work.")
    
    if os.environ.get("MISTRAL_API_KEY"):
        ocr_services.append("Mistral AI OCR")
    else:
        print("WARNING: MISTRAL_API_KEY not set. Mistral AI OCR service will not work.")
    
    if os.environ.get("AZURE_DOC_INTELLIGENCE_KEY"):
        ocr_services.append("MS Azure OCR")
    else:
        print("WARNING: AZURE_DOC_INTELLIGENCE_KEY not set. MS Azure OCR service will not work.")
    
    print(f"\nStarting OCR API server with {len(ocr_services)} active services:")
    for service in ocr_services:
        print(f"  - {service}")
    
    print("\nAPI will be available at:")
    print("  - http://127.0.0.1:5005/")
    print("  - http://0.0.0.0:5005/ (for external access)")
    print("\nEndpoints:")
    print("  - GET / - API health check")
    print("  - POST /openai-ocr - Process document with OpenAI")
    print("  - POST /mistral-ocr - Process document with Mistral AI")
    print("  - POST /ms-azure-ocr - Process document with MS Azure Document Intelligence")
    print("\nPress Ctrl+C to stop the server.\n")

if __name__ == "__main__":
    try:
        print_server_info()
        uvicorn.run(
            "server.python_ocr.main:app", 
            host="0.0.0.0", 
            port=5005, 
            reload=True
        )
    except Exception as e:
        print(f"Error starting OCR API server: {str(e)}")
        traceback.print_exc()
        sys.exit(1)