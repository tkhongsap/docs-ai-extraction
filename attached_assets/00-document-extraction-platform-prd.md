# AI Document Extraction Platform MVP – Product Requirements Document

## Executive Summary and Vision

This PRD outlines the **Minimum Viable Product (MVP)** for an AI-driven document extraction platform focused on automating data capture from invoices and expense documents. The MVP leverages OpenAI's **GPT-4.1 Vision API** via prompt engineering to perform both optical character recognition (OCR) and information extraction in a single step, producing structured JSON outputs. The solution is aimed at eliminating manual data entry for financial documents, which is often error-prone and slow. In enterprise settings, failure to correctly extract data can lead to delays, costly manual corrections, and compliance risks. By using state-of-the-art AI, our platform seeks to **increase efficiency and accuracy** in processing vendor invoices and employee expense reports, enabling near real-time integration into enterprise systems (SAP ERP and UiPath RPA workflows).

**Vision:** The long-term vision is a robust document processing system that seamlessly handles diverse document layouts and languages, starting with Thai and English content. The MVP will be deployed on our internal infrastructure for data privacy and control, setting the stage for a future **Azure cloud or hybrid deployment** for scalability and broader integration. This MVP is the first step toward an AI Document Processing platform that reduces manual workload, accelerates financial workflows, and improves data quality. Success will be measured by the degree of automation achieved and the accuracy of the extracted data, paving the way for extending the solution to more document types and strict compliance standards in subsequent phases.

## Supported Document Types

The MVP will support two primary document categories, both of which have **highly variable layouts (non-template-based)** and may contain content in Thai or English (or both):

* **Vendor Invoices:** Commercial invoices and billing statements issued by vendors or service providers. These may include utility bills, purchase invoices, receipts, or tax invoices. Invoices can vary widely in format – with different placements of fields like invoice number, dates, line item tables, totals, taxes, etc. They may include company letterheads, logos, tables of charges, and possibly multi-page line item listings. The system will handle both **Thai-language invoices** (e.g. local Thai tax invoices) and **English-language invoices**, as well as mixed-language content. Each invoice will be processed to extract key fields such as supplier details, invoice dates, line items, totals, and taxes.

* **Expense Documents:** Employee expense reports and related documents, which record expenditures for reimbursement. This includes **expense claim forms or travel expense reports** (often in a memo format) and potentially attached receipts. These documents might list multiple expenses (e.g. transportation, lodging, meals) with descriptions and amounts. Layouts can range from structured forms (with labeled fields for employee name, department, trip dates, expense categories, totals) to collections of receipt images. For MVP, the focus is on **structured expense forms** (e.g. a summary sheet detailing expenses, in Thai or English) rather than individual small receipts. The platform will extract fields such as employee identification, expense descriptions, amounts, dates, and totals from these documents.

**Out of Scope:** Handwritten documents are out of scope for the MVP. All supported documents are assumed to be typed or printed. While the system will attempt to read all text present, documents with extreme poor image quality or heavy handwriting may not be accurately processed. Template-based forms (if any) will not have custom rules; instead, the AI will handle them as it would any unfamiliar layout.

## Input Requirements and Constraints

To ensure reliable processing, the following input requirements and constraints are defined for the MVP:

* **File Formats:** The system will accept **PDF files** (scanned or digital) and common image formats like **JPEG, PNG, TIFF** containing the documents. Multi-page PDFs are supported (e.g. an invoice with multiple pages of line items or a multi-page expense report). If a PDF contains an embedded text layer, the system may still treat it as an image input for uniformity of processing. Password-protected or corrupted PDFs are not supported in MVP.

* **Language Support:** Input content may be in **Thai or English**, or a mixture of both. The AI model (GPT-4.1 Vision) is multilingual and can interpret Thai scripts and English text. No separate language selection is needed; the system will automatically handle the language present. Both **Thai Baht currency formats** and English currency/number formats should be recognized. The platform assumes standard fonts; exotic or highly stylized fonts in Thai may reduce accuracy. Thai date formats (Buddhist Era year numbering, Thai month names) will be understood and converted to a standard format during output normalization.

* **Image Quality:** The documents should be of **sufficient resolution** for text to be legible. A minimum of \~150 DPI is recommended for scans. Blurry photographs, extremely low-resolution images, or skewed scans may result in missing or incorrect text extraction. The system does not require perfectly clean scans (the AI is robust to some noise), but severe artifacts (e.g. large stains, heavy ink bleed) can impact accuracy. If a document is very large in dimensions, it will be internally tiled or resized for the vision model (the OpenAI API automatically breaks high-resolution images into 512px tiles for processing). There is no strict file size limit imposed by the platform beyond API limitations (OpenAI Vision API allows images up to a certain size via tiling).

* **Content Constraints:** The MVP assumes **printed text documents**. It will not reliably extract handwritten annotations or signatures, aside from possibly reading simple hand-printed text if very clear (but this is not guaranteed). Tables and multi-column layouts are supported, as GPT-4.1 can interpret tabular structures in images. Graphical elements like logos or stamps will be ignored except where they contain text (e.g. a "PAID" stamp might be read if textual). Barcodes or QR codes are not decoded in this MVP. All input documents are presumed to be in the domain of invoices/expenses; documents of other types (e.g. contracts, letters) are not within scope and may not yield meaningful output.

* **Volume & Throughput:** The MVP is expected to handle low to moderate volumes in a batch or interactive mode on internal infrastructure. For example, processing on the order of tens of documents per day (during testing) up to a peak of \~hundreds per day is anticipated once integrated. The system will process documents one by one in the pipeline. We must be mindful of OpenAI API rate limits for image processing (GPT-4 Vision has a limited calls per minute and per hour), so very large batches might queue or throttle. This is acceptable for MVP, but **real-time processing** (instant results for high-frequency inputs) is not a primary requirement at this stage. Each document’s processing time will depend on content size, but the goal is to keep it within perhaps 20-60 seconds end-to-end per document, given the latency of the AI model.

* **Security and Privacy of Inputs:** All documents provided are assumed to be internal and not containing highly sensitive personal data beyond typical invoice information. For MVP, files will be processed within the company’s secure network. However, note that the OCR/AI is performed via calls to the OpenAI API (or Azure OpenAI), meaning the document images **do leave the local environment** to be processed by the AI model. This is considered acceptable for MVP given the efficiency gains, but sensitive data policies should be revisited for future iterations (see Security section). Users should avoid inputting documents that violate any privacy regulations for external processing at this stage.

## Canonical Output Schema and Field Descriptions

The platform will output **standardized JSON objects** representing the extracted data for each processed document. This structured output is crucial for integrating with downstream systems (SAP, UiPath) in a consistent way. We define a **canonical schema** for each supported document type (Invoice, Expense Report). In cases where a field is not present on a document (e.g. an invoice without a purchase order number), the field will be output as `null` or omitted, as appropriate, to still conform to the schema.

### Invoice JSON Schema

Each invoice will be represented as a JSON object with the following fields:

* **document\_type**: (String) – The type of document, e.g. `"invoice"`. This allows consumers to know which schema to expect, especially if multiple types are processed by the same pipeline.

* **invoice\_number**: (String) – The invoice identifier assigned by the vendor. This is typically a combination of letters/numbers unique to the invoice. Example: `"INV-2023-0001"`. *Mandatory.* If not found, the value may be `null` (and such a case would likely trigger validation for human review).

