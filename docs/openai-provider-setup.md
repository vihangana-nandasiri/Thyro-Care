# OpenAI provider setup

Render (never Cloudflare / never VITE):

```
AI_ASSISTANT_ENABLED=true
LLM_PROVIDER=openai
OPENAI_API_KEY=<secret>
OPENAI_CHAT_MODEL=<configured model>
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_STORE_RESPONSES=false
OPENAI_TIMEOUT_SECONDS=25
OPENAI_MAX_RETRIES=1
```

Keep initially:

```
MODERATION_ENABLED=false
VECTOR_SEARCH_ENABLED=false
```

The backend uses the Responses API with `store=False`, structured JSON output, and safe failure mapping. Raw provider exceptions are not returned to patients.
