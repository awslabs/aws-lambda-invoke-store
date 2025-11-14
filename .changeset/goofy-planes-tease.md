---
"@aws/lambda-invoke-store": minor
---

Invoke Store is now accessible via `InvokeStore.getInstanceAsync()` instead of direct instantiation

- Lazy loads `node:async_hooks` to improve startup performance
- Selects dynamic implementation based on Lambda environment:
  - Single-context implementation for standard Lambda executions
  - Multi-context implementation (using AsyncLocalStorage)
