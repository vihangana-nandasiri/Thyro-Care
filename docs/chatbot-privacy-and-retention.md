# Chatbot privacy and retention

- No full patient prompts/answers in production application logs
- Audit summaries store lengths/modes/versions only
- Provider store disabled (`OPENAI_STORE_RESPONSES=false`)
- Soft-deleted messages excluded from provider context
- Export omits tokens and internal secrets
- Feedback comments are not sent to the provider and are not used for fine-tuning

Config:

```
CHAT_RETENTION_DAYS=
CHAT_HARD_DELETE_ENABLED=false
```

Automatic destructive retention jobs are documented only; not enabled by default.
