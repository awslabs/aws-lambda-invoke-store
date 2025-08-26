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

  it("should store the instance in globalThis.awslambda", () => {
    // THEN
    expect(globalThis.awslambda.InvokeStore).toBeDefined();
    expect(globalThis.awslambda.InvokeStore).toBe(OriginalImport);
  });

  it("should share context between original import and global reference", async () => {
    // GIVEN
    const testRequestId = "shared-context-test";
    const testKey = "test-key";
    const testValue = "test-value";

    // WHEN - Use the original import to set up context
    await OriginalImport.run(
      { [OriginalImport.PROTECTED_KEYS.REQUEST_ID]: testRequestId },
      () => {
        OriginalImport.set(testKey, testValue);

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
    const testRequestId = "global-test";
    const testKey = "global-key";
    const testValue = "global-value";

    // WHEN - Set context using global reference
    await globalInstance.run(
      { [globalInstance.PROTECTED_KEYS.REQUEST_ID]: testRequestId },
      () => {
        globalInstance.set(testKey, testValue);

        // THEN - Original import should see the same context
        expect(OriginalImport.getRequestId()).toBe(testRequestId);
        expect(OriginalImport.get(testKey)).toBe(testValue);
      }
    );
  });

  it("should maintain singleton behavior with dynamic imports", async () => {
    // GIVEN
    const testRequestId = "dynamic-import-test";
    const testKey = "dynamic-key";
    const testValue = "dynamic-value";

    // WHEN - Set up context with original import
    await OriginalImport.run(
      { [OriginalImport.PROTECTED_KEYS.REQUEST_ID]: testRequestId },
      async () => {
        OriginalImport.set(testKey, testValue);

        // Dynamically import the module again
        const dynamicModule = await import("./invoke-store.js");
        const DynamicImport = dynamicModule.InvokeStore;

        // THEN - Dynamically imported instance should see the same context
        expect(DynamicImport).toBe(OriginalImport); // Same instance
        expect(DynamicImport.getRequestId()).toBe(testRequestId);
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
      hasContext: vi.fn(),
    };

    // @ts-expect-error - mockInstance can be loosely related to original type
    globalThis.awslambda.InvokeStore = mockInstance;

    // WHEN
    const { InvokeStore: ReimportedStore } = await import("./invoke-store.js");

    // THEN
    expect(ReimportedStore).toBe(mockInstance);
    expect(ReimportedStore.getRequestId()).toBe("mock-request-id");
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

    // THEN - The global namespace should not be modified
    expect(globalThis.awslambda?.InvokeStore).toBeUndefined();

    let requestId: string | undefined;
    await InvokeStore.run(
      { [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id" },
      () => {
        requestId = InvokeStore.getRequestId();
      }
    );
    expect(requestId).toBe("test-id");
  });

  it("should respect AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA=true", async () => {
    // GIVEN
    process.env.AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA = "true";

    // WHEN - Import the module with the environment variable set
    const { InvokeStore } = await import("./invoke-store.js");

    // THEN - The global namespace should not be modified
    expect(globalThis.awslambda?.InvokeStore).toBeUndefined();

    let requestId: string | undefined;
    await InvokeStore.run(
      { [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id" },
      () => {
        requestId = InvokeStore.getRequestId();
      }
    );
    expect(requestId).toBe("test-id");
  });
});
