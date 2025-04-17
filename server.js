/**
 * Combined server starter script for Replit workflow
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting OCR Document Processor application...');

// Set environment variables
process.env.PORT = '5000';
process.env.OCR_API_PORT = '5006';

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
  console.log('Created uploads directory');
}

// Start Python OCR API server using direct module import
console.log('\nStarting Python OCR API server on port 5006...');

// Change current directory to make imports work correctly
process.chdir(__dirname);

// Create uploads folder if it doesn't exist
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads', { recursive: true });
}

// Launch the Python OCR server with appropriate environment
const pythonProcess = spawn('python3', 
  ['-c', `
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.getcwd())

# Try to import and run the FastAPI app
try:
    import uvicorn
    from server.python_ocr.main import app
    
    # Print details for debugging
    print("Python path:", sys.path)
    print("Current directory:", os.getcwd())
    print("Starting OCR API on port 5006...")
    
    # Run the server
    uvicorn.run(app, host="0.0.0.0", port=5006)
except Exception as e:
    print(f"Error starting OCR API: {e}")
    import traceback
    traceback.print_exc()
`], 
  { 
    stdio: 'inherit',
    env: { 
      ...process.env,
      OCR_API_PORT: '5006',
      PYTHONPATH: __dirname
    }
  }
);

pythonProcess.on('error', (err) => {
  console.error('Failed to start Python OCR API server:', err);
});

// Start Node.js server
console.log('\nStarting Node.js application on port 5000...');

const nodeProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  env: { 
    ...process.env,
    PORT: '5000',
    NODE_ENV: 'development'
  }
});

nodeProcess.on('error', (err) => {
  console.error('Failed to start Node.js server:', err);
});

// Handle cleanup when the script is terminated
process.on('SIGINT', () => {
  console.log('\nShutting down servers...');
  pythonProcess.kill();
  nodeProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down servers...');
  pythonProcess.kill();
  nodeProcess.kill();
  process.exit(0);
});

console.log('\nBoth servers are starting:');
console.log('- Node.js server: http://localhost:5000/');
console.log('- Python OCR API: http://localhost:5006/');