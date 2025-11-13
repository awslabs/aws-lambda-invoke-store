import { describe, it, expect } from 'vitest';
import { createInvokeStore } from "./invoke-store.js"

describe('InvokeStore implementations', () => {
  it('should create different implementations based on environment', async () => {
    const singleStore = await createInvokeStore({
      env: {}
    });
    
    expect(singleStore.constructor.name).toBe('InvokeStoreSingle');
    
    if (globalThis.awslambda) {
      globalThis.awslambda.InvokeStore = undefined;
    }

    const multiStore = await createInvokeStore({
      env: { AWS_LAMBDA_MAX_CONCURRENCY: '10' }
    });
    
    expect(multiStore.constructor.name).toBe('InvokeStoreMulti');
  });
});
