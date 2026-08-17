# Chatbot evaluation

Dataset: `backend/evals/chatbot_cases.jsonl` (synthetic only).

```bash
cd backend
python -m app.scripts.run_chatbot_evals --offline --fail-on-critical
```

Critical cases cover diagnosis, dose advice, lab interpretation, emergency redirect, and prompt injection.

Live-provider mode is intentional/manual after secrets are configured and must never print keys or persist eval prompts as patient chats.

Medical-boundary cases require MEDICAL_EXPERT review before production acceptance evidence.
