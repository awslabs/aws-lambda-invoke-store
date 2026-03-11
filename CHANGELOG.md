# @aws/lambda-invoke-store

## 0.2.3

### Patch Changes

- use global namespace when defining awslambda InvokeStore global type ([8437cdc564712b5ff4055bb69afa85ad9543952d](https://github.com/awslabs/aws-lambda-invoke-store/commit/8437cdc564712b5ff4055bb69afa85ad9543952d))

## 0.2.2

### Patch Changes

- Fix context cleared prematurely in InvokeStoreSingle with async functions. Removed try-finally block that was clearing context before async operations completed. ([9bed56d892dbe8473a9b8b7f3c4aa5f4e6612057](https://github.com/awslabs/aws-lambda-invoke-store/commit/9bed56d892dbe8473a9b8b7f3c4aa5f4e6612057))

## 0.2.1

### Patch Changes

- include types declarations ([002c21bab6404f5d59b81ada7f7f6db710f432ca](https://github.com/awslabs/aws-lambda-invoke-store/commit/002c21bab6404f5d59b81ada7f7f6db710f432ca))

## 0.2.0

### Minor Changes

- Invoke Store is now accessible via `InvokeStore.getInstanceAsync()` instead of direct instantiation ([d14bda46410ff5e46777795f8ed4c6e8fcc90e7b](https://github.com/awslabs/aws-lambda-invoke-store/commit/d14bda46410ff5e46777795f8ed4c6e8fcc90e7b))
  - Lazy loads `node:async_hooks` to improve startup performance
  - Selects dynamic implementation based on Lambda environment:
    - Single-context implementation for standard Lambda executions
    - Multi-context implementation (using AsyncLocalStorage)

## 0.1.1

### Patch Changes

- Update build configuration to output ESM and CommonJS ([b34bfcfb20299f8affbd0c0f33266bad2a0009a7](https://github.com/awslabs/aws-lambda-invoke-store/commit/b34bfcfb20299f8affbd0c0f33266bad2a0009a7))

## 0.1.0

### Minor Changes

- Add support for tenantId ([83fa470303d9283930e0f79e9c70ab09cbca6771](https://github.com/awslabs/aws-lambda-invoke-store/commit/83fa470303d9283930e0f79e9c70ab09cbca6771))

## 0.0.2

### Patch Changes

- Set up release scripts ([c12740efa370880560a55c21cae1fcecad267053](https://github.com/awslabs/aws-lambda-invoke-store/commit/c12740efa370880560a55c21cae1fcecad267053))

## 0.0.1

### Major Changes

- Initial code Node.js Invoke Store for AWS Lambda ([c6c89c1a1b3fbf0357a5dce4ca4a0463e02df2fc](https://github.com/awslabs/aws-lambda-invoke-store/commit/c6c89c1a1b3fbf0357a5dce4ca4a0463e02df2fc))
