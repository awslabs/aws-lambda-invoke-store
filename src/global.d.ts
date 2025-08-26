import { InvokeStore } from "./invoke-store.ts";

declare global {
  var awslambda: {
    InvokeStore?: typeof InvokeStore;
  };
}

export {};
