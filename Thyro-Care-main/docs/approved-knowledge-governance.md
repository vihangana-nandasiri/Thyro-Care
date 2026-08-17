# Approved knowledge governance

Statuses: DRAFT → PENDING_REVIEW → APPROVED | RETIRED.

Seed JSON under `backend/app/content/approved_knowledge/` is **PENDING_REVIEW** until medical-expert sign-off. Patient retrieval uses APPROVED only. Ingestion: `python -m app.scripts.ingest_approved_knowledge` (does not auto-approve).
