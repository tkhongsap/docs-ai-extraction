# Product Requirements Document – Ingestion Service (Rev A)

**Component of:** AI Document Extraction Platform  **Version:** 0.2  **Date:** 08 May 2025  **Author:** AI Solutions Team

---

## 1 . Purpose & Scope

The **Ingestion Service** is the human‑facing entry point for all source documents in the MVP. Finance or AP users manually upload PDF/JPEG/PNG/TIFF files through a secure web form (or a simple REST endpoint). The service assigns a unique **Document ID**, stores the original file on a local ingest share, performs light pre‑processing, then makes a **synchronous HTTP call** to the **Classification Service** to continue the pipeline.

> **MVP simplification:** No watched folders, object storage, or Kafka. All interactions are direct and synchronous within the on‑prem network.

---

## 2 . Functional Requirements

|  ID      |  Requirement                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  ING‑F1  | Provide a secure **web UI** (drag‑and‑drop + file picker) for manual uploads.                                                                            |
|  ING‑F2  | Expose **REST API** `POST /api/v1/documents` (multipart/form‑data) for automated tests or future integration.                                            |
|  ING‑F3  | Support multi‑page PDFs; retain page order metadata without splitting the file.                                                                          |
|  ING‑F4  | Generate `document_id` (UUID v4) and persist metadata `{document_id, filename, status:"RECEIVED"}` in SQLite or lightweight Postgres.                    |
|  ING‑F5  | Validate content‑type (PDF/JPEG/PNG/TIFF) and size ≤ 20 MB. Reject unsupported files with HTTP 400.                                                      |
|  ING‑F6  | Optional pre‑processing: auto‑rotate ±90°, deskew ≤ 5°, convert CMYK→sRGB. Store both original & processed copy under `/data/ingest/<document_id>/`.     |
|  ING‑F7  | Invoke **Classification Service** via `POST /classify` with JSON `{document_id, file_path}` and await 200 OK before marking status `FOR_CLASSIFICATION`. |
|  ING‑F8  | Provide a `/health` endpoint returning 200 and build metadata.                                                                                           |

---

## 3 . Non‑Functional Requirements

* **Throughput:** ≥ 5 docs/min sustained (manual upload pace).
* **Latency:** ≤ 5 s from upload click to Classification Service ACK (P95 for 10 MB file).
* **Durability:** Files stored on RAID‑backed local disk with nightly backup; manual restore if disk fails.
* **Security:** HTTPS (TLS 1.2+); uploads require SSO‑authenticated session. Virus scan with ClamAV before persistence.

---

## 4 . Interfaces

### 4.1 Web UI Upload (Primary path)

* Single‑page form at `/upload` secured by company SSO.
* Drag‑and‑drop zone plus file picker (accept multiple files).
* Displays progress bar and shows **Document ID** on success.

### 4.2 REST API (Secondary/testing path)

```
POST /api/v1/documents
Headers: Authorization: Bearer <token>
Body (multipart/form‑data):
  file=<file>
  source_system (optional)
Returns: 201 { "document_id": "…", "status": "RECEIVED" }
```

### 4.3 Downstream Call

```
POST /classify
Body: { "document_id": "…", "file_path": "/data/ingest/…/original.pdf" }
Response: 200 { "received": true }
```

---

## 5 . Error Handling

| Scenario                             | Behaviour                                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Unsupported file‐type/size           | Return HTTP 400 with `error_code:"UNSUPPORTED_MEDIA"`.                                                                             |
| Virus detected                       | Delete file, log incident, return HTTP 422.                                                                                        |
| Disk write failure                   | Retry ×3; on final failure return HTTP 500 and log.                                                                                |
| Classification Service not reachable | Retry ×3 with 2 s back‑off; if still failing, queue the document for later and set status `WAITING_CLASSIFIER`. Admin alert email. |

---

## 6 . KPIs & Acceptance Criteria

|  KPI                               | Target                     |
| ---------------------------------- | -------------------------- |
|  Successful ingestion rate         |  ≥ 99 % for valid uploads. |
|  Average upload → classify latency |  ≤ 3 s (P50) for 5 MB PDF. |
|  Manual upload UX score            |  ≥ 4/5 in user UAT survey. |

*Acceptance Tests*

1. Given a valid 3 MB PDF, when uploaded via web UI, then a Document ID is returned and file exists at `/data/ingest/<id>/original.pdf`.
2. Given a 25 MB PNG, when uploaded, service responds 400.
3. If Classification Service returns 200, status moves to `FOR_CLASSIFICATION`.

---

## 7 . Dependencies

* Local disk array `/data/ingest` (≥ 100 GB free).
* Company SSO / OAuth2 for authentication.
* Classification Service API reachable on internal network.
* ClamAV for virus scanning.

---

## 8 . Out of Scope

* Watched folders, Kafka topics, or cloud object storage.
* Any OCR/AI logic beyond minor image pre‑processing.

---

End of document.
