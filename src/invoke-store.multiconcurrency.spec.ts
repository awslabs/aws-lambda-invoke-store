import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { InvokeStore } from "./invoke-store.js";

describe("InvokeStore", async () => {

  const awaitedInvokeStore = await InvokeStore;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("run", () => {

    it("should handle nested runs with different IDs", async () => {
      // GIVEN
      const traces: string[] = [];

      // WHEN
      await awaitedInvokeStore.run(
        {
          [awaitedInvokeStore.PROTECTED_KEYS.REQUEST_ID]: "outer",
        },
        async () => {
          traces.push(`outer-${awaitedInvokeStore.getRequestId()}`);
          await awaitedInvokeStore.run(
            {
              [awaitedInvokeStore.PROTECTED_KEYS.REQUEST_ID]: "inner",
            },
            async () => {
              traces.push(`inner-${awaitedInvokeStore.getRequestId()}`);
            },
          );
          traces.push(`outer-again-${awaitedInvokeStore.getRequestId()}`);
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
        awaitedInvokeStore.run(
          {
            [awaitedInvokeStore.PROTECTED_KEYS.REQUEST_ID]: "request-1",
            [awaitedInvokeStore.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-1",
          },
          async () => {
            traces.push(`start-1-${awaitedInvokeStore.getRequestId()}`);
            await new Promise((resolve) => setTimeout(resolve, 10));
            traces.push(`end-1-${awaitedInvokeStore.getRequestId()}`);
          },
        ),
        awaitedInvokeStore.run(
          {
            [awaitedInvokeStore.PROTECTED_KEYS.REQUEST_ID]: "request-2",
            [awaitedInvokeStore.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-2",
          },
          async () => {
            traces.push(`start-2-${awaitedInvokeStore.getRequestId()}`);
            await new Promise((resolve) => setTimeout(resolve, 5));
            traces.push(`end-2-${awaitedInvokeStore.getRequestId()}`);
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
      await awaitedInvokeStore.run(
        {
          [awaitedInvokeStore.PROTECTED_KEYS.REQUEST_ID]: "request-1",
        },
        async () => {
          traces.push(`before-${awaitedInvokeStore.getRequestId()}`);
          const task = new Promise((resolve) => {
            setTimeout(resolve, 1);
          }).then(() => {
            traces.push(`inside-${awaitedInvokeStore.getRequestId()}`);
          });
          vi.runAllTimers();
          await task;
          traces.push(`after-${awaitedInvokeStore.getRequestId()}`);
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
