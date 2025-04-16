import { processDocument } from './services/ocrService.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to a test document (replace with your actual file path)
const testFile = process.argv[2] || '../uploads/test.pdf';
const filePath = path.resolve(__dirname, testFile);

// Test OCR service
async function testOcr() {
  console.log('==== OCR Service Test ====');
  console.log(`Processing file: ${filePath}`);
  
  try {
    const result = await processDocument(filePath, 'mistral');
    console.log('==== OCR Result ====');
    console.log(JSON.stringify(result, null, 2));
    console.log('==== Test Complete ====');
  } catch (err) {
    const error = err as Error;
    console.error('Error during OCR processing:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    // If the error has additional details (like from the API)
    if (error.message.includes('Mistral API Error')) {
      console.error('API Error Details:', error.message);
    }
  }
}

// Run the test
testOcr().catch(console.error);