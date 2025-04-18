// Load environment variables from .env file
require('dotenv').config();

// Print current Python-related environment
console.log('Python environment settings:');
console.log('PYTHONPATH:', process.env.PYTHONPATH);
console.log('LLAMAPARSE_API_KEY exists:', !!process.env.LLAMAPARSE_API_KEY);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('AZURE_DOC_INTELLIGENCE_KEY exists:', !!process.env.AZURE_DOC_INTELLIGENCE_KEY);
console.log('AZURE_DOC_INTELLIGENCE_ENDPOINT exists:', !!process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT);