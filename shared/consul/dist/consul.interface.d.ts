export interface ConsulModuleOptions {
    serviceName: string;
    servicePort: number;
    serviceHost?: string;
    healthCheckPath?: string;
    healthCheckInterval?: string;
    healthCheckTimeout?: string;
    consulHost?: string;
    consulPort?: string;
    tags?: string[];
    meta?: Record<string, string>;
}
