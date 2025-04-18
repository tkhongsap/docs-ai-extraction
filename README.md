# OCR Document Extraction Application

A modern web application for extracting text and structured data from documents using OCR and handwriting recognition technologies.

## Project Goals

- Create a user-friendly interface for uploading and processing documents
- Extract text from both printed and handwritten content on documents
- Structure extracted data for invoices, receipts, and other document types
- Provide review and editing capabilities for extracted information
- Export processed data in useful formats (Markdown, JSON)

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **OCR Services**: OpenAI Vision API, LlamaIndex
- **State Management**: React Query
- **Routing**: Wouter
- **Form Handling**: React Hook Form with Zod validation

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database 
- API keys for OCR services (OpenAI, Mistral)

### Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create `.env` file with the following variables:
   ```
   DATABASE_URL=your_postgresql_connection_string
   OPENAI_API_KEY=your_openai_api_key
   MISTRAL_API_KEY=your_mistral_api_key
   SESSION_SECRET=your_session_secret
   ```
4. Start the development server:
   ```
   npm run dev
   ```

### Replit Deployment

1. Fork the Replit project
2. Add the required environment variables in the Replit Secrets panel
3. Click the Run button to start the application

## Project Structure

- `/client` - React frontend application
  - `/src/components` - UI components
  - `/src/pages` - Page components
  - `/src/lib` - Utility functions and shared logic
  - `/src/hooks` - Custom React hooks

- `/server` - Node.js/Express backend
  - `/routes.ts` - API endpoints
  - `/services` - OCR integration and document processing
  - `/python_ocr` - Python OCR processing scripts
  - `/db.ts` - Database connection and configuration

- `/shared` - Code shared between frontend and backend

## Main Features

- Document upload with drag-and-drop support
- OCR processing with multiple service options
- Document management dashboard
- Side-by-side document review with extracted data
- Data editing and correction interface
- Export options for processed data
- Responsive design for all devices

## Deployment Notes

- The application is configured to deploy on Replit
- PostgreSQL database connection is required
- For larger files, configure adequate storage space
- API rate limits apply to OCR services - implement queuing for production use 