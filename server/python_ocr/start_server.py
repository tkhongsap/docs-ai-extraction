#!/usr/bin/env python3
"""
Simple OCR API server starter
"""

import os
import sys
import uvicorn
from pathlib import Path

# Get the OCR API port from environment variable or use default
PORT = int(os.environ.get("OCR_API_PORT", "5006"))

# Create uploads directory if it doesn't exist
upload_dir = Path("uploads")
upload_dir.mkdir(exist_ok=True)

# Import the app directly
from main import app

if __name__ == "__main__":
    print(f"Starting OCR API server on port {PORT}...")
    
    # Check API keys and display status
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
    
    # Run with uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        log_level="info"
    )