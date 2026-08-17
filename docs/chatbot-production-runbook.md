# Chatbot production runbook

1. Deploy backend with AI disabled
2. Health checks
3. Configure OpenAI secret on Render
4. Embedding dry-run then embed approved knowledge
5. Create/verify Atlas vector index (optional)
6. Offline evals (`--fail-on-critical`)
7. Controlled live synthetic evals
8. Enable AI for limited testing
9. Verify citations + boundaries
10. Gradual rollout
11. Monitor aggregate metrics only
12. Disable immediately on grounding/safety regression

Rollback: set `AI_ASSISTANT_ENABLED=false` and/or `LLM_PROVIDER=disabled`.
