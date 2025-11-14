import { describe, it, expect } from "vitest";
import { InvokeStore } from "./invoke-store.js";

describe("InvokeStore implementations", () => {
  it("should load the correct class", async () => {
    const singleStore = await InvokeStore.getInstanceAsync();
    expect(singleStore.constructor.name).toBe("InvokeStoreSingle");
  });
});