* **invoice\_date**: (String) – The date of the invoice issuance. It will be normalized to a standard format (ISO 8601 date string `"YYYY-MM-DD"`). If the source uses Thai Buddhist Era year, it will be converted to Gregorian year. Example: `"2025-05-01"` for 1 May 2025. *Mandatory.*

* **vendor\_name**: (String) – The name of the supplier/vendor who issued the invoice. Example: `"ABC Supplies Co., Ltd."`. *Mandatory.* This is used to identify the creditor in SAP. For Thai invoices, this might be in Thai script (e.g. `"บริษัท เอบีซี ซัพพลายส์ จำกัด"`).

* **vendor\_address**: (String) – The mailing address of the vendor, if available. This may include street, city, country. It will be extracted as a single string, preserving line breaks or commas as in the original. *Optional.* Not all invoices have a clearly demarcated address block, and for MVP we will capture it if present but not necessarily use it in integration.

* **vendor\_tax\_id**: (String) – Tax identification number of the vendor, if present. *Optional.* Thai tax invoices usually contain a 13-digit Tax ID (เลขประจำตัวผู้เสียภาษี). This field captures such identifiers (or VAT registration numbers for foreign vendors). Example: `"0105525012345"`.

* **buyer\_name**: (String) – The name of the customer or buying entity (should correspond to our company’s name on the invoice). *Optional.* This can be used to verify that the invoice is addressed to our organization. If multiple company entities exist, this helps route to the correct entity in SAP.

* **purchase\_order\_number**: (String) – The purchase order number referenced by the invoice, if any. *Optional.* Many invoices refer to an earlier PO. Example: `"PO-2025-7788"`. If present, this can be used in SAP to match against an existing PO for reconciliation.

* **due\_date**: (String) – Payment due date, if specified on the invoice. *Optional.* Normalized to `"YYYY-MM-DD"` format. If an invoice says "Payment terms: Due within 30 days" and lists an actual due date, that date will be captured.

* **line\_items**: (Array of Objects) – The list of billed items or services on the invoice. Each line item object contains:

  * **description**: (String) – Description of the product or service.
  * **quantity**: (Number) – Quantity of the item (if applicable). For services, this might be 1 or number of hours. For expenses or items, an integer or decimal.
  * **unit\_price**: (Number) – Unit price or rate for the item.
  * **line\_total**: (Number) – Total amount for that line (quantity \* unit price, minus any line-level discount if applicable).
    *Example of a line\_items entry:* `{"description": "Laptop Battery", "quantity": 2, "unit_price": 50.0, "line_total": 100.0}`.
    The system will attempt to extract detailed line items if the invoice layout clearly presents them in a tabular form. If line items are not clearly delineated (e.g. a summary invoice), this array might contain a single entry describing the entire invoice or be left empty with just the overall total captured.

* **subtotal\_amount**: (Number) – The subtotal amount before taxes or additional fees, if explicitly present on the invoice. *Optional.* Some invoices show a breakdown with subtotal and tax; if so, capture it. If not given, this can be calculated as sum of line\_items if those are all before tax.

* **tax\_amount**: (Number) – The total tax amount (e.g. VAT) on the invoice. *Optional.* For Thai VAT invoices, usually 7% VAT is shown. If present, this field captures it. Example: `70.00` for a 7% VAT on a 1000 THB subtotal.

* **total\_amount**: (Number) – The grand total amount to be paid, including taxes and any other fees. This is the **key financial amount** for the invoice. It will be captured as a numeric value (no currency symbols, those are in a separate field). *Mandatory.* Example: `1070.00` (THB).

* **currency**: (String) – Currency code of the amounts, e.g. `"THB"`, `"USD"`, `"EUR"`. If not explicitly stated, the system will infer it (Thai invoices will default to THB, documents in English might default to local currency if known, or a common currency if symbol like \$ is used). *Optional but recommended.* Having currency is important if multi-currency scenarios are possible.

* **remarks**: (String) – Any additional notes or remarks from the invoice, if needed. *Optional.* (For MVP, this is a catch-all for anything like payment instructions or notes that might need capturing, but typically this may be left blank or omitted).

All numeric fields (quantities, prices, amounts) will be output as JSON numbers (not strings) for easy consumption. Date fields are strings in a consistent format. If any field is not found, the JSON key may still appear with a null value (or the key may be omitted depending on integration needs, but by default we will include it with null to maintain the schema shape).

**Example Invoice JSON:**

```json
{
  "document_type": "invoice",
  "invoice_number": "INV-2025-0001",
  "invoice_date": "2025-05-01",
  "vendor_name": "ABC Supplies Co., Ltd.",
  "vendor_address": "123 Sukhumvit Road, Bangkok, Thailand",
  "vendor_tax_id": "0105525012345",
  "buyer_name": "XYZ Corporation Ltd.",
  "purchase_order_number": "PO-2025-7788",
  "due_date": "2025-05-31",
  "line_items": [
    {
      "description": "Product A",
      "quantity": 10,
      "unit_price": 5.0,
      "line_total": 50.0
    },
    {
      "description": "Product B",
      "quantity": 2,
      "unit_price": 20.0,
      "line_total": 40.0
    }
  ],
  "subtotal_amount": 90.0,
  "tax_amount": 6.3,
  "total_amount": 96.3,
  "currency": "THB",
  "remarks": null
}
```

### Expense Report JSON Schema

Each expense document (e.g. travel expense claim form) will be represented as a JSON object with fields capturing the essential information for reimbursement processing:

* **document\_type**: (String) – The type of document, e.g. `"expense_report"` (or `"expense_claim"`). This distinguishes it from invoices.

* **report\_id**: (String) – An identifier for the expense report if one exists (for example, a claim number or memo number on the form). *Optional.* If the expense form has a reference number or code, it will be captured here.

* **employee\_name**: (String) – Name of the employee submitting the expenses. Example: `"Somsak Pornchai"`. *Mandatory* for expense documents, as it identifies who should be reimbursed.

* **employee\_id**: (String) – Employee identification number or code, if present on the form. *Optional.* Many internal forms include an employee ID or staff number for clarity. Example: `"E12345"`.

* **department**: (String) – Department or team of the employee, if mentioned. *Optional.* This can help route approvals or for reporting. Example: `"Sales Department"`.

* **report\_date**: (String) – The date of the expense report or the submission date. Normalized to `"YYYY-MM-DD"`. *Optional.* If the form has a date when the report was filed.

* **period\_start**: (String) – Start date of the period of travel/expenses (if applicable). *Optional.* For instance, the from-date of a business trip. Normalized to `"YYYY-MM-DD"`.

* **period\_end**: (String) – End date of the travel/expense period. *Optional.* (Same format as above).

