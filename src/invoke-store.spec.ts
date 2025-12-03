import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { InvokeStoreBase, InvokeStore } from "./invoke-store.js";

describe.each([
  { label: "multi-concurrency", isMultiConcurrent: true },
  { label: "single-concurrency", isMultiConcurrent: false },
])("InvokeStore with %s", async ({ isMultiConcurrent }) => {
  describe("InvokeStore", async () => {
    let invokeStore: InvokeStoreBase;
    beforeEach(() => {
      if (isMultiConcurrent) {
        vi.stubEnv("AWS_LAMBDA_MAX_CONCURRENCY", "2");
      }
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    invokeStore = await InvokeStore.getInstanceAsync();

    describe("getRequestId and getXRayTraceId", () => {

      it("should return current invoke IDs when called within run context", async () => {
        // WHEN
        const result = await invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "test-id",
            [InvokeStoreBase.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-id",
          },
          () => {
            return {
              requestId: invokeStore.getRequestId(),
              traceId: invokeStore.getXRayTraceId(),
            };
          },
        );

        // THEN
        expect(result.requestId).toBe("test-id");
        expect(result.traceId).toBe("trace-id");
      });
    });

    describe("custom properties", () => {
      it("should allow setting and getting custom properties", async () => {
        // WHEN
        const result = await invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "test-id",
            customProp: "initial-value",
          },
          () => {
            invokeStore.set("dynamicProp", "dynamic-value");
            return {
              initial: invokeStore.get("customProp"),
              dynamic: invokeStore.get("dynamicProp"),
            };
          },
        );

        // THEN
        expect(result.initial).toBe("initial-value");
        expect(result.dynamic).toBe("dynamic-value");
      });

      it("should prevent modifying protected Lambda fields", async () => {
        // WHEN & THEN
        await invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "test-id",
          },
          () => {
            expect(() => {
              invokeStore.set(
                InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID,
                "new-id",
              );
            }).toThrow(/Cannot modify protected Lambda context field/);

            expect(() => {
              invokeStore.set(
                InvokeStoreBase.PROTECTED_KEYS.X_RAY_TRACE_ID,
                "new-trace",
              );
            }).toThrow(/Cannot modify protected Lambda context field/);
          },
        );
      });
    });

    describe("getContext", () => {
      it("should replace context on subsequent run calls", async () => {
        // WHEN - First run
        await invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "first-id",
          },
          () => {
            expect(invokeStore.getRequestId()).toBe("first-id");
          },
        );

        // WHEN - Second run should replace context
        await invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "second-id",
          },
          () => {
            // THEN - Should have new context, not old one
            expect(invokeStore.getRequestId()).toBe("second-id");
            const context = invokeStore.getContext();
            expect(context).toEqual({
              [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "second-id",
            });
          },
        );
      });

      it("should return complete context with Lambda and custom fields", async () => {
        // WHEN
        const context = await invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "test-id",
            [InvokeStoreBase.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-id",
            customField: "custom-value",
          },
          () => {
            invokeStore.set("dynamicField", "dynamic-value");
            return invokeStore.getContext();
          },
        );

        // THEN
        expect(context).toEqual({
          [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "test-id",
          [InvokeStoreBase.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-id",
          customField: "custom-value",
          dynamicField: "dynamic-value",
        });
      });
    });

    describe("hasContext", () => {
      it("should return true when inside run context", async () => {
        // WHEN
        const result = await invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "test-id",
          },
          () => {
            return invokeStore.hasContext();
          },
        );

        // THEN
        expect(result).toBe(true);
      });
    });

    describe("error handling", () => {
      it("should propagate errors", async () => {
        // GIVEN
        const error = new Error("test error");

        // WHEN
        const promise = invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "test-id",
          },
          async () => {
            throw error;
          },
        );

        // THEN
        await expect(promise).rejects.toThrow(error);
      });

      it("should handle errors in concurrent executions independently", async () => {
        // GIVEN
        const traces: string[] = [];

        // WHEN
        await Promise.allSettled([
          invokeStore.run(
            {
              [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "success-id",
            },
            async () => {
              traces.push(`success-${invokeStore.getRequestId()}`);
            },
          ),
          invokeStore.run(
            {
              [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "error-id",
            },
            async () => {
              traces.push(`before-error-${invokeStore.getRequestId()}`);
              throw new Error("test error");
            },
          ),
        ]);

        // THEN
        expect(traces).toContain("success-success-id");
        expect(traces).toContain("before-error-error-id");
      });
    });

    describe("edge cases", () => {
      it("should handle synchronous functions", () => {
        // WHEN
        console.log(InvokeStore);
        const result = invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "test-id",
          },
          () => {
            return invokeStore.getRequestId();
          },
        );

        // THEN
        expect(result).toBe("test-id");
      });

      it("should handle promises that reject synchronously", async () => {
        // GIVEN
        const error = new Error("immediate rejection");

        // WHEN
        const promise = invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "test-id",
          },
          () => {
            return Promise.reject(error);
          },
        );

        // THEN
        await expect(promise).rejects.toThrow(error);
      });
    });
  });
});
