import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConsulModuleOptions } from './consul.interface';
export declare class ConsulService implements OnModuleInit, OnModuleDestroy {
    private options;
    private consul;
    private serviceId;
    constructor(options: ConsulModuleOptions);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    getServiceInstances(serviceName: string): Promise<Array<{
        host: string;
        port: number;
    }>>;
    getServiceUrl(serviceName: string): Promise<string>;
}
