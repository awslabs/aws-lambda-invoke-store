declare global {
  var awslambda: {
    InvokeStore?: InvokeStoreBase;
    [key: string]: unknown;
  };
}

const noGlobalAwsLambda =
  process.env["AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA"] === "1" ||
  process.env["AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA"] === "true";

if (!noGlobalAwsLambda) {
  globalThis.awslambda = globalThis.awslambda || {};
}

interface Context {
  [key: string]: unknown;
  [key: symbol]: unknown;
}

const PROTECTED_KEYS = {
  REQUEST_ID: Symbol("_AWS_LAMBDA_REQUEST_ID"),
  X_RAY_TRACE_ID: Symbol("_AWS_LAMBDA_X_RAY_TRACE_ID"),
  TENANT_ID: Symbol("_AWS_LAMBDA_TENANT_ID"),
} as const;

abstract class InvokeStoreBase {
  readonly PROTECTED_KEYS = PROTECTED_KEYS;

  abstract getContext(): Context | undefined;
  abstract hasContext(): boolean;
  abstract get<T = unknown>(key: string | symbol): T | undefined;
  abstract set<T = unknown>(key: string | symbol, value: T): void;
  abstract run<T>(context: Context, fn: () => T): T;

  protected isProtectedKey(key: string | symbol): boolean {
    return Object.values(PROTECTED_KEYS).includes(key as symbol);
  }

  public getRequestId(): string | undefined {
    return this.get<string>(PROTECTED_KEYS.REQUEST_ID) ?? "-";
  }

  public getXRayTraceId(): string | undefined {
    return this.get<string>(PROTECTED_KEYS.X_RAY_TRACE_ID);
  }

  public getTenantId(): string | undefined {
    return this.get<string>(PROTECTED_KEYS.TENANT_ID);
  }
}

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
      throw new Error(`Cannot modify protected Lambda context field: ${String(key)}`);
    }

    if (!this.currentContext) {
      this.currentContext = {};
    }
    
    this.currentContext[key] = value;
  }

  run<T>(context: Context, fn: () => T): T {
    this.currentContext = context;
    try {
      return fn();
    } finally {
      this.currentContext = undefined;
    }
  }

}

class InvokeStoreMulti extends InvokeStoreBase {
  private als!: import("node:async_hooks").AsyncLocalStorage<Context>;

  constructor() {
    super();
    const asyncHooks = require('node:async_hooks') as typeof import("node:async_hooks");
    this.als = new asyncHooks.AsyncLocalStorage<Context>();
    this.getRequestId = super.getRequestId;
    this.getXRayTraceId = super.getXRayTraceId;
    this.getTenantId = super.getTenantId;
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
      throw new Error(`Cannot modify protected Lambda context field: ${String(key)}`);
    }

    const store = this.als.getStore();
    if (!store) {
      throw new Error('No context available');
    }
    
    store[key] = value;
  }

  run<T>(context: Context, fn: () => T): T {
    return this.als.run(context, fn);
  }
}

const isMulti = 'AWS_LAMBDA_MAX_CONCURRENCY' in (process.env ?? {});
const InvokeStoreImpl = isMulti ? InvokeStoreMulti : InvokeStoreSingle;

const createInvokeStore = (): InvokeStoreBase => {
  if (!noGlobalAwsLambda && globalThis.awslambda?.InvokeStore) {
    return globalThis.awslambda.InvokeStore;
  }

  const instance = new InvokeStoreImpl();
  
  if (!noGlobalAwsLambda && globalThis.awslambda) {
    globalThis.awslambda.InvokeStore = instance;
  }

  return instance;
}

const log = createInvokeStore();
export const InvokeStore = log;