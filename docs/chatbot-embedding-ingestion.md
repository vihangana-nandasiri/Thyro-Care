# Chatbot embedding ingestion

```bash
cd backend
python -m app.scripts.embed_approved_knowledge --dry-run
python -m app.scripts.embed_approved_knowledge --batch-size 16
python -m app.scripts.embed_approved_knowledge --document-id <id> --force-reembed
```

Rules:

- Only APPROVED active chunks
- Idempotent on `chunk_id + content_hash + embedding_model`
- Retired/inactive chunks deactivated
- Never prints full medical bodies
- API key from environment only (`OPENAI_API_KEY` / provider settings)
- Never embeds patient chats
