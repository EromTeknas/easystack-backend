import { AsyncLocalStorage } from 'async_hooks';
export type RequestContext = {
    requestId?: string;
};
declare const asyncLocalStorage: AsyncLocalStorage<RequestContext>;
export declare function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T;
export declare function getRequestContext(): RequestContext;
export declare function getRequestId(): string | undefined;
export { asyncLocalStorage };
declare const _default: {
    runWithRequestContext: typeof runWithRequestContext;
    getRequestContext: typeof getRequestContext;
    getRequestId: typeof getRequestId;
    asyncLocalStorage: AsyncLocalStorage<RequestContext>;
};
export default _default;
//# sourceMappingURL=request-context.d.ts.map