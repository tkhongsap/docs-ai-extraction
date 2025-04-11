### 4.3 Processing Page

The Processing Page provides users with real-time feedback on the status of OCR and handwriting recognition. It should display each document’s progress, handle cancellations or errors gracefully, and guide users to the next steps (e.g., reviewing or uploading more documents).

---

#### 4.3.1 Features

1. **Real-Time Status Tracking**  
   - Continuously update the page to reflect changes in each document’s processing state (in queue, processing, completed, error).

2. **Progress Indicators per Document**  
   - Show individual progress bars or percentage indicators.  
   - If multiple pages or files are being processed, indicate per-page progress or show aggregated progress.

3. **Descriptive Status Updates**  
   - Provide textual messages (e.g., “Extracting text…,” “Analyzing handwriting…,” “Parsing invoice data…”).  
   - Distinguish between normal processing and error states.

4. **Automatic Navigation**  
   - Once a document finishes processing, automatically redirect the user (or provide a clear CTA) to the Review Page.  
   - Optionally, let users remain on the Processing Page until all documents are complete.

---

#### 4.3.2 UI Components

1. **List of Documents in Progress**  
   - Display a card or list item for each document.  
   - Include key identifiers (file name, upload date, number of pages, etc.).

2. **Progress Bars**  
   - A visual representation (e.g., a horizontal bar) showing how far along each document is in the OCR pipeline.  
   - Update dynamically as the process moves from one step to the next.

3. **Status Indicators**  
   - Icons or color-coded labels (e.g., “Queued,” “In Progress,” “Error,” “Completed”).  
   - Possibly show a small spinner for “In Progress.”

4. **Cancel Button**  
   - Allows users to stop the processing of a specific document if needed.  
   - Should confirm user intent (e.g., a pop-up or an “Are you sure?” message).

5. **View Completed Button**  
   - Button or link to jump directly to a document’s Review Page once it finishes processing.  
   - Could appear individually for each completed document or as a global option if all are completed.

---

#### 4.3.3 User Interactions

1. **Monitor Processing**  
   - Users can observe the ongoing status of each document.  
   - The interface updates automatically without requiring a manual refresh.

2. **Cancel Processing**  
   - Ability to cancel a specific document’s processing, removing it from the queue or stopping the OCR service call.  
   - Update the UI to reflect a canceled state (no further progress).

3. **Navigate to Review Page**  
   - If a document is complete, users can click a “View Completed” button or similar CTA.  
   - The user is directed to the Review Page for data editing and export.

4. **Return to Dashboard or Upload More**  
   - Provide quick links/buttons to go back to the Dashboard or open the Upload Page again.  
   - This is especially useful if the user wants to queue additional files while others are processing.

---

#### 4.3.4 Technical Requirements

1. **Real-Time Updates (Polling or WebSockets)**  
   - Implement a mechanism (e.g., setInterval polling or WebSocket push) for the frontend to receive the latest statuses.  
   - Ensure updates are frequent enough for a responsive user experience without overloading the server.

2. **Graceful Error Handling**  
   - If a document fails to process, show a clear error message on the corresponding item.  
   - Allow retrying or reprocessing if appropriate.

3. **Timeout Handling**  
   - Some documents may take longer to process (large PDFs, complex handwriting).  
   - Decide on a max processing time or a fallback for extremely long operations.

4. **Clear Status Messaging**  
   - Distinguish between different stages:  
     - **Queued**: Waiting for OCR/handwriting tasks to start.  
     - **Processing**: OCR or handwriting recognition in progress.  
     - **Completed**: Done and ready to review.  
     - **Error**: An issue occurred during processing (e.g., service error, file corrupted).  
     - **Canceled**: User manually stopped the process.

---

**Implementation Notes**  
- Consider using a separate thread or microservice for processing so the main server remains responsive.  
- Provide user-friendly updates (e.g., “Parsing invoice data — 50% complete,” “Performing handwriting recognition — 75% complete”).  
- If multiple documents are being processed, handle concurrency carefully (e.g., limit how many can be processed at once if resources are constrained).  
- Store partial results for documents in the event of cancellation or errors, so the user can retry or salvage partial OCR data.  
- Maintain accessible design (labels, aria-live regions for status updates, keyboard accessibility for Cancel buttons).
