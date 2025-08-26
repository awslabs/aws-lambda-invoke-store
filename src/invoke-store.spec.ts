import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { InvokeStore } from "./invoke-store.js";

describe("InvokeStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("run", () => {
    it("should maintain isolation between concurrent executions", async () => {
      // GIVEN
      const traces: string[] = [];

      // WHEN - Simulate concurrent invocations
      const isolateTasks = Promise.all([
        InvokeStore.run(
          {
            [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "request-1",
            [InvokeStore.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-1",
          },
          async () => {
            traces.push(`start-1-${InvokeStore.getRequestId()}`);
            await new Promise((resolve) => setTimeout(resolve, 10));
            traces.push(`end-1-${InvokeStore.getRequestId()}`);
          },
        ),
        InvokeStore.run(
          {
            [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "request-2",
            [InvokeStore.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-2",
          },
          async () => {
            traces.push(`start-2-${InvokeStore.getRequestId()}`);
            await new Promise((resolve) => setTimeout(resolve, 5));
            traces.push(`end-2-${InvokeStore.getRequestId()}`);
          },
        ),
      ]);
      vi.runAllTimers();
      await isolateTasks;

      // THEN
      expect(traces).toEqual([
        "start-1-request-1",
        "start-2-request-2",
        "end-2-request-2",
        "end-1-request-1",
      ]);
    });

    it("should maintain isolation across async operations", async () => {
      // GIVEN
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "request-1",
        },
        async () => {
          traces.push(`before-${InvokeStore.getRequestId()}`);
          const task = new Promise((resolve) => {
            setTimeout(resolve, 1);
          }).then(() => {
            traces.push(`inside-${InvokeStore.getRequestId()}`);
          });
          vi.runAllTimers();
          await task;
          traces.push(`after-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        "before-request-1",
        "inside-request-1",
        "after-request-1",
      ]);
    });

    it("should handle nested runs with different IDs", async () => {
      // GIVEN
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "outer",
        },
        async () => {
          traces.push(`outer-${InvokeStore.getRequestId()}`);
          await InvokeStore.run(
            {
              [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "inner",
            },
            async () => {
              traces.push(`inner-${InvokeStore.getRequestId()}`);
            },
          );
          traces.push(`outer-again-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        "outer-outer",
        "inner-inner",
        "outer-again-outer",
      ]);
    });
  });

  describe("getRequestId and getXRayTraceId", () => {
    it("should return placeholder when called outside run context", () => {
      // WHEN
      const requestId = InvokeStore.getRequestId();
      const traceId = InvokeStore.getXRayTraceId();

      // THEN
      expect(requestId).toBe("-");
      expect(traceId).toBeUndefined();
    });

    it("should return current invoke IDs when called within run context", async () => {
      // WHEN
      const result = await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id",
          [InvokeStore.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-id",
        },
        () => {
          return {
            requestId: InvokeStore.getRequestId(),
            traceId: InvokeStore.getXRayTraceId(),
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
      const result = await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id",
          customProp: "initial-value",
        },
        () => {
          InvokeStore.set("dynamicProp", "dynamic-value");
          return {
            initial: InvokeStore.get("customProp"),
            dynamic: InvokeStore.get("dynamicProp"),
          };
        },
      );

      // THEN
      expect(result.initial).toBe("initial-value");
      expect(result.dynamic).toBe("dynamic-value");
    });

    it("should prevent modifying protected Lambda fields", async () => {
      // WHEN & THEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id",
        },
        () => {
          expect(() => {
            InvokeStore.set(InvokeStore.PROTECTED_KEYS.REQUEST_ID, "new-id");
          }).toThrow(/Cannot modify protected Lambda context field/);

          expect(() => {
            InvokeStore.set(
              InvokeStore.PROTECTED_KEYS.X_RAY_TRACE_ID,
              "new-trace",
            );
          }).toThrow(/Cannot modify protected Lambda context field/);
        },
      );
    });
  });

  describe("getContext", () => {
    it("should return undefined when outside run context", () => {
      // WHEN
      const context = InvokeStore.getContext();

      // THEN
      expect(context).toBeUndefined();
    });

    it("should return complete context with Lambda and custom fields", async () => {
      // WHEN
      const context = await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id",
          [InvokeStore.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-id",
          customField: "custom-value",
        },
        () => {
          InvokeStore.set("dynamicField", "dynamic-value");
          return InvokeStore.getContext();
        },
      );

      // THEN
      expect(context).toEqual({
        [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id",
        [InvokeStore.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-id",
        customField: "custom-value",
        dynamicField: "dynamic-value",
      });
    });
  });

  describe("hasContext", () => {
    it("should return false when outside run context", () => {
      // WHEN
      const hasContext = InvokeStore.hasContext();

      // THEN
      expect(hasContext).toBe(false);
    });

    it("should return true when inside run context", async () => {
      // WHEN
      const result = await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id",
        },
        () => {
          return InvokeStore.hasContext();
        },
      );

      // THEN
      expect(result).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should propagate errors while maintaining isolation", async () => {
      // GIVEN
      const error = new Error("test error");

      // WHEN
      const promise = InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id",
        },
        async () => {
          throw error;
        },
      );

      // THEN
      await expect(promise).rejects.toThrow(error);
      expect(InvokeStore.getRequestId()).toBe("-");
    });

    it("should handle errors in concurrent executions independently", async () => {
      // GIVEN
      const traces: string[] = [];

      // WHEN
      await Promise.allSettled([
        InvokeStore.run(
          {
            [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "success-id",
          },
          async () => {
            traces.push(`success-${InvokeStore.getRequestId()}`);
          },
        ),
        InvokeStore.run(
          {
            [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "error-id",
          },
          async () => {
            traces.push(`before-error-${InvokeStore.getRequestId()}`);
            throw new Error("test error");
          },
        ),
      ]);

      // THEN
      expect(traces).toContain("success-success-id");
      expect(traces).toContain("before-error-error-id");
      expect(InvokeStore.getRequestId()).toBe("-");
    });
  });

  describe("edge cases", () => {
    it("should handle synchronous functions", () => {
      // WHEN
      const result = InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id",
        },
        () => {
          return InvokeStore.getRequestId();
        },
      );

      // THEN
      expect(result).toBe("test-id");
    });

    it("should handle promises that reject synchronously", async () => {
      // GIVEN
      const error = new Error("immediate rejection");

      // WHEN
      const promise = InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "test-id",
        },
        () => {
          return Promise.reject(error);
        },
      );

      // THEN
      await expect(promise).rejects.toThrow(error);
      expect(InvokeStore.getRequestId()).toBe("-");
    });
  });
});
