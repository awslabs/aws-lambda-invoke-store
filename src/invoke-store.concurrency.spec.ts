import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { InvokeStore, InvokeStoreBase } from "./invoke-store.js";

describe("InvokeStore", async () => {
  let invokeStore: InvokeStoreBase;

  beforeEach(async () => {
    vi.stubEnv("AWS_LAMBDA_MAX_CONCURRENCY", "2");
    vi.useFakeTimers();
    invokeStore = await InvokeStore.getInstanceAsync();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("run", () => {
    it("should handle nested runs with different IDs", async () => {
      // GIVEN
      const traces: string[] = [];

      // WHEN
      await invokeStore.run(
        {
          [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "outer",
        },
        async () => {
          traces.push(`outer-${invokeStore.getRequestId()}`);
          await invokeStore.run(
            {
              [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "inner",
            },
            async () => {
              traces.push(`inner-${invokeStore.getRequestId()}`);
            },
          );
          traces.push(`outer-again-${invokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        "outer-outer",
        "inner-inner",
        "outer-again-outer",
      ]);
    });

    it("should maintain isolation between concurrent executions", async () => {
      // GIVEN
      const traces: string[] = [];

      // WHEN - Simulate concurrent invocations
      const isolateTasks = Promise.all([
        invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "request-1",
            [InvokeStoreBase.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-1",
          },
          async () => {
            traces.push(`start-1-${invokeStore.getRequestId()}`);
            await new Promise((resolve) => setTimeout(resolve, 10));
            traces.push(`end-1-${invokeStore.getRequestId()}`);
          },
        ),
        invokeStore.run(
          {
            [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "request-2",
            [InvokeStoreBase.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-2",
          },
          async () => {
            traces.push(`start-2-${invokeStore.getRequestId()}`);
            await new Promise((resolve) => setTimeout(resolve, 5));
            traces.push(`end-2-${invokeStore.getRequestId()}`);
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
      await invokeStore.run(
        {
          [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "request-1",
        },
        async () => {
          traces.push(`before-${invokeStore.getRequestId()}`);
          const task = new Promise((resolve) => {
            setTimeout(resolve, 1);
          }).then(() => {
            traces.push(`inside-${invokeStore.getRequestId()}`);
          });
          vi.runAllTimers();
          await task;
          traces.push(`after-${invokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        "before-request-1",
        "inside-request-1",
        "after-request-1",
      ]);
    });
  });
});
