import { AsyncLocalStorage } from 'async_hooks';
export type RequestContext = {
    requestId?: string;
};
export declare const asyncLocalStorage: AsyncLocalStorage<RequestContext>;
export declare function getRequestContext(): RequestContext;
//# sourceMappingURL=asyncLocal.d.ts.map