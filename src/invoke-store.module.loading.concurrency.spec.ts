import { describe, vi, it, expect } from "vitest";
import { InvokeStore } from "./invoke-store.js";

describe("InvokeStore implementations", () => {
  it("should load the correct class", async () => {
    vi.stubEnv("AWS_LAMBDA_MAX_CONCURRENCY", "2");
    const singleStore = await InvokeStore.getInstanceAsync();
    expect(singleStore.constructor.name).toBe("InvokeStoreMulti");
  });
});
