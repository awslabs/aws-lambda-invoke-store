import { describe, it, expect } from "vitest";
import { InvokeStore } from "./invoke-store.js";

describe("forceInvokeStoreMulti", () => {
  it("should create InvokeStoreMulti when forceInvokeStoreMulti is true, without env var", async () => {
    const store = await InvokeStore.getInstanceAsync(true);
    expect(store.constructor.name).toBe("InvokeStoreMulti");
  });
});
