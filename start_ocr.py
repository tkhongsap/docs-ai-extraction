#!/usr/bin/env python3
"""
Simple wrapper to start the OCR API server.
This script exists to resolve import path issues.
"""

import os
import sys
import subprocess
import time

def main():
    """Starts the OCR API server as a subprocess."""
    # Set the port for OCR server
    OCR_PORT = int(os.environ.get('OCR_API_PORT', '5006'))
    
    print(f"Starting OCR API server on port {OCR_PORT}...")
    
    # Current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Command to start the server - using module import path
    cmd = [
        sys.executable,  # Current Python interpreter
        "-c",
        """
import os
import sys

# Add the current directory to Python path
sys.path.insert(0, os.getcwd())

# Change directory to server/python_ocr
os.chdir('server/python_ocr')

# Now import the modules from the correct path
import uvicorn
import importlib.util

# Use importlib to load main module
spec = importlib.util.spec_from_file_location('main', 'main.py')
main_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(main_module)

# Run the app using uvicorn
port = int(os.environ.get('OCR_API_PORT', '5006'))
print(f"Starting OCR API server on port {port}...")
uvicorn.run(main_module.app, host='0.0.0.0', port=port)
        """
    ]
    
    # Start the server
    try:
        print(f"Executing Python OCR server...")
        env = os.environ.copy()
        env['OCR_API_PORT'] = str(OCR_PORT)
        
        process = subprocess.Popen(
            cmd,
            env=env,
            cwd=current_dir  # Ensure we start from the current directory
        )
        
        # Wait for the server to start
        for i in range(10):
            time.sleep(1)
            print(f"Waiting for OCR server to start... ({i+1}/10)")
        
        print(f"OCR API server should be running at http://localhost:{OCR_PORT}/")
        print("Press Ctrl+C to stop the server.")
        
        # Keep the script running until the process finishes
        process.wait()
        
    except KeyboardInterrupt:
        print("\nStopping OCR API server...")
        process.terminate()
    except Exception as e:
        print(f"Error starting OCR API server: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()