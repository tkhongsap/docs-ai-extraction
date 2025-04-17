#!/usr/bin/env python3
"""
Simple wrapper to start the OCR API server.
This script exists to resolve import path issues.
"""

import os
import sys
import subprocess
import time

# Set the port for OCR server
OCR_PORT = int(os.environ.get('OCR_API_PORT', '5006'))

def main():
    """Starts the OCR API server as a subprocess."""
    print(f"Starting OCR API server on port {OCR_PORT}...")
    
    # Current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Path to the Python OCR server
    ocr_script_path = os.path.join(current_dir, 'server', 'python_ocr', 'main.py')
    
    # Command to start the uvicorn server
    cmd = [
        sys.executable,
        "-m", "uvicorn",
        "server.python_ocr.main:app",
        "--host", "0.0.0.0",
        "--port", str(OCR_PORT)
    ]
    
    # Start the server as a subprocess
    try:
        print(f"Executing command: {' '.join(cmd)}")
        process = subprocess.Popen(cmd)
        
        # Wait for server to start
        for i in range(10):
            time.sleep(1)
            print(f"Waiting for OCR server to start... ({i+1}/10)")
        
        print(f"OCR API server should be running at http://localhost:{OCR_PORT}/")
        print("Press Ctrl+C to stop the server.")
        
        # Keep process running until user interrupts
        process.wait()
    except KeyboardInterrupt:
        print("\nStopping OCR API server...")
        process.terminate()
    except Exception as e:
        print(f"Error starting OCR API server: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()