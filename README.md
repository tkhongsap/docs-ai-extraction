# OCR Document Extraction Application

A modern web application for extracting text and structured data from documents using OCR and handwriting recognition technologies.

## Project Goals

- Create a user-friendly interface for uploading and processing documents
- Extract text from both printed and handwritten content on documents
- Structure extracted data for invoices, receipts, and other document types
- Provide review and editing capabilities for extracted information
- Export processed data in useful formats (Markdown, JSON)
- Implement a robust ingestion service for document processing

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **OCR Services**: OpenAI Vision API, LlamaIndex, Mistral AI
- **State Management**: React Query
- **Routing**: Wouter
- **Form Handling**: React Hook Form with Zod validation
- **File Handling**: Multer for file uploads

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
   CLASSIFICATION_SERVICE_URL=http://localhost:5001/classify
   ```
4. Start the development server:
   ```
   npm run dev
   ```

### Windows Development Note
For Windows development, we use `cross-env` to ensure environment variables work properly across platforms. The package is included in the devDependencies.

## Current Project Structure

```
/
├── client/                  # React frontend application
│   └── src/components/      # UI components
├── server/                  # Node.js/Express backend
│   ├── services/            # Service integrations 
│   │   ├── ocrService.ts    # OCR service coordinator
│   │   ├── llamaparseWrapperService.ts  # Wrapper for LlamaIndex
│   │   └── pythonOcrService.ts  # Python OCR integration
│   ├── python_ocr/          # Python OCR scripts
│   ├── api_tests/           # API test scripts
│   ├── scripts/             # Utility scripts
│   ├── config.ts            # Configuration settings
│   ├── routes.ts            # API endpoints (including ingestion service)
│   ├── storage.ts           # Database storage interface
│   └── vite.ts              # Vite configuration
├── shared/                  # Code shared between frontend and backend
├── dist/                    # Compiled output
├── data/                    # Data storage
│   └── ingest/              # Ingestion service file storage
├── uploads/                 # Legacy file upload directory
├── docs/                    # Documentation files
└── src/                     # Source files for frontend
    └── types/               # TypeScript type definitions
```

## Key Features

- **Document Upload**: Drag-and-drop file uploading with multer integration
- **Ingestion Service**: Endpoint for processing documents with unique UUID assignment
- **OCR Processing**: Multiple service options (OpenAI, LlamaIndex, Python OCR)
- **Document Management**: Dashboard for uploaded documents
- **Review Interface**: Side-by-side document review with extracted data
- **Data Editing**: Interface for correcting extracted information
- **Export Options**: Export data as Markdown, JSON, or CSV
- **Responsive Design**: Works on desktop and mobile devices

## Ingestion Service API

The new ingestion service endpoint is available at:
```
POST /api/v1/documents
```

This endpoint accepts file uploads with the following specifications:
- Supported file types: PDF, JPEG, PNG, TIFF
- Maximum file size: 20MB
- Each uploaded document receives a unique UUID
- Returns a response with document_id and status

Sample response:
```json
{
  "document_id": "57240cd0-f015-40f8-af13-130f11a83ebe-1746846154659",
  "status": "RECEIVED"
}
```

## Deployment Notes

- The application is configured to deploy on Replit
- PostgreSQL database connection is required
- Environment variables must be properly configured
- For larger files, configure adequate storage space
- API rate limits apply to OCR services - implement queuing for production use 