# OCR Document Extraction Application

A web application for extracting text and structured data from documents using OCR and handwriting recognition.

## Project Goals

- Create a user-friendly interface for uploading and processing documents
- Extract text from both printed and handwritten content on documents
- Structure extracted data for invoices, receipts, and other document types
- Provide review and editing capabilities for extracted information
- Export processed data in useful formats (Markdown, JSON)

## Setup Instructions

### Prerequisites

- Node.js (14.x or higher)
- MongoDB database (local or Atlas)
- API keys for OCR services (OpenAI Vision API, LlamaParse, etc.)

### Local Development

1. Clone the repository
2. Install backend dependencies:
   ```
   cd backend
   npm install
   ```
3. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```
4. Create `.env` file in the backend directory with:
   ```
   PORT=3001
   MONGODB_URI=your_mongodb_connection_string
   OPENAI_API_KEY=your_openai_api_key
   LLAMAPARSE_API_KEY=your_llamaparse_api_key
   ```
5. Start the development servers:
   ```
   # In backend directory
   npm run dev
   
   # In frontend directory (separate terminal)
   npm start
   ```

### Replit Deployment

1. Fork the Replit project
2. Add the following secrets in the Replit Secrets panel:
   - `MONGODB_URI`
   - `OPENAI_API_KEY` 
   - `LLAMAPARSE_API_KEY`
3. Click the Run button to start the application

## Project Structure

- `/frontend` - React application (UI components, routing, state management)
- `/backend` - Node.js/Express server (API endpoints, database integration)
  - `/models` - MongoDB schema definitions
  - `/routes` - API route handlers
  - `/services` - OCR integration, document processing
  - `/middleware` - Authentication, error handling, etc.

## Deployment Notes

- The application is configured to deploy on Replit
- MongoDB Atlas is recommended for database hosting
- For larger files, consider configuring cloud storage (S3, Google Cloud Storage)
- API rate limits apply to OCR services - implement queuing for production use 