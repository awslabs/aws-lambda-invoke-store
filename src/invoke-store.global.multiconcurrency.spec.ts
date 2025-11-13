import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { InvokeStore as OriginalImport } from "./invoke-store.js";


describe("InvokeStore Global Singleton", () => {
  const originalGlobalAwsLambda = globalThis.awslambda;
  const originalEnv = process.env;

  beforeAll(() => {
    globalThis.awslambda = originalGlobalAwsLambda;
  });

  afterAll(() => {
    delete (globalThis as any).awslambda;
    process.env = originalEnv;
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("should maintain singleton behavior with dynamic imports", async () => {
    // GIVEN
    const testRequestId = "dynamic-import-test";
    const testTenantId = "dynamic-import-tenant-id-test";
    const testKey = "dynamic-key";
    const testValue = "dynamic-value";

    // WHEN - Set up context with original import
    await OriginalImport.run(
      {
        [OriginalImport.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        [OriginalImport.PROTECTED_KEYS.TENANT_ID]: testTenantId,
      },
      async () => {
        OriginalImport.set(testKey, testValue);

        // Dynamically import the module again
        const dynamicModule = await import("./invoke-store.js");
        const DynamicImport = dynamicModule.InvokeStore;

        // THEN - Dynamically imported instance should see the same context
        expect(DynamicImport).toBe(OriginalImport); // Same instance
        expect(DynamicImport.getRequestId()).toBe(testRequestId);
        expect(DynamicImport.getTenantId()).toBe(testTenantId);
        expect(DynamicImport.get(testKey)).toBe(testValue);

        // WHEN - Set a new value using dynamic import
        const newKey = "new-dynamic-key";
        const newValue = "new-dynamic-value";
        DynamicImport.set(newKey, newValue);

        // THEN - Original import should see the new value
        expect(OriginalImport.get(newKey)).toBe(newValue);
      }
    );
  });
});