import { ConsulModuleOptions } from './consul.interface';
export declare class ConsulDiscoveryService {
    private options;
    private consul;
    constructor(options: ConsulModuleOptions);
    getServiceInstances(serviceName: string): Promise<Array<{
        host: string;
        port: number;
    }>>;
    getServiceUrl(serviceName: string): Promise<string>;
}
