import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { createInvokeStore, InvokeStore as OriginalImport } from "./invoke-store.js";


describe.each([
  { label: 'multi-concurrency', config: { env: { AWS_LAMBDA_MAX_CONCURRENCY: '10' } } },
  { label: 'single-concurrency', config: undefined }
])('InvokeStore with %s', async ({ config }) => {
  await createInvokeStore(config);

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

    it("should store the instance in globalThis.awslambda", async () => {
      // THEN
      expect(globalThis.awslambda.InvokeStore).toBeDefined();
      expect(await globalThis.awslambda.InvokeStore).toBe(await OriginalImport);
    });

    it("should share context between original import and global reference", async () => {
      // GIVEN
      const testRequestId = "shared-context-test";
      const testKey = "test-key";
      const testValue = "test-value";

      const originalImportAwaited = await OriginalImport;

      // WHEN - Use the original import to set up context
      await originalImportAwaited.run(
        { [ originalImportAwaited.PROTECTED_KEYS.REQUEST_ID]: testRequestId },
        async () => {
          originalImportAwaited.set(testKey, testValue);

          // THEN - Global reference should see the same context
          const globalInstance = globalThis.awslambda.InvokeStore!;
          expect(globalInstance.getRequestId()).toBe(testRequestId);
          expect(globalInstance.get(testKey)).toBe(testValue);
        }
      );
    });

    it("should maintain the same storage across different references", async () => {
      // GIVEN
      const globalInstance = globalThis.awslambda.InvokeStore!;
      const OriginalImportAwaited = await OriginalImport;
      const globalInstanceAwaited = await globalInstance;
      const testRequestId = "global-test";
      const testKey = "global-key";
      const testValue = "global-value";

      // WHEN - Set context using global reference
      await globalInstance.run(
        { [OriginalImportAwaited.PROTECTED_KEYS.REQUEST_ID]: testRequestId },
        async () => {
          globalInstance.set(testKey, testValue);

          // THEN - Original import should see the same context
          expect(OriginalImportAwaited.getRequestId()).toBe(testRequestId);
          expect(OriginalImportAwaited.get(testKey)).toBe(testValue);
        }
      );
    });
  });

  describe("InvokeStore Existing Instance", () => {
    const originalGlobalAwsLambda = globalThis.awslambda;

    beforeEach(() => {
      delete (globalThis as any).awslambda;
      globalThis.awslambda = {};

      vi.resetModules();
    });

    afterAll(() => {
      globalThis.awslambda = originalGlobalAwsLambda;
    });

    it("should use existing instance from globalThis.awslambda.InvokeStore", async () => {
      // GIVEN
      const mockInstance = {
        PROTECTED_KEYS: {
          REQUEST_ID: "_AWS_LAMBDA_REQUEST_ID",
          X_RAY_TRACE_ID: "_AWS_LAMBDA_TRACE_ID",
        },
        run: vi.fn(),
        getContext: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
        getRequestId: vi.fn().mockReturnValue("mock-request-id"),
        getXRayTraceId: vi.fn(),
        getTenantId: vi.fn().mockReturnValue("my-test-tenant-id"),
        hasContext: vi.fn(),
      };

      // @ts-expect-error - mockInstance can be loosely related to original type
      globalThis.awslambda.InvokeStore = mockInstance;

      // WHEN
      const { InvokeStore: ReimportedStore } = await import("./invoke-store.js");
      const awaitedReimportedStore = await ReimportedStore;

      // THEN
      expect(awaitedReimportedStore).toBe(mockInstance);
      expect(awaitedReimportedStore.getRequestId()).toBe("mock-request-id");
      expect(awaitedReimportedStore.getTenantId()).toBe("my-test-tenant-id");
    });
  });

  describe("InvokeStore Environment Variable Opt-Out", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete (globalThis as any).awslambda;

      vi.resetModules();
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it("should respect AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA=1", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA = "1";

      // WHEN - Import the module with the environment variable set
      const { InvokeStore } = await import("./invoke-store.js");
      const awaitedInvokeStore = await InvokeStore;

      // THEN - The global namespace should not be modified
      expect(globalThis.awslambda?.InvokeStore).toBeUndefined();

      let requestId: string | undefined;
      await awaitedInvokeStore.run(
        { [awaitedInvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id" },
        () => {
          requestId = awaitedInvokeStore.getRequestId();
        }
      );
      expect(requestId).toBe("test-id");
    });

    it("should respect AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA=true", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA = "true";

      // WHEN - Import the module with the environment variable set
      const { InvokeStore } = await import("./invoke-store.js");
      const awaitedInvokeStore = await InvokeStore;

      // THEN - The global namespace should not be modified
      expect(globalThis.awslambda?.InvokeStore).toBeUndefined();

      let requestId: string | undefined;
      await awaitedInvokeStore.run(
        { [awaitedInvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id" },
        () => {
          requestId = awaitedInvokeStore.getRequestId();
        }
      );
      expect(requestId).toBe("test-id");
    });
  });
});
