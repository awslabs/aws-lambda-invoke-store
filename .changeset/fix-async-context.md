---
"@aws/lambda-invoke-store": patch
---

Fix context cleared prematurely in InvokeStoreSingle with async functions. Removed try-finally block that was clearing context before async operations completed.
