import { AsyncLocalStorage } from 'async_hooks';

export type RequestContext = { requestId?: string };

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(ctx, fn);
}

export function getRequestContext(): RequestContext {
  return asyncLocalStorage.getStore() ?? {};
}

export function getRequestId(): string | undefined {
  return getRequestContext().requestId;
}

export { asyncLocalStorage };

export default {
  runWithRequestContext,
  getRequestContext,
  getRequestId,
  asyncLocalStorage,
};
