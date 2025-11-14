---
"@aws/lambda-invoke-store": minor
---

- `InvokeStore` is now accessible via `InvokeStore.getInstance()` instead of direct instantiation

- Lazy loading of `node:async_hooks` to improve startup performance
- Dynamic implementation selection based on Lambda environment:
  - Single-context implementation for standard Lambda executions
  - Multi-context implementation (using AsyncLocalStorage)
