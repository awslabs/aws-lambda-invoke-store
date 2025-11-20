import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import {
  InvokeStoreBase,
  InvokeStore as OriginalImport,
} from "./invoke-store.js";

describe("InvokeStore Global Singleton", () => {
  const originalGlobalAwsLambda = globalThis.awslambda;
  const originalEnv = process.env;
  let invokeStore: InvokeStoreBase;

  beforeAll(() => {
    globalThis.awslambda = originalGlobalAwsLambda;
  });

  afterAll(() => {
    delete (globalThis as any).awslambda;
    process.env = originalEnv;
  });

  beforeEach(async () => {
    vi.stubEnv("AWS_LAMBDA_MAX_CONCURRENCY", "2");
    process.env = { ...originalEnv };
    invokeStore = await OriginalImport.getInstanceAsync();
  });

  it("should maintain singleton behavior with dynamic imports", async () => {
    // GIVEN
    const testRequestId = "dynamic-import-test";
    const testTenantId = "dynamic-import-tenant-id-test";
    const testKey = "dynamic-key";
    const testValue = "dynamic-value";

    // WHEN - Set up context with original import
    await invokeStore.run(
      {
        [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        [InvokeStoreBase.PROTECTED_KEYS.TENANT_ID]: testTenantId,
      },
      async () => {
        invokeStore.set(testKey, testValue);

        // Dynamically import the module again
        const dynamicModule = await import("./invoke-store.js");
        const dynamicImport =
          await dynamicModule.InvokeStore.getInstanceAsync();

        // THEN - Dynamically imported instance should see the same context
        expect(dynamicImport).toBe(invokeStore); // Same instance
        expect(dynamicImport.getRequestId()).toBe(testRequestId);
        expect(dynamicImport.getTenantId()).toBe(testTenantId);
        expect(dynamicImport.get(testKey)).toBe(testValue);

        // WHEN - Set a new value using dynamic import
        const newKey = "new-dynamic-key";
        const newValue = "new-dynamic-value";
        dynamicImport.set(newKey, newValue);

        // THEN - Original import should see the new value
        expect(invokeStore.get(newKey)).toBe(newValue);
      },
    );
  });
});
