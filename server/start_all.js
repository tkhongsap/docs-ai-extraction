/**
 * Combined server startup script
 * Runs both the Node.js Express server and the Python OCR API server
 */

import { spawn } from 'child_process';
import path from 'path';
import process from 'process';

// Function to start the Python OCR API server
function startPythonOCRServer() {
  console.log('Starting Python OCR API server...');
  
  // Use Python module path for better compatibility
  const pythonProcess = spawn('python', ['-m', 'server.python_ocr.run_api'], {
    stdio: 'inherit', // Inherit stdio to see output in console
    shell: true
  });
  
  // Handle Python process events
  pythonProcess.on('error', (err) => {
    console.error('Failed to start Python OCR API server:', err);
  });
  
  pythonProcess.on('exit', (code, signal) => {
    if (code !== 0) {
      console.log(`Python OCR API server exited with code ${code} and signal ${signal}`);
    }
  });
  
  // Return process for cleanup
  return pythonProcess;
}

// Function to start the Node.js server
function startNodeServer() {
  console.log('Starting Node.js server...');
  
  // Use npm run dev as it handles tsx/ts-node
  const nodeProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit', // Inherit stdio to see output in console
    shell: true
  });
  
  // Handle Node process events
  nodeProcess.on('error', (err) => {
    console.error('Failed to start Node.js server:', err);
  });
  
  nodeProcess.on('exit', (code, signal) => {
    if (code !== 0) {
      console.log(`Node.js server exited with code ${code} and signal ${signal}`);
    }
  });
  
  // Return process for cleanup
  return nodeProcess;
}

// Start both servers
const pythonProcess = startPythonOCRServer();

// Wait a bit for Python server to initialize
setTimeout(() => {
  const nodeProcess = startNodeServer();
  
  // Setup cleanup on exit
  process.on('SIGINT', () => {
    console.log('Shutting down servers...');
    nodeProcess.kill();
    pythonProcess.kill();
    process.exit(0);
  });
}, 2000); // 2 second delay

console.log('Both servers started! Press Ctrl+C to stop.');