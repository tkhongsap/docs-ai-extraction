#!/bin/bash

# Create uploads directory if it doesn't exist
mkdir -p uploads

# Define a cleanup function to handle both processes
cleanup() {
  echo "Shutting down servers..."
  if [ ! -z "$PYTHON_PID" ]; then
    kill $PYTHON_PID 2>/dev/null
  fi
  if [ ! -z "$NODE_PID" ]; then
    kill $NODE_PID 2>/dev/null
  fi
  exit 0
}

# Set up trap to catch SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Start Python OCR API server
echo "Starting Python OCR API server on port 5006..."
export OCR_API_PORT=5006
cd server/python_ocr && python start_ocr_server.py &
PYTHON_PID=$!
cd ../..

# Wait for Python server to initialize
echo "Waiting for Python OCR API to initialize..."
sleep 3

# Verify Python API is running
for i in {1..10}; do
  if curl -s http://localhost:5006/ > /dev/null; then
    echo "Python OCR API is running at http://localhost:5006/"
    break
  fi
  
  if [ $i -eq 10 ]; then
    echo "Failed to start Python OCR API server!"
    cleanup
  fi
  
  echo "Waiting for Python OCR API to start... (attempt $i/10)"
  sleep 1
done

# Start the main Node.js application
echo "Starting Node.js application on port 5000..."
export PORT=5000
NODE_ENV=development npm run dev &
NODE_PID=$!

# Wait for both processes
echo "Both servers are now running!"
echo "- Node.js server: http://localhost:5000/"
echo "- Python OCR API: http://localhost:5006/"
echo "Press Ctrl+C to stop both servers."

wait $PYTHON_PID $NODE_PID