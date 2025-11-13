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


    describe("hasContext", () => {
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
  });
});
