import { describe, it, expect, beforeEach } from "vitest";
import { InvokeStore, InvokeStoreBase } from "./invoke-store";

describe("InvokeStore - Async Context Bug", () => {
  let invokeStore: InvokeStoreBase;

  beforeEach(async () => {
    if (InvokeStore._testing) {
      InvokeStore._testing.reset();
    }
    invokeStore = await InvokeStore.getInstanceAsync();
  });

  it("should not clear context after await in InvokeStoreSingle", async () => {
    const testContext = {
      [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: "test-123",
    };

    await invokeStore.run(testContext, async () => {
      expect(invokeStore.getRequestId()).toBe("test-123");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(invokeStore.getRequestId()).toBe("test-123");
    });
  });
});
