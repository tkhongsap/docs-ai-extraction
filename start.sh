#!/bin/bash

# Start Python OCR API server in the background
echo "Starting Python OCR API server..."
python -m server.python_ocr.run_api &
PYTHON_OCR_API_PID=$!

# Wait a moment to let the API initialize
sleep 2

# Start the main Node.js application
echo "Starting Node.js application..."
npm run dev

# If Node.js app exits, kill the Python API server
kill $PYTHON_OCR_API_PID