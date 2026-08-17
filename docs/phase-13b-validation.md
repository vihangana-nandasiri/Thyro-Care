# Phase 13B validation

## Automated

```bash
npm run ci:build
ruff check backend
ruff format --check backend
pytest backend/tests
python -m app.scripts.run_chatbot_evals --offline --fail-on-critical
```

## Manual production enablement remaining

- Render OpenAI variables
- Embedding ingestion against Atlas
- Atlas Vector Search index verification
- Controlled live-provider synthetic evals
- Gradual AI enablement

No patient chats or patient records are used for training/fine-tuning.
