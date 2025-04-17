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

// Start Python OCR API server using the simpler script
console.log('\nStarting Python OCR API server on port 5006...');

const pythonProcess = spawn('python3', 
  [path.join(__dirname, 'server/python_ocr/start_server.py')], 
  { 
    stdio: 'inherit',
    env: { 
      ...process.env,
      OCR_API_PORT: '5006'
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