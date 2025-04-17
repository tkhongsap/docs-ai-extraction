#!/usr/bin/env python3
"""
Standalone OCR API server launcher
"""

import os
import sys
import uvicorn

# Set this environment variable to avoid port conflicts
PORT = int(os.environ.get("OCR_API_PORT", "5006"))

if __name__ == "__main__":
    print(f"Starting OCR API server on port {PORT}...")
    
    # Check if API keys are set
    has_openai_key = bool(os.environ.get("OPENAI_API_KEY"))
    has_azure_key = bool(os.environ.get("AZURE_DOC_INTELLIGENCE_KEY"))
    has_mistral_key = bool(os.environ.get("MISTRAL_API_KEY"))
    
    active_services = []
    if has_openai_key:
        active_services.append("OpenAI OCR")
    else:
        print("WARNING: OPENAI_API_KEY not set. OpenAI OCR service will not work.")
        
    if has_azure_key:
        active_services.append("MS Azure Document Intelligence")
    else:
        print("WARNING: AZURE_DOC_INTELLIGENCE_KEY not set. MS Azure OCR service will not work.")
        
    if has_mistral_key:
        active_services.append("Mistral AI OCR")
    else:
        print("WARNING: MISTRAL_API_KEY not set. Mistral AI OCR service will not work.")
    
    print(f"\nStarting OCR API server with {len(active_services)} active services:")
    for service in active_services:
        print(f"  - {service}")
    
    print(f"\nAPI will be available at:")
    print(f"  - http://127.0.0.1:{PORT}/")
    print(f"  - http://0.0.0.0:{PORT}/ (for external access)")
    
    print("\nEndpoints:")
    print("  - GET / - API health check")
    print("  - POST /openai-ocr - Process document with OpenAI")
    print("  - POST /mistral-ocr - Process document with Mistral AI")
    print("  - POST /ms-azure-ocr - Process document with MS Azure Document Intelligence")
    
    print("\nPress Ctrl+C to stop the server.\n")
    
    # Run the FastAPI application directly
    # Import the app directly to avoid module path issues
    try:
        # Import main app here to avoid import errors
        from main import app
        
        uvicorn.run(
            app, 
            host="0.0.0.0",
            port=PORT,
            reload=False
        )
    except Exception as e:
        print(f"Error starting OCR API server: {str(e)}")
        sys.exit(1)