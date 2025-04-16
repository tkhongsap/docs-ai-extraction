### 4.2 Upload Page

The Upload Page enables users to submit documents for OCR processing. It should provide an intuitive drag-and-drop experience, clear file validation and progress indicators, and straightforward error handling.

---

#### 4.2.1 Features

1. **Drag-and-Drop Interface**  
   - A dedicated dropzone where users can drag files directly to the web page.  
   - Provide visual feedback when files are dragged over the dropzone.

2. **Multiple File Selection and Upload**  
   - Allow users to select multiple files simultaneously, either via drag-and-drop or file browser.  
   - Cap the number of files at a configurable limit (e.g., up to 10 files at a time).

3. **File Type Validation**  
   - Only accept PDFs, JPEGs, PNGs, and TIFFs.  
   - Display an error or warning if an unsupported file type is added.

4. **Upload Progress Indication**  
   - Show a progress bar or percentage for each file being uploaded.  
   - Include overall progress if multiple files are queued.

5. **File Size Validation and Feedback**  
   - Enforce a maximum file size of 10MB.  
   - Alert users if an uploaded file exceeds this limit, and optionally prevent upload.

6. **OCR Service Selection**  
   - Provide a dropdown menu to select the OCR service after files are selected.  
   - Include three options: LlamaParse, Mistral, and OpenAI OCR.  
   - Display the dropdown after files are selected and validated, before initiating the upload.  
   - Retain the selected OCR service for all files in the current upload batch.

---

#### 4.2.2 UI Components

1. **Dropzone Area**  
   - Visually marked region indicating where users can drag files.  
   - Change style (e.g., outline color or background) when files are dragged over.

2. **File Browser Button**  
   - For users who prefer clicking a button to open their file explorer.  
   - Ensure consistent labeling (e.g., "Browse" or "Choose Files").

3. **List of Selected Files**  
   - Display file name, size, and a thumbnail (if appropriate).  
   - Include an icon or visual indicator if the file is valid/invalid.

4. **OCR Service Dropdown**  
   - Dropdown menu with three options: LlamaParse, Mistral, and OpenAI OCR.  
   - Appears after files have been selected.  
   - Includes a brief description or tooltip for each OCR service option.  
   - Default selection based on system recommendation or previous usage.

5. **Upload Button**  
   - Trigger the upload of all valid files in the queue.  
   - Reflect a loading or disabled state while upload is in progress.

6. **Supported File Types Information**  
   - A small info area listing acceptable file formats (PDF, JPEG, PNG, TIFF).  
   - Include notes about max file size (e.g., "Max: 10MB each").

---

#### 4.2.3 User Interactions

1. **Drag and Drop or Browse**  
   - Users can drag files into the dropzone or click a button to open the file browser.  
   - Provide immediate feedback if the user drags in invalid file types or files exceeding size limits.

2. **Remove Files**  
   - Allow users to remove individual files from the list before starting the upload.  
   - Provide a small "X" or trash icon to remove the file.

3. **Select OCR Service**  
   - After files are selected, prompt the user to choose an OCR service from the dropdown.  
   - Provide brief descriptions of each service to help with selection (e.g., best for handwriting, best for structured documents, etc.).  
   - Allow the user to change the selection before initiating upload.

4. **Start Upload**  
   - Clicking "Upload" sends all valid files to the server along with the selected OCR service information.  
   - Each file shows its own progress bar or status indicator.

5. **Cancel Upload Process**  
   - Optionally include a cancel button to stop the upload in progress (either file-by-file or all at once).  
   - Update the UI to reflect cancellations (e.g., "Upload Canceled").

6. **Feedback on Success/Failure**  
   - Show success messages for files uploaded correctly.  
   - Show detailed errors if any file fails to upload (e.g., network error, server issue).

---

#### 4.2.4 Technical Requirements

1. **Supported File Formats**  
   - PDF, JPEG, PNG, and TIFF.

2. **Maximum File Size**  
   - 10MB per file.  
   - Return errors or warnings for files exceeding this limit.

3. **Multiple File Uploads**  
   - Up to 10 files can be uploaded in one operation.  
   - Consider queuing or batching large numbers of files if needed.

4. **OCR Service Selection**  
   - Support for passing the selected OCR service (LlamaParse, Mistral, or OpenAI OCR) to the backend.  
   - Store the OCR service selection with each uploaded document.  
   - Allow for service-specific processing paths in the backend.

5. **Automatic Redirection**  
   - After successful uploads, navigate to the Processing Page where OCR status is tracked.  
   - Include logic to handle partial failures (if some files fail, decide whether to proceed or remain on the upload page).

---

**Implementation Notes**  
- Implement secure upload handling on the backend (e.g., use a library like `multer` for Node.js).  
- Validate file metadata both on the client side (for instant feedback) and server side (for security).  
- Provide accessibility support: keyboard accessibility for file browser button, aria-labels for status messages, and descriptive text for any icons used.  
- Optimize upload performance by potentially supporting parallel uploads or chunked uploads if necessary.  
- Maintain responsive design so the dropzone, file list, and progress indicators remain user-friendly on various screen sizes.  
- Ensure that the OCR service selection is prominently displayed and easy to understand for users.  
- Consider adding a "Remember my preference" option for the OCR service selection to improve user experience for repeat uploads.
