import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test settings
const testFile = process.argv[2] || '../uploads/PO Partial ทยอยเรียกเข้า - 1.pdf';
const filePath = path.resolve(__dirname, testFile);

// Verify Mistral credentials
const mistralApiKey = process.env.MISTRAL_API_KEY || '';
if (!mistralApiKey) {
  console.error('ERROR: MISTRAL_API_KEY environment variable is not set.');
  process.exit(1);
}

async function diagnoseMistralApi() {
  console.log('=== Mistral API Diagnostic Test ===');
  console.log(`Testing with file: ${filePath}`);
  console.log(`File exists: ${fs.existsSync(filePath)}`);
  
  if (!fs.existsSync(filePath)) {
    console.error('File not found!');
    process.exit(1);
  }
  
  // Read the file content
  console.log('Reading file...');
  try {
    const fileContent = fs.readFileSync(filePath);
    console.log(`File size: ${(fileContent.length / 1024).toFixed(2)} KB`);
    
    // Get file extension
    const fileExt = path.extname(filePath).toLowerCase();
    console.log(`File extension: ${fileExt}`);
    
    // Determine the MIME type based on extension
    const mimeType = fileExt === '.pdf' ? 'application/pdf' : 'image/jpeg';
    console.log(`Using MIME type: ${mimeType}`);
    
    // Convert file to base64
    console.log('Converting file to base64...');
    const base64Content = fileContent.toString('base64');
    console.log(`Base64 length: ${base64Content.length} characters`);
    
    // Create data URL
    const dataUrl = `data:${mimeType};base64,${base64Content}`;
    console.log(`Data URL prefix: ${dataUrl.substring(0, 50)}...`);
    
    // Create a simple system message
    const systemPrompt = 'You are a helpful assistant. Analyze the document and describe what you see.';
    
    // Prepare API request
    console.log('Preparing API request...');
    const url = 'https://api.mistral.ai/v1/chat/completions';
    const requestBody = {
      model: "mistral-large-latest",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "What is in this document?"
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl
              }
            }
          ]
        }
      ],
      temperature: 0
    };
    
    // Make API request
    console.log('Sending request to Mistral API...');
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mistralApiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log(`Response status: ${response.status}`);
      console.log('Response headers:', response.headers);
      
      const responseData = await response.json();
      console.log('Response data:', JSON.stringify(responseData, null, 2));
      
      if (!response.ok) {
        console.error('API request failed');
        if (responseData.error) {
          console.error('Error details:', responseData.error);
        }
      } else {
        console.log('API request succeeded');
        if (responseData.choices && responseData.choices.length > 0) {
          const message = responseData.choices[0].message.content;
          console.log('Message received:', message);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  } catch (err) {
    console.error('File reading error:', err);
  }
}

// Run the diagnostic function
diagnoseMistralApi().catch(err => {
  console.error('Uncaught error:', err);
});