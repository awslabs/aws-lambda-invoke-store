import { describe, it, expect } from "vitest";
import { InvokeStore } from "./invoke-store.js";

/**
 * These tests specifically verify context preservation across various
 * timer and async APIs without using fake timers.
 */
describe("InvokeStore timer functions context preservation", () => {
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  describe("setTimeout", () => {
    it("should preserve context in setTimeout callbacks", async () => {
      // GIVEN
      const testRequestId = "timeout-test";
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        },
        async () => {
          traces.push(`before-${InvokeStore.getRequestId()}`);

          await new Promise<void>((resolve) => {
            setTimeout(() => {
              traces.push(`inside-timeout-${InvokeStore.getRequestId()}`);
              resolve();
            }, 10);
          });

          traces.push(`after-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        `before-${testRequestId}`,
        `inside-timeout-${testRequestId}`,
        `after-${testRequestId}`,
      ]);
    });

    it("should preserve context in nested setTimeout callbacks", async () => {
      // GIVEN
      const testRequestId = "nested-timeout-test";
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        },
        async () => {
          traces.push(`level-0-${InvokeStore.getRequestId()}`);

          await new Promise<void>((resolve) => {
            setTimeout(() => {
              traces.push(`level-1-${InvokeStore.getRequestId()}`);

              setTimeout(() => {
                traces.push(`level-2-${InvokeStore.getRequestId()}`);
                resolve();
              }, 10);
            }, 10);
          });

          traces.push(`done-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        `level-0-${testRequestId}`,
        `level-1-${testRequestId}`,
        `level-2-${testRequestId}`,
        `done-${testRequestId}`,
      ]);
    });
  });

  describe("setImmediate", () => {
    it("should preserve context in setImmediate callbacks", async () => {
      // GIVEN
      const testRequestId = "immediate-test";
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        },
        async () => {
          traces.push(`before-${InvokeStore.getRequestId()}`);

          await new Promise<void>((resolve) => {
            setImmediate(() => {
              traces.push(`inside-immediate-${InvokeStore.getRequestId()}`);
              resolve();
            });
          });

          traces.push(`after-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        `before-${testRequestId}`,
        `inside-immediate-${testRequestId}`,
        `after-${testRequestId}`,
      ]);
    });

    it("should preserve context in nested setImmediate callbacks", async () => {
      // GIVEN
      const testRequestId = "nested-immediate-test";
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        },
        async () => {
          traces.push(`level-0-${InvokeStore.getRequestId()}`);

          await new Promise<void>((resolve) => {
            setImmediate(() => {
              traces.push(`level-1-${InvokeStore.getRequestId()}`);

              setImmediate(() => {
                traces.push(`level-2-${InvokeStore.getRequestId()}`);
                resolve();
              });
            });
          });

          traces.push(`done-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        `level-0-${testRequestId}`,
        `level-1-${testRequestId}`,
        `level-2-${testRequestId}`,
        `done-${testRequestId}`,
      ]);
    });
  });

  describe("process.nextTick", () => {
    it("should preserve context in process.nextTick callbacks", async () => {
      // GIVEN
      const testRequestId = "nexttick-test";
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        },
        async () => {
          traces.push(`before-${InvokeStore.getRequestId()}`);

          await new Promise<void>((resolve) => {
            process.nextTick(() => {
              traces.push(`inside-nexttick-${InvokeStore.getRequestId()}`);
              resolve();
            });
          });

          traces.push(`after-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        `before-${testRequestId}`,
        `inside-nexttick-${testRequestId}`,
        `after-${testRequestId}`,
      ]);
    });

    it("should preserve context in nested process.nextTick callbacks", async () => {
      // GIVEN
      const testRequestId = "nested-nexttick-test";
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        },
        async () => {
          traces.push(`level-0-${InvokeStore.getRequestId()}`);

          await new Promise<void>((resolve) => {
            process.nextTick(() => {
              traces.push(`level-1-${InvokeStore.getRequestId()}`);

              process.nextTick(() => {
                traces.push(`level-2-${InvokeStore.getRequestId()}`);
                resolve();
              });
            });
          });

          traces.push(`done-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        `level-0-${testRequestId}`,
        `level-1-${testRequestId}`,
        `level-2-${testRequestId}`,
        `done-${testRequestId}`,
      ]);
    });
  });

  describe("Promise", () => {
    it("should preserve context in Promise.then callbacks", async () => {
      // GIVEN
      const testRequestId = "promise-test";
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        },
        async () => {
          traces.push(`before-${InvokeStore.getRequestId()}`);

          await Promise.resolve().then(() => {
            traces.push(`inside-promise-${InvokeStore.getRequestId()}`);
          });

          traces.push(`after-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        `before-${testRequestId}`,
        `inside-promise-${testRequestId}`,
        `after-${testRequestId}`,
      ]);
    });

    it("should preserve context in Promise chains", async () => {
      // GIVEN
      const testRequestId = "promise-chain-test";
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        },
        async () => {
          traces.push(`start-${InvokeStore.getRequestId()}`);

          await Promise.resolve()
            .then(() => {
              traces.push(`then-1-${InvokeStore.getRequestId()}`);
              return delay(10);
            })
            .then(() => {
              traces.push(`then-2-${InvokeStore.getRequestId()}`);
              return Promise.resolve();
            })
            .then(() => {
              traces.push(`then-3-${InvokeStore.getRequestId()}`);
            });

          traces.push(`end-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        `start-${testRequestId}`,
        `then-1-${testRequestId}`,
        `then-2-${testRequestId}`,
        `then-3-${testRequestId}`,
        `end-${testRequestId}`,
      ]);
    });
  });

  describe("Event Loop Phases", () => {
    it("should preserve context across different event loop phases", async () => {
      // GIVEN
      const testRequestId = "event-loop-test";
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        },
        async () => {
          traces.push(`start-${InvokeStore.getRequestId()}`);

          const immediatePromise = new Promise<void>((resolve) => {
            setImmediate(() => {
              traces.push(`immediate-${InvokeStore.getRequestId()}`);
              resolve();
            });
          });

          const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              traces.push(`timeout-${InvokeStore.getRequestId()}`);
              resolve();
            }, 0);
          });

          const nextTickPromise = new Promise<void>((resolve) => {
            process.nextTick(() => {
              traces.push(`nextTick-${InvokeStore.getRequestId()}`);
              resolve();
            });
          });

          const promisePromise = Promise.resolve().then(() => {
            traces.push(`promise-${InvokeStore.getRequestId()}`);
          });

          await Promise.all([
            immediatePromise,
            timeoutPromise,
            nextTickPromise,
            promisePromise,
          ]);

          traces.push(`end-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN - Order may vary but all should have the correct requestId
      expect(traces).toContain(`start-${testRequestId}`);
      expect(traces).toContain(`immediate-${testRequestId}`);
      expect(traces).toContain(`timeout-${testRequestId}`);
      expect(traces).toContain(`nextTick-${testRequestId}`);
      expect(traces).toContain(`promise-${testRequestId}`);
      expect(traces).toContain(`end-${testRequestId}`);
      expect(traces.length).toBe(6);
    });
  });

  describe("Concurrent Executions", () => {
    it("should maintain isolation between concurrent executions with timers", async () => {
      // GIVEN
      const traces: string[] = [];

      // WHEN - Simulate concurrent invocations
      await Promise.all([
        InvokeStore.run(
          {
            [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "request-1",
            [InvokeStore.PROTECTED_KEYS.X_RAY_TRACE_ID]: "trace-1",
          },
          async () => {
            traces.push(`start-1-${InvokeStore.getRequestId()}`);
            await delay(20); // Longer delay
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
            await delay(10); // Shorter delay
            traces.push(`end-2-${InvokeStore.getRequestId()}`);
          },
        ),
      ]);

      // THEN - request-2 should finish before request-1
      expect(traces).toEqual([
        "start-1-request-1",
        "start-2-request-2",
        "end-2-request-2",
        "end-1-request-1",
      ]);
    });

    it("should maintain isolation with mixed async operations", async () => {
      // GIVEN
      const traces: string[] = [];

      // WHEN - Simulate concurrent invocations with different async operations
      await Promise.all([
        InvokeStore.run(
          {
            [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "request-1",
          },
          async () => {
            traces.push(`start-1-${InvokeStore.getRequestId()}`);

            // Use setTimeout
            await new Promise<void>((resolve) => {
              setTimeout(() => {
                traces.push(`timeout-1-${InvokeStore.getRequestId()}`);
                resolve();
              }, 15);
            });

            traces.push(`end-1-${InvokeStore.getRequestId()}`);
          },
        ),
        InvokeStore.run(
          {
            [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "request-2",
          },
          async () => {
            traces.push(`start-2-${InvokeStore.getRequestId()}`);

            // Use setImmediate
            await new Promise<void>((resolve) => {
              setImmediate(() => {
                traces.push(`immediate-2-${InvokeStore.getRequestId()}`);
                resolve();
              });
            });

            traces.push(`end-2-${InvokeStore.getRequestId()}`);
          },
        ),
        InvokeStore.run(
          {
            [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: "request-3",
          },
          async () => {
            traces.push(`start-3-${InvokeStore.getRequestId()}`);

            // Use process.nextTick
            await new Promise<void>((resolve) => {
              process.nextTick(() => {
                traces.push(`nextTick-3-${InvokeStore.getRequestId()}`);
                resolve();
              });
            });

            traces.push(`end-3-${InvokeStore.getRequestId()}`);
          },
        ),
      ]);

      // THEN - Each operation should have the correct requestId
      // The exact order may vary, but we can check specific patterns
      expect(traces).toContain("start-1-request-1");
      expect(traces).toContain("timeout-1-request-1");
      expect(traces).toContain("end-1-request-1");

      expect(traces).toContain("start-2-request-2");
      expect(traces).toContain("immediate-2-request-2");
      expect(traces).toContain("end-2-request-2");

      expect(traces).toContain("start-3-request-3");
      expect(traces).toContain("nextTick-3-request-3");
      expect(traces).toContain("end-3-request-3");

      // Check that each request's operations are in the correct order
      const indexOf = (str: string) => traces.indexOf(str);

      expect(indexOf("start-1-request-1")).toBeLessThan(
        indexOf("timeout-1-request-1"),
      );
      expect(indexOf("timeout-1-request-1")).toBeLessThan(
        indexOf("end-1-request-1"),
      );

      expect(indexOf("start-2-request-2")).toBeLessThan(
        indexOf("immediate-2-request-2"),
      );
      expect(indexOf("immediate-2-request-2")).toBeLessThan(
        indexOf("end-2-request-2"),
      );

      expect(indexOf("start-3-request-3")).toBeLessThan(
        indexOf("nextTick-3-request-3"),
      );
      expect(indexOf("nextTick-3-request-3")).toBeLessThan(
        indexOf("end-3-request-3"),
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle recursive setTimeout calls", async () => {
      // GIVEN
      const testRequestId = "recursive-test";
      const traces: string[] = [];
      const iterations = 3;

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        },
        async () => {
          traces.push(`start-${InvokeStore.getRequestId()}`);

          let count = 0;
          await new Promise<void>((resolve) => {
            function recursive() {
              traces.push(`iteration-${count}-${InvokeStore.getRequestId()}`);
              count++;

              if (count < iterations) {
                setTimeout(recursive, 5);
              } else {
                resolve();
              }
            }

            recursive();
          });

          traces.push(`end-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        `start-${testRequestId}`,
        `iteration-0-${testRequestId}`,
        `iteration-1-${testRequestId}`,
        `iteration-2-${testRequestId}`,
        `end-${testRequestId}`,
      ]);
    });

    it("should handle mixing different timer types", async () => {
      // GIVEN
      const testRequestId = "mixed-timers-test";
      const traces: string[] = [];

      // WHEN
      await InvokeStore.run(
        {
          [InvokeStore.PROTECTED_KEYS.REQUEST_ID]: testRequestId,
        },
        async () => {
          traces.push(`start-${InvokeStore.getRequestId()}`);

          // Queue a setTimeout that triggers setImmediate
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              traces.push(`timeout-${InvokeStore.getRequestId()}`);

              setImmediate(() => {
                traces.push(`immediate-${InvokeStore.getRequestId()}`);

                process.nextTick(() => {
                  traces.push(`nextTick-${InvokeStore.getRequestId()}`);
                  resolve();
                });
              });
            }, 10);
          });

          traces.push(`end-${InvokeStore.getRequestId()}`);
        },
      );

      // THEN
      expect(traces).toEqual([
        `start-${testRequestId}`,
        `timeout-${testRequestId}`,
        `immediate-${testRequestId}`,
        `nextTick-${testRequestId}`,
        `end-${testRequestId}`,
      ]);
    });
  });
});
