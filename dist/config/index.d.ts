import { app, logLevel, environment } from './app';
import { mysql } from './mysql';
import { mongo } from './mongo';
export { app, mysql, mongo, logLevel, environment };
export { logDir, logIdentifier } from './app';
declare const _default: {
    app: {
        port: number;
        environment: "local" | "dev" | "stage" | "prod";
    };
    mysql: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };
    mongo: {
        uri: string;
    };
    logLevel: "error" | "warn" | "info" | "verbose" | "debug" | "silly";
};
export default _default;
//# sourceMappingURL=index.d.ts.map