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
    
    # Use port 5006 by default, or allow overriding from environment
    ocr_port = int(os.environ.get("OCR_API_PORT", "5006"))
    
    print("\nAPI will be available at:")
    print(f"  - http://127.0.0.1:{ocr_port}/")
    print(f"  - http://0.0.0.0:{ocr_port}/ (for external access)")
    print("\nEndpoints:")
    print("  - GET / - API health check")
    print("  - POST /openai-ocr - Process document with OpenAI")
    print("  - POST /mistral-ocr - Process document with Mistral AI")
    print("  - POST /ms-azure-ocr - Process document with MS Azure Document Intelligence")
    print("\nPress Ctrl+C to stop the server.\n")

if __name__ == "__main__":
    try:
        # Use port 5006 to avoid conflict with Node.js server
        ocr_port = int(os.environ.get("OCR_API_PORT", "5006"))
        print_server_info()
        uvicorn.run(
            "server.python_ocr.main:app", 
            host="0.0.0.0", 
            port=ocr_port, 
            reload=True
        )
    except Exception as e:
        print(f"Error starting OCR API server: {str(e)}")
        traceback.print_exc()
        sys.exit(1)