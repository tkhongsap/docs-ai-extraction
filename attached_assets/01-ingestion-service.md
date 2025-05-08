# Product Requirements Document – Ingestion Service

**Component of:** AI Document Extraction Platform
**Version:** 0.1 (Draft) **Date:** 08 May 2025 **Author:** AI Solutions Team

---

## 1 . Purpose & Scope

The Ingestion Service is the entry point for all source documents. It securely receives raw files (PDF, JPEG, PNG, TIFF), assigns a unique Document ID, stores the originals, and publishes a message to downstream components for classification. Scope covers file handling, preliminary quality checks, and metadata capture; OCR/AI processing is out‑of‑scope.

## 2 . Functional Requirements

|  ID    | Description                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| ING‑F1 | Accept uploads via REST API, watched network folder, and optional web UI drag‑and‑drop.                           |
| ING‑F2 | Support multi‑page PDFs; extract page order metadata without splitting file.                                      |
| ING‑F3 | Generate **DocumentID** (UUID v4) and persist in `documents` table with status `RECEIVED`.                        |
| ING‑F4 | Validate file type & size ≤ 25 MB. Reject others with error 400.                                                  |
| ING‑F5 | Basic pre‑processing: auto‑rotate (±90°), deskew ≤ 5°, convert CMYK → sRGB. Store both original & processed copy. |
| ING‑F6 | Publish Kafka message `{document_id, storage_path}` to topic `doc.ingested`.                                      |
| ING‑F7 | Expose health‑check endpoint `/health` returning 200 and build info.                                              |

## 3 . Non‑Functional Requirements

* **Throughput:** ≥ 20 docs/minute sustained.
* **Latency:** ≤ 2 s from upload to message publish (P95).
* **Durability:** Files stored on redundant NAS or Azure Blob with 99.9 % durability.
* **Security:** TLS 1.2+ on all endpoints, virus scan before persistence; access via OAuth2 service account.

## 4 . Interfaces

### 4.1 REST Upload

```
POST /api/v1/documents
Headers: Authorization: Bearer <token>
Body (multipart/form‑data):
  file=<file>
  source_system (optional)
  user_id (optional)
Returns 201 { document_id, status:"RECEIVED" }
```

### 4.2 Kafka Message Schema (`doc.ingested`)

```json
{
  "document_id": "6c4d…",
  "file_path": "s3://docs/original/6c4d…pdf",
  "processed_path": "s3://docs/processed/6c4d…pdf",
  "timestamp": "2025-05-08T09:12:33Z"
}
```

## 5 . Error Handling & Retries

* Invalid file → HTTP 400 with reason.
* Storage failure → retry ×3 with back‑off; on persistent failure emit `doc.error` event and mark status `FAILED`.
* Oversize file → HTTP 413.

## 6 . KPIs & Acceptance Criteria

* **KPI‑1** Successful ingestion rate ≥ 99 % for supported formats.
* **KPI‑2** Average ingestion latency ≤ 1 s (file ≤ 10 MB).
* **Acceptance:** Given a valid PDF, service returns 201, stores file, and emits Kafka message visible to classifier within 2 s.

## 7 . Dependencies

* Shared object storage (NAS/Azure Blob).
* Confluent Kafka cluster.
* OAuth2 identity provider.

## 8 . Out of Scope

* Virus scanning deeper than basic signature match.
* Any OCR or AI extraction.

---

End of document.
