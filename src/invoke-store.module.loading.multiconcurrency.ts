import { describe, it, expect } from 'vitest';
import { InvokeStore } from "./invoke-store.js"

describe('InvokeStore implementations', () => {
  it('should load the correct class', async () => {
    const singleStore = await InvokeStore.getInstance({
      env: { AWS_LAMBDA_MAX_CONCURRENCY: '10' }
    });
    
    expect(singleStore.constructor.name).toBe('InvokeStoreMulti');
  });
});