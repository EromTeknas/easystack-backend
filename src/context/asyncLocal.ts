import { AsyncLocalStorage } from 'async_hooks';

export type RequestContext = { requestId?: string };

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext() {
  return asyncLocalStorage.getStore() ?? {};
}
