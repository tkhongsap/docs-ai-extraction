# OCR Document Extraction Application: Tasks

A running list of tasks to guide development of the OCR Document Extraction App.

---

## 1. Setup and Project Structure

- [x] **Initialize Repository**  
  - Create a new Replit project (Node.js/React) or set up a local development environment if needed.  
  - Configure `.replit` or `replit.nix` (if required) for correct installation and startup.

- [x] **Basic Folder Structure**  
  - Organize files into `frontend` (React) and `backend` (Node.js) folders.  
  - Add `package.json` files and any initial scripts (start, dev, build).

- [x] **Dependencies and Configuration**  
  - Install backend dependencies (`express`, `mongoose`, `multer`, etc.).  
  - Install frontend dependencies (`react`, `react-router-dom`, UI libraries).  
  - Create or update `README.md` detailing project goals, setup instructions, and deployment notes.

- [x] **Docker/Replit Environment**  
  - If using Docker: set up a `Dockerfile` and `docker-compose.yml`.  
  - For Replit: ensure environment variables (OCR keys, DB connections) are added to Replit's Secrets panel.

---

## 2. Frontend UI & Routing

- [ ] **Overall UI Layout**  
  - Create a clean, responsive layout with consistent navigation (header, sidebar, or top bar).  
  - Ensure WCAG 2.1 AA accessibility compliance (color contrast, keyboard navigation).

- [x] **Dashboard/Home**  
  - Display recently uploaded documents and quick links (upload, documents list).  
  - Show summary of processing stats (e.g., total documents, completed, in-progress, errors).
  - Implement hero section with app description and prominent CTAs.
  - Create feature cards highlighting key capabilities.
  - Add a clear upload document CTA as specified in requirements.

- [x] **Upload Page**  
  - Implement drag-and-drop file upload area and fallback file input.  
  - Validate file type (PDF, JPEG, PNG, TIFF) and size (<10MB).  
  - Display progress bar for file uploads.

- [x] **Processing Page**  
  - Show document processing status with a progress indicator.  
  - Poll or use websockets to update status in real time.  
  - Allow cancellation of in-progress processing.

- [x] **Documents List Page**  
  - List all uploaded documents with sorting and filtering (by name, date, status).  
  - Provide pagination for large lists.  
  - Include a quick link or icon to go to each document's review/detail view.
  - Add date range filtering options.
  - Implement color-coded status indicators.
  - Create responsive grid layout for different screen sizes.

- [x] **Review Page**  
  - Display side-by-side original document preview and extracted data.  
  - Provide tabs for invoice fields, line items, handwritten notes, etc.  
  - Let users edit extracted fields with auto-save or save button.  
  - Include export buttons (Markdown, JSON).
  - Add document preview with zoom and rotate capabilities.
  - Implement responsive design for mobile and tablet users.
  - Add metadata display with OCR confidence scores.
  - Ensure synchronized scrolling between document and data.

---

## 3. Backend: Document Management & API

- [ ] **PostgreSQL Integration**  
  - Connect to PostgreSQL (Atlas or local).  
  - Create `Document` model (id, filename, status, uploadDate, storagePath, etc.).  
  - Create `Extraction` model (id, documentId, invoice details, line items, handwritten notes, etc.).

- [ ] **Upload Endpoint**  
  - `POST /api/documents`: handle file upload via `multer` (multipart/form-data).  
  - Store files in a designated directory or cloud storage.  
  - Return newly created document info (ID, filename, status).

- [ ] **Document CRUD**  
  - `GET /api/documents`: list all documents with pagination.  
  - `GET /api/documents/:id`: fetch a single document's metadata.  
  - `DELETE /api/documents/:id`: remove a document from storage and DB (if needed).  
  - Basic error handling (invalid IDs, missing documents, etc.).

- [ ] **Processing Endpoint**  
  - `POST /api/documents/:id/process`: trigger OCR/handwriting recognition for the uploaded file(s).  
  - Update document status (processing, completed, error).

---

## 4. OCR & Handwriting Recognition

- [ ] **OCR Service Integration**  
  - Connect to OpenAI Vision API or a similar service.  
  - Implement calls in a service module (e.g., `services/ocrService.js`).  
  - Parse OCR results and store recognized text plus confidence scores.

- [ ] **Handwriting Recognition**  
  - Connect to LlamaParse (or alternative) for handwritten text extraction.  
  - Merge handwritten data into the `Extraction` model.  
  - Handle low-confidence text and potentially provide alternative suggestions.

- [ ] **Error & Confidence Handling**  
  - If OCR confidence < threshold, mark fields for manual review.  
  - Graceful retries or fallback if the OCR service is down or times out.

---

## 5. Data Structuring & Review

- [ ] **Document Type Identification**  
  - Determine if the document is an invoice, receipt, or "other" for structured extraction.  
  - Use LlamaParse or rules-based parsing for invoice fields (vendor, date, total amount, etc.).

- [x] **Review & Editing**  
  - Allow user corrections of fields on the Review Page.  
  - Implement an edit flow where user changes are saved to the `Extraction` model.

- [x] **Data Export**  
  - `GET /api/extractions/:id/export/markdown`: export all data as Markdown.  
  - `GET /api/extractions/:id/export/json`: export data as JSON.  
  - Preserve structured data (line items, notes) in the exported files.

---

## 6. Testing & QA

- [ ] **Backend Tests**  
  - Use `Jest` or similar testing framework for API endpoints.  
  - Validate file upload, DB operations, error handling.

- [ ] **Frontend Tests**  
  - Implement unit tests for core components (upload form, document list).  
  - Use a testing library (e.g., React Testing Library) for UI validation.

- [ ] **End-to-End Testing**  
  - Use Cypress or Playwright to simulate user flows (upload, process, review, export).  
  - Ensure the app works end-to-end on Replit or your chosen environment.

- [ ] **Performance Checks**  
  - Measure how quickly OCR requests complete under typical loads.  
  - Optimize where needed (e.g., caching or concurrency limits).

---

## 7. Future Enhancements (Placeholder)

- [ ] **Authentication & Role-Based Access**  
  - Restrict document access based on user login.  
  - Provide multi-user collaboration features.

- [ ] **Advanced Template Configuration**  
  - Let users define custom fields or templates for specialized document types.

- [ ] **Analytics & Reporting**  
  - Provide usage metrics, document throughput, and OCR accuracy tracking.

- [ ] **3rd-Party Integrations**  
  - Integrate with external platforms (e.g., accounting software, Slack webhooks, etc.).

---

**Note**: The tasks above should be moved between "in progress," "completed," and "upcoming" sections as development proceeds. Keep this file updated in your repository to maintain a clear, evolving roadmap for the OCR Document Extraction Application.