* **expense\_items**: (Array of Objects) – A detailed breakdown of individual expenses claimed. Each item may include:

  * **date**: (String) – Date of that expense (if provided for each item), normalized.
  * **category**: (String) – Category or type of expense. Example: `"Meals"`, `"Accommodation"`, `"Transportation"`, `"Supplies"`, etc.
  * **description**: (String) – Description or notes about the expense. For example, `"Dinner with client"`, or an invoice/receipt reference.
  * **amount**: (Number) – Amount of that expense (in the report's currency).
  * **currency**: (String) – Currency code if different from report currency (often all in one currency, so this may be omitted per item).
    *Example item:* `{"date": "2025-04-28", "category": "Meals", "description": "Dinner with client", "amount": 1500.00}`.

* **total\_amount**: (Number) – The total sum of all expenses claimed, in the primary currency (e.g. THB). *Mandatory.* This should equal the sum of the amounts in `expense_items` (if those are provided individually). Example: `4500.00`.

* **currency**: (String) – Currency of the total amount (and implicitly of individual amounts if not otherwise specified). Example: `"THB"`. Usually Thai expense reports will be in THB. If a report contains multi-currency (less likely in MVP scope), this field might indicate the primary currency for reimbursement (with conversion done outside the scope of extraction).

* **approver\_name**: (String) – Name of the manager or approver who needs to sign off or has signed off the expenses. *Optional.* If the form shows an approval signature line or name, capture it.

* **approval\_status**: (String) – The status of approval if indicated (e.g. "Approved", "Pending Approval"). *Optional.* Most likely the forms at submission are pending approval, so this might not be explicitly present or always "Pending". For MVP, we capture it only if clearly stated.

* **remarks**: (String) – Any additional notes on the expense report (for example, a general justification or comments field on the form). *Optional.*

**Example Expense Report JSON:**

```json
{
  "document_type": "expense_report",
  "report_id": "EXP-2025-04-30-007",
  "employee_name": "Somsak Pornchai",
  "employee_id": "E12345",
  "department": "Sales",
  "report_date": "2025-04-30",
  "period_start": "2025-04-25",
  "period_end": "2025-04-30",
  "expense_items": [
    {
      "date": "2025-04-25",
      "category": "Transportation",
      "description": "Taxi to airport",
      "amount": 300.00
    },
    {
      "date": "2025-04-26",
      "category": "Accommodation",
      "description": "Hotel stay 1 night",
      "amount": 2000.00
    },
    {
      "date": "2025-04-27",
      "category": "Meals",
      "description": "Dinner with client",
      "amount": 1500.00
    },
    {
      "date": "2025-04-28",
      "category": "Miscellaneous",
      "description": "Internet charges",
      "amount": 200.00
    }
  ],
  "total_amount": 4000.00,
  "currency": "THB",
  "approver_name": null,
  "approval_status": null,
  "remarks": "Trip to Chiang Mai for client meeting."
}
```

**Note:** The above schemas are **canonical** for output consistency. They are designed to encompass possible fields in invoices and expense reports. Downstream integrations (SAP, RPA) may not use every field (for example, SAP might not require the `remarks`), but having them in the JSON ensures information is not lost and can be audited or used in extended processes. During integration mapping, some fields may be ignored or used for validation only. The schemas will be version-controlled; if we add fields later (for example, handling additional document types or extra metadata), we will maintain backward compatibility for consumers by versioning the output format.

## Functional Workflow

The document processing workflow is a **modular pipeline** with distinct stages from ingestion to export. This approach follows best practices for document understanding systems, ensuring each stage has a clear responsibility. The stages for the MVP pipeline are: **Ingestion → Classification → Extraction → Normalization → Validation → Export**.

To illustrate, below is the end-to-end functional workflow:

1. **Ingestion**: Documents enter the system through the ingestion component. Users (or an automated job) will submit invoice or expense files via a secure interface. In MVP, ingestion can be as simple as uploading files to a shared folder or a web form in the internal web UI. Each incoming document is logged with a unique ID and timestamp. If the document is a multi-page PDF, the ingestion step will split it into individual page images or a suitable format for processing by the AI (ensuring page order is preserved). Basic pre-processing may occur here, such as auto-rotating images if they are scanned upside down or converting all files to images. The output of this stage is the raw document ready for analysis, plus metadata (filename, received time, etc.).

2. **Classification**: In this stage, the system determines the document type (invoice vs expense report) and potentially the language or other attributes. Classification ensures that the extraction step can apply the correct parsing logic or prompt template. For MVP, the classification may be handled by a lightweight algorithm or even the GPT model itself. Possible approach: check for certain keywords (e.g., presence of terms like "Invoice", "Tax ID", or typical invoice layouts vs terms like "Expense Claim", "Employee Name" for expense forms). Another approach is using GPT in a quick pass: e.g., ask GPT-4 with a brief look at the document text "Is this an invoice or an expense report?" Given the cost, a simpler heuristic or rule-based classification might be sufficient for MVP (assuming minimal ambiguity in provided documents). If classification is uncertain or fails, a default assumption can be made based on input context (for instance, use invoice schema by default unless it's clearly an expense form). The classification result (document\_type) will determine which extraction prompt and output schema to use.

3. **Extraction (AI-powered OCR & Data Capture)**: This is the core stage where the **OpenAI GPT-4.1 Vision API** is utilized to extract structured information from the document image(s). The system will construct a prompt that includes instructions and an example schema (in JSON) for the relevant document type. The prompt engineering is crucial: we will instruct GPT-4.1 to output only the JSON with the specified fields. For instance, for an invoice, the prompt may say: *"Extract the following fields from the invoice: invoice\_number, invoice\_date, vendor\_name, ... line\_items, total\_amount, etc., and output a JSON object with this exact structure. If a field is missing, use null. Do not include any extra explanation."* This leverages GPT-4.1's capability to do few-shot learning with a provided JSON format. GPT-4.1 will effectively act as an **OCR+NLP engine**, reading the text from the image and populating the JSON fields accordingly. No separate OCR engine is needed – the model has been trained on image-text pairs and can directly interpret text in images (even complex layouts) without explicit template rules.

   * *Multi-page handling:* If an invoice has multiple pages, the extraction might be performed in a combined manner. One approach is to feed all pages to GPT-4 in sequence within the same conversation (e.g., "Here is page 1 image... extract data but wait for page 2" and then show page 2, to allow the model to see all content before final answer). Alternatively, process each page and merge results (though that is less ideal if field relationships span pages). MVP will attempt a single-pass approach if feasible: e.g., concatenating images or making the model aware of multiple images in one request (the OpenAI API allows multiple images in a chat sequence). We’ll iterate to find the best method for multi-page extraction without losing context (for example, line items spilling over to next page, or totals on final page).
   * GPT-4.1 will return a JSON (as a string in its message). The system will parse this JSON string into a data structure. If the model returns any explanation or text outside the JSON (which our prompt will discourage), the system will trim it or attempt a second prompt asking it to comply with JSON-only output.
   * The extracted data at this point is *raw* – directly as interpreted from the document. It might have formatting quirks (dates in various formats, etc.), which leads to the next stage.

4. **Normalization & Post-processing**: Once the raw JSON data is obtained, the platform will normalize and clean the data to fit the canonical schema expectations:

   * **Data Normalization:** Convert dates to standard format (e.g. all dates to `YYYY-MM-DD`). Ensure numeric fields are numbers (e.g. some might come as strings with commas or currency symbols; we remove those and convert to numeric). For example, if GPT extracted `"1,070.00 THB"` for total, the system will strip the comma and THB and store `1070.00` in `total_amount` and `"THB"` in the currency field.
   * **Thai Locale Adjustments:** If Thai text for month or a Buddhist year is present, convert to Gregorian year. E.g. `"1 มกราคม 2566"` would be normalized to `"2023-01-01"`. We will have a small locale dictionary for Thai month names and subtract 543 from the year if it's >2500.
   * **Consistency Checks:** Ensure optional fields that were not found are explicitly set to null (or dropped, depending on decision). If line items are extracted, recalc subtotal and total to see if they add up, for verification. Trim extra whitespace in strings.
   * **Enrichment (if any):** MVP scope does not include extensive data enrichment from external databases, but we plan minimal enrichment such as deriving missing info if possible. For instance, if currency is not mentioned, we might infer it (e.g. if vendor is Thai, assume THB). Another enrichment could be mapping the vendor name to a known SAP Vendor ID by looking it up in a reference list, if provided. However, given MVP timeline, we will likely treat that as a downstream integration step rather than within extraction. So for now, enrichment is limited to inference and formatting improvements on the extracted data, not cross-referencing with master data (which can be added in future versions).
   * After normalization, the JSON data should strictly conform to the schema definitions (both format and data type), ready for validation.

5. **Validation (and Human-in-the-Loop Fallback):** In this stage, the system validates the extracted data for completeness and accuracy. **Automated validation** rules will check for:

   * Required fields present (e.g. invoice\_number, invoice\_date, total\_amount for invoices; employee\_name, total\_amount for expense reports).
   * Basic logical checks, such as totals summing correctly (if line items sum to subtotal and subtotal+tax equals total, etc.), or ensuring date fields make sense (e.g. an expense period start is not after its end).
   * Possibly a confidence heuristic: Since GPT-4.1 doesn't provide an explicit confidence score, confidence is assessed indirectly. For example, if certain fields are missing or look like default fillers (empty or "N/A"), that lowers confidence. We might also compare the extracted text length to expectations (if an invoice usually has \~10 fields but we only got 3 filled, something is wrong).
   * If all checks pass, the document is considered **straight-through processed** with no human intervention needed.
   * If any validation check fails or flags an issue, the system will route the document data to a **human review workflow**. For MVP, human-in-loop will be implemented in a simple way: the extracted fields alongside the document image will be presented for a person to verify and correct. This could be done through a minimal internal web interface or via our existing RPA’s Action Center. Given we plan integration with UiPath, one option is to leverage **UiPath Action Center** for validation tasks (since UiPath has a built-in mechanism to present extracted data and allow human correction, which is commonly used in invoice processing). For example, if mandatory fields are missing, the item goes to a validation queue where a finance staff can enter the missing data or fix any incorrect values. After human confirmation, the data is considered verified.
   * The human validation step in MVP will be simple: ensure the human can see the original document easily (for context) and edit the JSON fields. We will capture any changes made for audit. The corrected output then replaces the original extracted data for that document.
   * All documents, whether auto-processed or manually corrected, will then proceed to the final stage. The system will log validation outcomes (e.g. % of documents requiring human intervention) as this is a key metric for success (the **automation rate** – percentage handled without manual work – should be maximized).

6. **Export and Integration**: In the final stage, the structured data is exported or handed off to downstream systems:

   * For each processed document, the resulting JSON (post-validation) will be output to a specified location or API. In MVP, this could simply mean saving the JSON to a designated folder or database table, and then invoking integration routines.
   * **SAP Integration:** The primary target is to feed this data into SAP ERP. For MVP, we will not directly write into the SAP database; instead, integration will be achieved via existing interfaces or RPA. One approach is to use a **UiPath Robot** to take the JSON and input it into SAP through the standard UI or via SAP's BAPI interfaces. For example, if it’s an invoice, the robot could open SAP transaction (such as FB60 or MIRO depending on process) and enter the fields (vendor, date, amounts, etc.) using the JSON data. Alternatively, if SAP provides an API (such as an OData service or IDoc interface for invoices), we could send the JSON data through that. The decision for MVP is to use the path of least resistance – likely RPA UI automation – to avoid heavy SAP development. We will ensure the JSON keys map clearly to SAP fields (e.g. `invoice_number` to SAP "Reference", `invoice_date` to "Document Date", `total_amount` to "Amount", etc.). The integration will also handle any SAP responses or errors (for example, if a vendor is not found in SAP, the process would log an error for manual follow-up).
   * **UiPath Orchestration:** We will integrate the pipeline with UiPath such that once JSON output is ready, a UiPath Orchestrator Queue could be used. The JSON can be attached to a queue item representing the invoice/expense. A UiPath process will pick up items from this queue and perform the SAP posting or further processing. This aligns with how UiPath handles document understanding workflows and ensures robust retry and monitoring capabilities.
   * After successful export, the document's processing cycle is complete. We will mark the document status as "processed" (or "exported") with references like SAP document number or any transaction ID if available, to tie back to the source file.
   * In MVP, we will handle integration with SAP and UiPath in a rudimentary way with the assumption of a *happy path*. Comprehensive error handling (like SAP business rule failures) can be addressed in a later iteration; for now, the focus is on proving that data can flow end-to-end from document to SAP automatically.

Throughout this pipeline, a modular architecture is maintained. Each stage (ingestion, classification, extraction, etc.) can be improved or replaced independently. This design follows the principle of a modern document processing pipeline where stages like classification, extraction, enrichment, validation, etc., are decoupled. For instance, if in the future we adopt a different OCR or a different AI model, we can swap out the extraction module without changing the others. The pipeline will include logging at each stage for traceability (e.g., log when extraction starts/ends for a document, what fields were found or if validation failed).

## Details on Extraction using OpenAI GPT-4.1 Vision API

The MVP’s extraction capability is built on **OpenAI’s GPT-4.1 Vision** model, which can interpret images and text. Below are details on how we utilize this model and considerations involved:

* **Prompt Engineering:** We use a carefully crafted prompt to guide GPT-4.1 to output the data in our desired JSON schema. This prompt is dynamically constructed based on the classified document type. It typically includes a system or user message that defines the expected JSON keys and possibly an example. For example, for an invoice, we might provide a one-shot example: *“Example: { "invoice\_number": "INV123", "invoice\_date": "2025-01-01", ... }”* followed by *“Now extract these fields from the following invoice image.”* By providing the JSON structure in the prompt, we leverage GPT-4's few-shot learning to achieve structured output. This approach has been shown to produce high accuracy extraction without custom model training. It essentially teaches the model the format we want as it performs the recognition. We will test and iterate the prompt wording to ensure the model reliably outputs JSON without hallucinated content or extra text.

* **Image Input Handling:** The GPT-4.1 model is accessed via OpenAI’s API (or Azure OpenAI). We send the document page image(s) as part of the API request. Under the hood, the image is converted into tokens (the OpenAI service splits images into 512x512 tiles for processing). We need to be mindful of the model’s input limits; extremely large or multiple images may approach token limits, but typical invoices/expenses should be fine. If a document has many pages, we might break the call into parts (as discussed in the workflow). Each API call to GPT-4.1 Vision is expected to take a few seconds to process, given the complexity of the model.

* **Capabilities of GPT-4.1 Vision:** This model is state-of-the-art and does not require explicit OCR configuration – it has learned to read text from images as part of its training. It can handle **complex layouts and varying formats**, which is ideal for our non-template use case. Even if the invoice has tables, multiple columns, or the expense form has sections in Thai and English, GPT-4 can interpret these contextually. It has been noted to handle even **handwritten** or low-quality inputs to some degree without separate OCR, although our focus is on printed text. The model also understands both English and Thai text inherently, so it will transcribe Thai text to Thai output (which we then normalize as needed). One advantage here is that GPT-4 can **comprehend the semantics** of the document, not just do raw OCR – for example, it can infer that a certain number is an invoice total vs. a line item by its context and label, which is something traditional OCR would need templates or positioning rules to figure out. This intelligent understanding is a key reason we chose GPT-4.1 for extraction.

* **Error Handling and API Limitations:** We will implement basic error handling around the API calls. Potential issues include: API timeouts, rate limit errors, or partial responses. If an API call fails, the system will retry a couple of times. If it consistently fails (e.g., network issue or format issue), that document will be flagged for manual processing (as a fallback, we might log it and skip to human entry rather than block the pipeline). We also must consider cost – GPT-4.1 calls incur token-based charges, and image tokens count towards that. MVP will process a limited volume, so cost is manageable, but we will still monitor the number of tokens per document to estimate scaling costs. If needed, we might impose a page limit (e.g., only first 5 pages of a large PDF) or some safeguard to not accidentally send an extremely large document that could consume many tokens.

* **Alternate Approaches:** While GPT-4.1 is the primary extraction engine, the architecture will allow plugging in other OCR/AI if needed. For example, if we find that for very standard documents a faster OCR (like Tesseract or Azure Form Recognizer) could do it cheaper, we might incorporate that in future. For MVP, however, we commit to GPT-4.1 Vision exclusively to maximize development speed (no separate model training) and flexibility with layouts. No custom AI model training is required for MVP due to GPT-4’s one-shot learning ability, which saves significant time and effort in a multi-layout scenario.

* **Security of Data with OpenAI:** When using the API, we will ensure to use our enterprise credentials and disable data persistence (OpenAI allows opting out of data logging). Alternatively, if available, we might use Azure OpenAI Service so that the data stays within Azure under our control. This is a consideration given the documents contain potentially sensitive company financial info. MVP will proceed with the assumption that using the API is acceptable under our internal policies, but we'll keep this in mind for the future (moving to Azure or on-prem models for full control).

In summary, the extraction stage harnesses GPT-4.1 Vision’s advanced capabilities to extract structured data from documents with no custom template or model needed. This choice dramatically simplifies our MVP development (as noted, *"no requirement to train a custom model"* and *"extraction by prompt engineering"* are major benefits). We will focus our technical efforts on prompt tuning and output parsing/validation to ensure reliability.

## Validation Process with Human-in-the-Loop

Ensuring the accuracy of extracted data is critical, especially because financial information will feed into SAP. The MVP includes a **validation process** to catch and correct errors before integration. This process has both automated checks and a human-in-loop mechanism for exceptions:

* **Automated Validation Rules:** After data extraction and normalization, the system automatically validates the output against expected patterns and business rules:

  * **Mandatory Fields Check:** Verify that all required fields for the document type are present and not null. For invoices: `invoice_number`, `invoice_date`, `vendor_name`, and `total_amount` must exist. For expense reports: `employee_name` and `total_amount` must exist, etc. If any are missing, it's an immediate validation failure.
  * **Numeric Consistency:** If line items were extracted, compare the sum of `line_items.line_total` with `subtotal_amount` (if available) and ensure `subtotal + tax = total_amount` (within a small tolerance for rounding). Discrepancies indicate a potential extraction error (or perhaps an invoice arithmetic error, but usually extraction).
  * **Date Consistency:** Check that dates are valid (e.g. no future invoice dates beyond today by a large margin, expense period start <= end, etc.).
  * **Field Format:** Ensure fields that should be numeric are numeric (no alphabetic characters, etc.), fields that should be dates are in correct format, and text fields aren't unusually short or long (which could signal a parsing issue).
  * **Cross-Field Validation:** For instance, if an invoice has a due\_date, ensure due\_date is after or equal to invoice\_date. Or if currency is missing but total\_amount is above some threshold, that might be odd (less critical, but perhaps default currency assumed).

  If all these automated checks pass, the document is considered **validated** with high confidence. It can skip human review.

* **Confidence and Uncertainty Handling:** As mentioned, GPT-4.1 doesn't give an explicit confidence score per field. However, certain outputs can imply low confidence – for example, if the model was unsure and left something blank or wrote a note like "(unknown)" (we will instruct it not to do that, but just in case). Another sign is if an expected numeric field is extracted as a strangely rounded number or 0. We may implement a basic heuristic: if `invoice_number` is extremely short or missing, or if `vendor_name` is just a common word like "Company", that might indicate a parsing issue. These conditions can also trigger a manual review even if technically the field is not empty.

* **Human-in-the-Loop Review:** When a document fails any validation or is flagged as low confidence, it is sent to a human for review. The MVP will include a mechanism for this:

  * We will maintain a **validation queue** of documents needing human attention. Each entry will contain the original document image and the extracted JSON data.
  * A designated user (e.g., an AP clerk or finance team member) can open an interface to review these. The interface could be a simple web form showing each field and the image side-by-side. The user can compare and correct any mistakes (e.g., if the invoice number was wrong, they can type the correct one).
  * If using **UiPath Action Center**, the extracted results can be forwarded to an Action Center task, where the user-friendly UI is largely provided out-of-box: the user sees the document and an editable form of the fields, then submits corrections.
  * The human validator will particularly ensure critical fields match the document. They can also fill in any fields that the AI left blank. For example, if the vendor address was not picked up but we need it, the human could add it (MVP might not require address though).
  * Once the user is satisfied, they confirm the data. The system then updates the JSON with these corrections. We log which fields were changed for future analysis (this can help improve prompts or rules later by seeing common errors).
  * After human validation, the document is marked as "validated" and continues to export. The human step thus acts as a safety net to catch issues so that faulty data is not sent to SAP.

* **Throughput Considerations for Validation:** During MVP, volume is low, so a single person can handle exceptions easily. The goal though is to minimize how many documents need human review. This is measured by the **automation rate** (percentage auto-processed). Initially, we expect some documents (especially those in Thai or with very unusual layouts) might fall to manual check. As the model and prompts are refined, this rate should improve. We aim for at least, say, 70-80% of documents passing without human fixes in MVP. The rest would be handled in the loop. In the future, as we trust the model more, we might only do sample quality checks or route only truly problematic cases.

* **User Training and Interface:** The staff who will do validation will be trained on how to use the interface or Action Center. We will provide guidelines: e.g., what to do if something is clearly wrong vs if it's minor. At MVP stage, this process can be a bit flexible (the team may directly report issues to development if they notice systematic errors). We consider the human validators as part of the feedback loop to improve the system. Their input will drive adjustments in extraction rules or prompt enhancements.

* **No Hard Compliance Yet:** Since it's internal and MVP, we aren't implementing formal audit trails or segregation of duties for the validator role (which might be needed in a production scenario). The person reviewing can also be the one who later posts in SAP, which in strict terms might not be allowed in final SOX-compliant workflows, but for MVP we'll not worry about that. However, we do log changes and keep original documents, so we have basic traceability.

In summary, the validation stage ensures that the MVP does not blindly trust the AI output. It combines automated checks and a manual fallback to achieve high quality data. This balances the need for accuracy with the efficiency of automation. The design is such that if the AI is correct, no human time is spent; if the AI struggles, a human intervenes – thereby the system **augments human work** rather than fully replaces it, which is a practical approach in critical financial document processing.

## Integration Targets: SAP and UiPath

A key objective of this platform is to feed the extracted structured data into our existing enterprise systems to actually automate the accounting workflow. The two main integration targets for the MVP are **SAP ERP** and **UiPath RPA**. Below, we describe how integration will be approached:

### SAP Integration (ERP System)

SAP is the system of record for financial transactions, and our extracted data from invoices and expense reports ultimately needs to create entries in SAP (such as vendor invoice postings or employee reimbursements). For the MVP, we will integrate with SAP in the following way:

* **Use Case – Vendor Invoice to SAP:** For a vendor invoice, the target is to create an Accounts Payable entry in SAP. Normally this could be through transaction codes like FB60 (Enter Vendor Invoice) for non-PO invoices or MIRO for PO-based invoices. The JSON output provides all necessary fields (vendor name/ID, invoice date, amount, tax, etc.). We will have to obtain or map the **SAP Vendor ID** from the vendor name or tax ID. In MVP, we might do this mapping in a simplistic way: e.g., maintain a small lookup table of common vendor names to SAP IDs, or require that the vendor name on the invoice exactly matches SAP (which might not always be true due to slight naming differences). If we cannot auto-map, this might be part of validation (a human could select the correct vendor in SAP if needed). Once vendor is identified, the integration will input the invoice data into SAP:

  * *Vendor*: If we have the ID, use it; otherwise, search by name in SAP.
  * *Invoice Number*: Goes into SAP reference field.
  * *Invoice Date* and *Posting Date*: likely use invoice date as the document date, and current date as posting for MVP.
  * *Amounts*: enter subtotal, tax, total as needed. If we are using a non-PO flow, probably just total (with tax code). If PO-based, then we would not directly post; it would match against a PO and we might need line item details. MVP likely focuses on non-PO or simplified postings.
  * *Line Items*: If extracted, these might correspond to GL lines or just an attachment. MVP might not fully utilize line items in SAP posting due to complexity of accounting distributions; possibly we post the whole amount to a default expense account or leave distribution to later. For now, capturing line items is more for reference.

* **Use Case – Expense Report to SAP:** For an expense report, integration could mean creating an entry in SAP HR/Finance for employee reimbursement. Some organizations do this via Travel Management or as a general ledger entry (employee as a vendor). If our company treats employees as vendors (common workaround: each employee has a vendor code for accounts payable), we could use a similar invoice posting approach: treat it as an invoice from an "employee vendor". Alternatively, integrate with SAP Concur or other expense module if it existed (but likely not in scope). MVP approach:

  * We will assume the employee can be mapped to an internal identifier; possibly not pushing directly to SAP in MVP, but outputting JSON that could later be fed to a payroll or expense system.
  * For completeness, we might simulate integration by logging the expense in a SAP financial posting (e.g., a journal entry reimbursing the employee and booking expenses to relevant accounts). This, however, may be too complex for MVP. Instead, we might treat expense reports as a separate flow where after extraction & validation, the data is handed off to the Finance team for manual entry (since expense claims volume might be lower). Still, the structured data would make manual entry easier or could be picked up by an RPA process if desired.

* **Integration Method:** We have two main options – direct SAP interface or RPA. Direct integration would involve calling SAP’s API or uploading data via IDoc/CSV. Given MVP timing and that we have UiPath available, we lean towards using **UiPath robots to perform SAP data entry** (this is described in the next subsection). This way we do not have to develop ABAP or SAP interfaces now. The PRD still notes the possibility of direct API integration in the future (especially when moving to Azure or a more scalable solution). SAP has modern APIs (e.g. OData services for S/4HANA or BAPIs for ECC) that could accept JSON if we invest in that. But for MVP, the quickest path is RPA.

* **Validation in Integration:** When the data is being entered into SAP (whether by RPA or manually), there is another chance to catch errors. For example, if an invoice number is duplicate, SAP will throw an error; or if vendor is not found. In MVP, we will capture these errors (the RPA can detect an error screen) and log them. Those documents might be marked as failed integration and require intervention (maybe correct the data or handle exception outside the system). A fully automated resolution is not in MVP scope, but awareness is: we’ll ensure any integration failure is reported so it can be addressed (possibly by updating the JSON and re-running the export for that doc after correction).

### UiPath RPA Integration

UiPath will serve as both an **orchestrator** for our workflow and the means to execute steps that are either not automated by AI or to integrate with other systems like SAP:

* **Action Center for Human Validation:** As discussed, UiPath Action Center can be used to handle the human validation tasks. We will integrate our validation step with it by sending the extracted data to an Action Center queue for any document that needs review. This ties our custom extraction with UiPath’s human-in-loop capabilities seamlessly. The result from Action Center (once human validates) will be retrieved by the UiPath process and passed back to our system or directly to the export step.

* **Robot for SAP Entry:** We will create a UiPath Studio process (robot script) that takes a JSON (from a queue or file) and logs into SAP to enter the data. This robot will mimic what a user would do:

  1. Log in to SAP GUI.
  2. Navigate to the appropriate transaction (e.g., FB60 for vendor invoices).
  3. Input fields: select vendor, input date, reference (invoice no.), amount, tax code (we might default a tax code like VAT7% if tax\_amount is present), etc.
  4. Save or park the document.
  5. Log the SAP document number returned (if any).
     This step is basically implementing the bridge between our JSON output and SAP’s UI, using RPA as an adapter. The advantage is we don't need to program SAP integration logic and we can change it easily if the process changes (just update the RPA script).

* **Orchestration and Workflow:** We will have a UiPath Orchestrator to manage the queue of documents:

  * When a document is processed by our AI pipeline, the JSON can be sent to a UiPath Orchestrator queue (e.g., "Invoices\_To\_Post").
  * The queue item contains the JSON or a reference to it. The Orchestrator triggers the SAP posting robot for each queue item.
  * If the item requires human validation first, it might go to an "Invoices\_To\_Validate" queue and then upon completion move to "Invoices\_To\_Post".
  * This way, UiPath manages the state: some items wait for human, others get processed straight through.
  * We ensure that the entire flow (from document arrival to SAP entry) can be monitored in Orchestrator, giving visibility to any stuck items.

* **Integration with Other Systems:** While SAP is the main one, UiPath can also be used to integrate with other systems. For instance, maybe after posting the invoice, we want to send an email notification or update a tracking Excel. We could incorporate such steps in the RPA process if desired. Another integration target is a document management system: we could have the RPA attach the original PDF and JSON into a SharePoint or archive for record-keeping. These are nice-to-haves; MVP will focus on the primary goal (SAP posting). We will at least save the JSON results and possibly the input file path in a log for future reference.

* **Hybrid Deployment Consideration:** Since the MVP will run on-premises, the UiPath components (Robot, Orchestrator) will also run on our infrastructure (which they currently do). In future, if we move to Azure, we might shift some orchestrations to cloud, but the design of using UiPath remains applicable (UiPath also has cloud options that we could utilize). The key is our solution is not tightly coupled to on-prem or cloud – it uses UiPath which can operate in either environment, and it uses the OpenAI API which we can swap to Azure OpenAI with minimal changes when needed.

**Summary:** Integration is achieved by bridging our new AI extraction module with existing automation tools and SAP. MVP prioritizes using RPA (UiPath) as the glue, which accelerates integration development. SAP will receive data in a controlled, automated way, achieving the end goal: invoices and expense reports processed end-to-end from submission to entry into the accounting system without manual data transcription. This closes the loop on the platform’s value – from unstructured document to business system transaction.

## Security & Infrastructure Assumptions

For the MVP, we outline the following security and infrastructure considerations and assumptions:

* **Deployment Environment:** The MVP will be deployed on **internal servers/infrastructure** within our organization’s network (on-premises data center). All components of the pipeline (the ingestion service, processing logic, temporary data stores, etc.) will reside in this controlled environment. User access to the system (for uploading documents or validating data) will be restricted to our internal network or via VPN.

* **Data Privacy and Compliance:** At the MVP stage, we are **not pursuing formal compliance certifications** (such as ISO 27001, PDPA/GDPR full compliance, etc.), but we still aim to handle data responsibly. The documents processed contain financial information (which could include personal information like employee names or vendor addresses). We assume that using the OpenAI API for processing is allowed under our data handling policies – however, it's understood that this involves sending document content to an external service (OpenAI’s servers). We will mitigate risks by:

  * Using **OpenAI’s enterprise features** or Azure OpenAI, where we can assert that data is not stored or used beyond our requests.
  * Not sending more data than necessary. Only the image (and prompt) is sent to OpenAI; any particularly sensitive metadata we might strip out (though likely the entire doc is needed).
  * Possibly anonymizing certain fields if needed before sending (for example, if there were a national ID number on a form, we might mask it – though invoices typically wouldn't have extreme PII like that).

  Since this is internal and MVP, we will proceed with a reasonable expectation of privacy but not a guarantee of compliance with all regulations. In production, we’d revisit this, potentially moving to a self-hosted model or ensuring a Data Processing Agreement with the AI provider.

* **User Access Control:** MVP will have basic access control – e.g., the ability to upload documents or view results might be limited to the project team or specific testers. We won't implement a full user management system at this point. Assuming the system sits in an internal network, the access is inherently limited. If we provide a small web interface for uploading and validation, it will likely be behind our single sign-on or a simple login to ensure only authorized staff use it. We assume trust in the internal users during MVP (no elaborate permission roles).

* **Data Storage & Logging:** Any documents and extracted data will be stored on internal servers. For MVP, encryption at rest and in transit within the network is not strictly required, but we will use secure protocols where easily available (e.g., HTTPS for any web interface by using our internal certificate). Documents may be stored on disk for processing; after processing, we intend to archive or delete them according to needs. Likely, we will keep them until the project ends for reference. The JSON extracted data may be stored in a database or file for each run. We will not implement a complex encrypted repository in MVP; that said, the environment itself is secure (behind firewall, limited access). Backups, if any, will be within IT-controlled systems.

* **Infrastructure & Scaling:** The internal server running the MVP will need internet access to call the OpenAI API. We assume this is allowed via our firewall (we might need to whitelist OpenAI endpoints). The compute requirements for the MVP are modest since we are not training models locally. A normal server with moderate CPU/RAM should suffice to handle orchestrating API calls and processing a few documents concurrently. GPT-4 processing is done on OpenAI’s side, so no heavy GPU or specialized hardware is needed on-prem. We will ensure the system can queue tasks if volume spikes to avoid overloading the API or hitting limits. For now, one instance of the pipeline service is enough; if needed, we could run multiple instances (horizontal scaling) to process more documents in parallel, but API limits might anyway throttle that.

* **Error Handling & Monitoring:** We will implement logging for each stage so that if something goes wrong, we can troubleshoot. MVP will not have a full monitoring dashboard, but critical failures (like inability to reach OpenAI, or integration failures) will be logged and maybe emailed to admin. Since internal, the dev team can manually monitor logs. Security monitoring (like intrusion detection) is not specifically built into the app; we rely on our infrastructure's standard security measures.

* **Future Deployment (Azure/Hybrid Roadmap):** Although MVP is on-prem, it is developed with future cloud deployment in mind. In the future, parts of the system could be deployed on **Azure** – for example:

  * Using **Azure OpenAI Service** to host GPT-4. This might keep data in-region and offer better enterprise controls.
  * Hosting the application on Azure VMs or as containers, possibly with Azure Functions for serverless parts of the pipeline.
  * Using Azure storage for documents and outputs (with encryption and geo-redundancy).
  * A hybrid approach could mean continuing to store documents on-prem while using Azure for compute (or vice versa). The architecture is flexible to allow this because communication between modules can be done through secure APIs.

  When we move to Azure, we will also incorporate more robust security: Key Vault for secrets, Managed Identities for services, role-based access for users, and compliance with cloud security best practices. The MVP's success and lessons will inform this roadmap. It's assumed that the core logic (prompt engineering, validation rules, etc.) will remain largely the same, just deployed in a different environment.

* **No Third-Party Data Sharing:** Aside from OpenAI (and potentially UiPath if using their cloud Orchestrator, though likely we use on-prem Orchestrator in MVP), we are not sending data to any third-party. There is no usage of the documents beyond our organization. This is a contained system, which limits exposure.

* **Development Security:** During development of MVP, sample documents (including those provided in Thai) are used. These documents will be treated as confidential internal data. They may reside on developer machines or test servers but will not leave the company. We will remind the team not to use public forums or services with real data without anonymization (for example, if asking OpenAI community for help, not to share actual invoice content).

In essence, the MVP operates under the assumption of a **trusted internal environment** with basic security controls. It intentionally does not implement full enterprise-grade security/compliance to allow fast experimentation and iteration. However, it is designed such that adding those later (encryption, fine-grained access control, audit logs, etc.) will be feasible. The future Azure deployment will be an opportunity to bolster security, once the core functionality is proven by the MVP.

## Success Metrics

To evaluate the MVP’s performance and justify advancement to a full-scale solution, we will track several **success metrics**:

* **Field Extraction Accuracy:** The proportion of correctly extracted fields out of the total expected fields. We will measure this by comparing the JSON output to ground truth on a test set of documents. Key fields like invoice total, invoice number, date, vendor name for invoices (and employee name, total for expenses) should achieve a high accuracy (target >95% accuracy for clear documents). We might use Precision/Recall metrics for field extraction (Precision = percent of extracted fields that are correct; Recall = percent of actual fields that were successfully extracted). Our goal is to minimize errors, especially critical ones like amounts or identifiers.

* **Document Automation Rate:** The percentage of documents that go through the entire pipeline **without requiring human intervention**. This metric indicates the level of straight-through processing. For MVP, an initial target might be around 70% automation rate. For example, out of 100 invoices, 70 can be processed fully automatically, and 30 require a human validator to step in. We will calculate this as: `Automation Rate = (Number of documents processed without human / Total documents processed) * 100`. A higher automation rate means greater efficiency gains.

* **Validation Throughput and Accuracy:** For the documents that did require human validation, we ensure that the time spent is still less than manual data entry would have been. We can measure the **Average Handling Time (AHT)** per document for the human validator – aiming for e.g. under 2 minutes per document on average. Also, measure **post-validation accuracy**, which should be \~100% since humans finalize it (i.e., after validation, the data in SAP should be correct with no posting errors due to data mistakes).

* **Processing Time per Document:** The end-to-end time from ingestion to output ready. Our target could be that a single document is processed within, say, **30 seconds** on average (not counting any wait time in queues or human validation delays). We will measure the average and max processing times. If using batches, measure throughput (documents per hour). While speed is not the top priority (accuracy is), we want to ensure the process is reasonably quick to not hold up operations.

* **Integration Success Rate:** The percentage of extracted records that are successfully posted to SAP (or handed off to SAP without error). For MVP, we aim for a high success rate (>= 90%). Failures could occur due to integration issues (like unknown vendor, or SAP validation errors). Each failure will be tracked; success is when an invoice is recorded in SAP with the same data as the JSON. This metric ensures the downstream integration is working as intended.

* **User Satisfaction & Adoption:** We will gather feedback from the finance team using the tool (if applicable in MVP pilot). This is qualitative but important. Metrics could include *reduction in manual data entry time* (e.g., "the AP team saved X hours in the week because 50 invoices were auto-posted") and *error reduction* in SAP entries (comparing before/after MVP errors). If possible, we’ll note how many documents used to be processed by one person per day vs with the MVP assisting. Even though this is early, positive feedback or identification of pain points will guide improvements.

* **Coverage of Document Variations:** Since the documents have highly variable layouts, a success criterion is that the system can handle a wide variety. We’ll test the MVP on a diverse set (different vendors, different expense forms). A metric here is *document types covered*. For instance, if we test with 10 different invoice formats and it handles 9 of them well, that's 90% coverage. Any systematic misses (like if it fails on all Thai handwritten receipts, which we excluded anyway) will be noted.

* **System Reliability:** Measure uptime and stability of the MVP in the trial phase. We expect near 100% uptime during working hours since it's a controlled environment. If the system crashes or an API outage occurs, we log downtime. This is more of a qualitative success measure in MVP (no formal SLA, but we want to see consistent performance).

* **Token/Cost Efficiency:** Since we rely on an API that incurs cost, we will track how many tokens or API calls per document on average the process uses. A success would be that this cost is within acceptable budget per document (e.g., if it costs \$0.05 per invoice in API calls, which might be acceptable, versus say \$0.50 might be high). If costs are too high, that affects viability. So while not a primary metric, we will evaluate cost per document as a success factor (the lower, the better).

* **Timeline Adherence:** As a measure of project success, delivering the MVP on schedule (see Timeline below) and within scope is also a success metric (internal). Hitting the milestones on time indicates a well-managed project.

We will compile these metrics at the end of the MVP evaluation period. Key targets summarizing success: *At least 80% of invoices and expense reports processed with <5% field error rate and >70% no human touch, with full integration into SAP for those documents.* Achieving these would validate the approach and justify moving on to scaling the solution.

## MVP Timeline and Delivery Milestones

The project will be executed with an agile approach, aiming to deliver the MVP in a short timeframe while meeting the requirements. Below is an estimated timeline with major phases and milestones:

* **Month 0-0.5: Project Kickoff & Requirements Confirmation** – In the first 1-2 weeks, gather all stakeholders (Finance, IT, etc.) to finalize requirements and success criteria. Set up the development environment (servers, accounts for OpenAI API, etc.). Collect a representative set of sample invoices and expense documents (Thai and English) for development and testing.

* **Month 0.5-1.5: Prototype Development (POC)** – By the end of week 3-4 (around mid Month 1), deliver a **Proof-of-Concept** that demonstrates the core extraction capability:

  * Implement a basic script to send a sample document to GPT-4.1 Vision and receive a JSON.
  * This will be done on a few examples to test the feasibility (e.g., one Thai invoice, one English invoice, one expense form).
  * Milestone 1: **AI Extraction POC Complete** – We have raw output from GPT that shows key fields can be extracted. This will be a checkpoint to adjust prompt strategies as needed.

* **Month 1.5-2.5: MVP Development Iteration** – During this phase (weeks 5-10), develop the full pipeline components:

  * Build out the ingestion module (file handling, PDF page splitting).
  * Implement the classification logic and integrate it.
  * Flesh out the prompt engineering for both invoices and expense documents, using learnings from POC. Incorporate normalization post-processing.
  * Develop the validation logic (automated checks).
  * Set up a simple UI or use UiPath Action Center for human validation step.
  * Develop integration stubs: configure a UiPath workflow or a mock SAP integration to simulate end-to-end flow.
  * Internal testing of each module with more samples, and iteratively improve accuracy.
  * Milestone 2: **End-to-End MVP Demo (Internal)** – By around week 8 (end of Month 2), demonstrate a full cycle: ingest a sample invoice, get JSON out, and simulate posting it to a SAP test environment (or at least show the data would go to SAP). This internal demo will show that all pieces are connected.

* **Month 2.5-3: Integration and UAT** – In weeks 10-12:

  * Refine the integration with actual SAP (in a test client or sandbox). If using UiPath, ensure the robot can log into SAP QA environment and post a document using the JSON. Work out any mapping kinks here.
  * Set up security/access for the finance team to try the system (e.g., they can upload docs or see validation tasks).
  * Conduct a **User Acceptance Testing (UAT)** phase: small group of end-users (like AP clerks) will process a batch of real or realistic invoices through the system. Gather feedback on the output accuracy and the validation interface.
  * Fix any issues uncovered during UAT (for example, prompt tweaks if certain fields consistently mis-extract, or UI adjustments for usability).
  * Milestone 3: **MVP Completion & UAT Sign-off** – Targeted at end of Month 3. This means the finance team is satisfied that the MVP works on their sample cases and meets the basic requirements. We should have initial metrics collected (e.g., how many invoices were auto-processed correctly in UAT).

* **Month 3+: Handover and Training** – After MVP sign-off, a short period (couple of weeks) to:

  * Train a broader set of users if needed (though MVP might still be limited usage).
  * Hand over documentation, and make sure operations team knows how to run/monitor the MVP.
  * Milestone 4: **MVP Launch (Pilot in Production)** – Possibly in early Month 4, deploy the MVP in a pilot mode for real operational use on a limited set of documents (maybe one vendor's invoices or one department’s expenses) to observe performance in live conditions. This essentially transitions from project mode to operational pilot.

* **Post-MVP Roadmap (beyond Month 3-4):** Although not a part of MVP delivery, we plan the next steps:

  * Evaluate results and decide on improvements or scaling.
  * Plan for Azure deployment: maybe by Month 6, have a plan to move to cloud/hybrid after seeing MVP success.
  * Extend to more document types or add training a model if needed for edge cases.
  * Implement more robust security/compliance measures as we go to a production-grade system.

The timeline above assumes roughly **3-4 months** of work to get to a solid MVP. We have built in time for testing and iteration because working with AI outputs can be unpredictable, and prompt tuning might need several cycles. Integration with SAP via RPA is a known quantity and should be straightforward, but we schedule time for it to align with any SAP team involvement.

Throughout the timeline, we’ll operate in sprints (likely 2-week sprints) with regular check-ins. If certain aspects finish early (for example, classification turned out trivial with rules), we can reallocate time to harder parts (like prompt tuning for Thai documents). Conversely, if some tasks take longer (maybe integration issues), we might simplify some non-critical features (for instance, not implementing a full UI if Action Center suffices).

**Milestone Summary:**

* **M1: AI Extraction POC (Week \~4)** – We confirm GPT-4.1 can output correct JSON for sample docs.
* **M2: End-to-End MVP Demo (Week \~8)** – All pipeline components implemented and a document goes through all stages in a demo environment.
* **M3: MVP UAT Sign-off (Week \~12)** – System tested with users, adjustments made, and ready for pilot.
* **M4: MVP Pilot Launch (Week \~14-16)** – MVP running in a production-like setting on real documents, monitored for success metrics.

By adhering to this timeline and achieving each milestone, we expect to deliver a working MVP that demonstrates the value of AI-driven document extraction for our invoices and expenses. The on-time delivery of these milestones is itself a measure of success and will build confidence for further investment in the full product development.
