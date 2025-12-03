import type { AsyncLocalStorage } from "node:async_hooks";
interface Context {
  [key: string]: unknown;
  [key: symbol]: unknown;
}

const PROTECTED_KEYS = {
  REQUEST_ID: Symbol.for("_AWS_LAMBDA_REQUEST_ID"),
  X_RAY_TRACE_ID: Symbol.for("_AWS_LAMBDA_X_RAY_TRACE_ID"),
  TENANT_ID: Symbol.for("_AWS_LAMBDA_TENANT_ID"),
} as const;

const NO_GLOBAL_AWS_LAMBDA = ["true", "1"].includes(
  process.env?.AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA ?? "",
);

declare global {
  var awslambda: {
    InvokeStore?: InvokeStoreBase;
    [key: string]: unknown;
  };
}

if (!NO_GLOBAL_AWS_LAMBDA) {
  globalThis.awslambda = globalThis.awslambda || {};
}

/**
 * Base class for AWS Lambda context storage implementations.
 * Provides core functionality for managing Lambda execution context.
 *
 * Implementations handle either single-context (InvokeStoreSingle) or
 * multi-context (InvokeStoreMulti) scenarios based on Lambda's execution environment.
 *
 * @public
 */
export abstract class InvokeStoreBase {
  public static readonly PROTECTED_KEYS = PROTECTED_KEYS;

  abstract getContext(): Context | undefined;
  abstract hasContext(): boolean;
  abstract get<T = unknown>(key: string | symbol): T | undefined;
  abstract set<T = unknown>(key: string | symbol, value: T): void;
  abstract run<T>(context: Context, fn: () => T): T;

  protected isProtectedKey(key: string | symbol): boolean {
    return Object.values(PROTECTED_KEYS).includes(key as symbol);
  }

  getRequestId(): string {
    return this.get<string>(PROTECTED_KEYS.REQUEST_ID) ?? "-";
  }

  getXRayTraceId(): string | undefined {
    return this.get<string>(PROTECTED_KEYS.X_RAY_TRACE_ID);
  }

  getTenantId(): string | undefined {
    return this.get<string>(PROTECTED_KEYS.TENANT_ID);
  }
}

/**
 * Single Context Implementation
 * @internal
 */
class InvokeStoreSingle extends InvokeStoreBase {
  private currentContext?: Context;

  getContext(): Context | undefined {
    return this.currentContext;
  }

  hasContext(): boolean {
    return this.currentContext !== undefined;
  }

  get<T = unknown>(key: string | symbol): T | undefined {
    return this.currentContext?.[key] as T | undefined;
  }

  set<T = unknown>(key: string | symbol, value: T): void {
    if (this.isProtectedKey(key)) {
      throw new Error(
        `Cannot modify protected Lambda context field: ${String(key)}`,
      );
    }

    this.currentContext = this.currentContext || {};
    this.currentContext[key] = value;
  }

  run<T>(context: Context, fn: () => T): T {
    this.currentContext = context;
    return fn();
  }
}

/**
 * Multi Context Implementation
 * @internal
 */
class InvokeStoreMulti extends InvokeStoreBase {
  private als!: AsyncLocalStorage<Context>;

  static async create(): Promise<InvokeStoreMulti> {
    const instance = new InvokeStoreMulti();
    const asyncHooks = await import("node:async_hooks");
    instance.als = new asyncHooks.AsyncLocalStorage<Context>();
    return instance;
  }

  getContext(): Context | undefined {
    return this.als.getStore();
  }

  hasContext(): boolean {
    return this.als.getStore() !== undefined;
  }

  get<T = unknown>(key: string | symbol): T | undefined {
    return this.als.getStore()?.[key] as T | undefined;
  }

  set<T = unknown>(key: string | symbol, value: T): void {
    if (this.isProtectedKey(key)) {
      throw new Error(
        `Cannot modify protected Lambda context field: ${String(key)}`,
      );
    }

    const store = this.als.getStore();
    if (!store) {
      throw new Error("No context available");
    }

    store[key] = value;
  }

  run<T>(context: Context, fn: () => T): T {
    return this.als.run(context, fn);
  }
}

/**
 * Provides access to AWS Lambda execution context storage.
 * Supports both single-context and multi-context environments through different implementations.
 *
 * The store manages protected Lambda context fields and allows storing/retrieving custom values
 * within the execution context.
 * @public
 */
export namespace InvokeStore {
  let instance: Promise<InvokeStoreBase> | null = null;

  export async function getInstanceAsync(): Promise<InvokeStoreBase> {
    if (!instance) {
      // Lock synchronously on first invoke by immediately assigning the promise
      instance = (async () => {
        const isMulti = "AWS_LAMBDA_MAX_CONCURRENCY" in process.env;
        const newInstance = isMulti
          ? await InvokeStoreMulti.create()
          : new InvokeStoreSingle();

        if (!NO_GLOBAL_AWS_LAMBDA && globalThis.awslambda?.InvokeStore) {
          return globalThis.awslambda.InvokeStore;
        } else if (!NO_GLOBAL_AWS_LAMBDA && globalThis.awslambda) {
          globalThis.awslambda.InvokeStore = newInstance;
          return newInstance;
        } else {
          return newInstance;
        }
      })();
    }

    return instance;
  }

  export const _testing =
    process.env.AWS_LAMBDA_BENCHMARK_MODE === "1"
      ? {
          reset: () => {
            instance = null;
            if (globalThis.awslambda?.InvokeStore) {
              delete globalThis.awslambda.InvokeStore;
            }
            globalThis.awslambda = {};
          },
        }
      : undefined;
}
