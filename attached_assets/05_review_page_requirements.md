### 4.5 Review Page

The Review Page allows users to inspect the original document alongside extracted text and data, make corrections, and export final results. It serves as the primary interface for refining OCR output and verifying invoice or handwritten note details.

---

#### 4.5.1 Features

1. **Side-by-Side View of Original Document and Extracted Data**  
   - Display the uploaded file (PDF/image) next to the structured data (invoice fields, handwritten notes, etc.).  
   - Provide synchronized scrolling or a clear separation so users can easily refer back to the original document when editing data.

2. **Tabbed Interface for Different Data Categories**  
   - Separate extracted information into logical tabs (e.g., "Invoice Details," "Line Items," "Handwritten Notes," "Metadata").  
   - Allow quick switching between tabs without reloading the entire page.

3. **Data Editing Capabilities**  
   - Let users correct or modify any parsed text directly in editable fields (e.g., invoice number, vendor name).  
   - Include validation for certain data types (e.g., numeric fields like total amount).

4. **Export Functionality for Extracted Data**  
   - Support exporting the finalized data to Markdown or JSON.  
   - Preserve structure in these exports, especially for line items and tables.

5. **Document Metadata Display**  
   - Show basic metadata such as upload date, file size, OCR confidence scores (optional), and document status (completed, reprocessing, etc.).  
   - Potentially allow editing of high-level fields like document title or tags (if the application supports them).

---

#### 4.5.2 UI Components

1. **Document Preview Panel**  
   - An embedded PDF or image viewer, allowing zoom, scroll, and page navigation (for multi-page documents).  
   - Accommodate basic tools like rotate if necessary (optional).

2. **Extracted Data Panel (Tabbed)**  
   - Display separate tabs for:
     - **Invoice Details Section**: Key-value pairs (e.g., "Invoice Number: 12345").  
     - **Line Items Table**: Structured entries with columns (description, quantity, unit price, total).  
     - **Handwritten Notes**: Any recognized handwritten text with confidence scores.  
     - **Metadata**: Basic info about the document (upload date, size, OCR engine used, etc.).

3. **Edit Button for Data Modification**  
   - Each field or table cell can have an "Edit" icon or a direct inline editing mechanism.  
   - Alternatively, a global "Edit Mode" switch could enable editing for all fields at once.

4. **Export Dropdown**  
   - Dropdown or button group (e.g., "Export as…") to select the desired format:
     - **Markdown**: Convert extracted data into a human-readable markdown format.  
     - **JSON**: Provide a machine-friendly output for integration with other systems.

---

#### 4.5.3 User Interactions

1. **Switch Between Data Tabs**  
   - Click on different tabs (e.g., Invoice Details, Line Items) to reveal relevant extracted data.  
   - Maintain or remember the user's last open tab if they navigate away and return (optional).

2. **Edit Extracted Data Fields**  
   - Click an "Edit" icon (or inline field) to modify text, numbers, or dates.  
   - Save automatically after a field loses focus, or provide a global "Save" button for batch updates.

3. **Export Data**  
   - Choose an export format (Markdown or JSON) via a dropdown.  
   - Download the file or display it in a modal for copying.  
   - Confirm or display success messages after export.

4. **Navigate Back to Documents List**  
   - Provide a "Back to Documents" or "All Documents" button to help users return to the main list.  
   - Maintain any existing filter or sort states (if the user came from a filtered list).

5. **View Original Document**  
   - Scroll or zoom through the PDF/image to compare text positions with extracted fields.  
   - For multi-page PDFs, allow navigation across pages within the preview panel.

---

#### 4.5.4 Technical Requirements

1. **Document Viewer for PDF and Images**  
   - Use a library or built-in component capable of rendering PDFs/images within the browser.  
   - Support multi-page navigation for PDFs, ensuring minimal performance overhead (lazy-load pages if needed).

2. **Editable Form Fields for Data Correction**  
   - Provide form controls for text, numeric, and date fields.  
   - Include basic client-side validation (e.g., date format checks, numeric fields for amounts).

3. **Export Functionality for Multiple Formats**  
   - Implement routes in the backend (e.g., `/api/extractions/:id/export/markdown`) or handle export logic in the frontend.  
   - Ensure line items and structure are preserved in the resulting Markdown/JSON files.

4. **Validation of Edited Data**  
   - If certain fields (e.g., total amount) must be numeric, display an error message or highlight invalid inputs.  
   - Optionally store a version history or track changes if the user repeatedly edits.

5. **Auto-Save of Edited Content**  
   - Either auto-save after each field change or provide a "Save Changes" button.  
   - Ensure backend updates are atomic, with clear success/failure notifications.  
   - Consider concurrency or conflict resolution if multiple users could edit simultaneously (future enhancement).

---

#### 4.5.5 LlamaParse Integration Requirements

1. **LlamaParse-Specific Data Display**
   - **Vendor Information Section**: Display vendor name, contact information, and logo (if detected) with clear highlighting.
   - **Invoice Details Formatting**: Present invoice dates, numbers, and references in a standardized format with proper labeling.
   - **Line Item Enhancement**: Show line item descriptions with potential product codes and categorization from LlamaParse.
   - **Total Calculations Section**: Display subtotals, tax breakdowns, discounts, and final amounts with proper currency formatting.

2. **Advanced Field Validation**
   - **Field Type Recognition**: Utilize LlamaParse's field type detection to apply appropriate validation rules (numeric, date, text).
   - **Format Consistency**: Ensure date formats follow a consistent pattern based on detected locale.
   - **Currency Validation**: Apply proper decimal precision and currency symbol based on invoice currency.
   - **Cross-Field Validation**: Verify that line items total matches the invoice total and highlight discrepancies.

3. **Confidence Score Visualization**
   - **Visual Confidence Indicators**: Use color-coding (green/yellow/red) to indicate confidence levels for extracted fields.
   - **Confidence Statistics**: Display average confidence scores by section (header fields, line items, totals).
   - **Low Confidence Alerts**: Highlight fields with confidence below threshold (< 70%) for user verification.
   - **Confidence Filtering**: Allow users to filter view to show only low-confidence extractions for focused review.

4. **Layout-Aware Field Relationships**
   - **Spatial Correlation**: Utilize LlamaParse's layout understanding to relate extracted data to document positions.
   - **Semantic Grouping**: Group related fields together based on their semantic relationships detected by LlamaParse.
   - **Table Structure Preservation**: Maintain the original table structure of line items with proper alignment and formatting.

5. **Enhanced Export Options**
   - **Structured Format Options**: Support additional export formats beyond basic JSON/Markdown (e.g., Excel, CSV).
   - **Data Relationship Preservation**: Maintain hierarchical relationships between data elements in exports.
   - **Template-Based Exports**: Allow users to select from predefined export templates optimized for different downstream systems.
   - **Confidence Inclusion**: Option to include or exclude confidence scores in exports for quality assessment.

6. **Reprocessing Capabilities**
   - **Selective Reprocessing**: Allow users to reprocess specific sections of a document without redoing the entire extraction.
   - **Processing Parameter Adjustment**: Let users modify LlamaParse parameters for reprocessing (e.g., optimize for invoices vs. receipts).
   - **Before/After Comparison**: Show differences between original and reprocessed extractions for user evaluation.

---

**Implementation Notes**  
- Keep the side-by-side layout responsive: on smaller screens, stack the document preview above or below the extracted data.  
- Provide large enough preview and data panels for easy reading (possibly allow resizing if advanced).  
- Use accessible patterns (aria attributes, well-labeled form fields, logical tab order).  
- Consider displaying confidence scores next to each field, so users know which data is most likely to need review.  
- Maintain consistent design and interactions with the rest of the application (color, typography, icons).
