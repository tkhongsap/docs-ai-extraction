#!/bin/bash

# Make script executable with: chmod +x start_python_ocr.sh
# Run with: ./start_python_ocr.sh

echo "Starting Python OCR API server on port 5006..."

# Ensure we have the right Python modules
echo "Checking Python modules..."
python3 -m pip install fastapi uvicorn python-multipart python-dotenv mistralai openai azure-ai-documentintelligence pdf2image pillow

# Create uploads directory if it doesn't exist
if [ ! -d "./uploads" ]; then
  mkdir -p ./uploads
  echo "Created uploads directory"
fi

# Set environment variables
export OCR_API_PORT=5006

# Start the FastAPI server directly
echo "Starting FastAPI server..."
python3 -m uvicorn server.python_ocr.main:app --host 0.0.0.0 --port 5006