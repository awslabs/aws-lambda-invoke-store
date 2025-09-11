import { AsyncLocalStorage } from "async_hooks";

// AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA provides an escape hatch since we're modifying the global object which may not be expected to a customer's handler.
const noGlobalAwsLambda =
  process.env["AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA"] === "1" ||
  process.env["AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA"] === "true";

if (!noGlobalAwsLambda) {
  globalThis.awslambda = globalThis.awslambda || {};
}

const PROTECTED_KEYS = {
  REQUEST_ID: Symbol("_AWS_LAMBDA_REQUEST_ID"),
  X_RAY_TRACE_ID: Symbol("_AWS_LAMBDA_X_RAY_TRACE_ID"),
  TENANT_ID: Symbol("_AWS_LAMBDA_TENANT_ID"),
} as const;

/**
 * Generic store context that uses protected keys for Lambda fields
 * and allows custom user properties
 */
export interface InvokeStoreContext {
  [key: string | symbol]: unknown;
}

/**
 * InvokeStore implementation class
 */
class InvokeStoreImpl {
  private static storage = new AsyncLocalStorage<InvokeStoreContext>();

  // Protected keys for Lambda context fields
  public static readonly PROTECTED_KEYS = PROTECTED_KEYS;

  /**
   * Initialize and run code within an invoke context
   */
  public static run<T>(
    context: InvokeStoreContext,
    fn: () => T | Promise<T>,
  ): T | Promise<T> {
    return this.storage.run({ ...context }, fn);
  }

  /**
   * Get the complete current context
   */
  public static getContext(): InvokeStoreContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Get a specific value from the context by key
   */
  public static get<T = unknown>(key: string | symbol): T | undefined {
    const context = this.storage.getStore();
    return context?.[key] as T | undefined;
  }

  /**
   * Set a custom value in the current context
   * Protected Lambda context fields cannot be overwritten
   */
  public static set(key: string | symbol, value: unknown): void {
    if (this.isProtectedKey(key)) {
      throw new Error(`Cannot modify protected Lambda context field`);
    }

    const context = this.storage.getStore();
    if (context) {
      context[key] = value;
    }
  }

  /**
   * Get the current request ID
   */
  public static getRequestId(): string {
    return this.get<string>(this.PROTECTED_KEYS.REQUEST_ID) ?? "-";
  }

  /**
   * Get the current X-ray trace ID
   */
  public static getXRayTraceId(): string | undefined {
    return this.get<string>(this.PROTECTED_KEYS.X_RAY_TRACE_ID);
  }

  /**
   * Get the current tenant ID
   */
  public static getTenantId(): string | undefined {
    return this.get<string>(this.PROTECTED_KEYS.TENANT_ID);
  }

  /**
   * Check if we're currently within an invoke context
   */
  public static hasContext(): boolean {
    return this.storage.getStore() !== undefined;
  }

  /**
   * Check if a key is protected (readonly Lambda context field)
   */
  private static isProtectedKey(key: string | symbol): boolean {
    return (
      key === this.PROTECTED_KEYS.REQUEST_ID ||
      key === this.PROTECTED_KEYS.X_RAY_TRACE_ID
    );
  }
}

let instance: typeof InvokeStoreImpl;

if (!noGlobalAwsLambda && globalThis.awslambda?.InvokeStore) {
  instance = globalThis.awslambda.InvokeStore;
} else {
  instance = InvokeStoreImpl;

  if (!noGlobalAwsLambda && globalThis.awslambda) {
    globalThis.awslambda.InvokeStore = instance;
  }
}

export const InvokeStore = instance;
