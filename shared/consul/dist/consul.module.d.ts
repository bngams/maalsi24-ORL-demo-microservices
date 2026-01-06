import { DynamicModule } from '@nestjs/common';
import { ConsulModuleOptions } from './consul.interface';
export declare class ConsulModule {
    static register(options: ConsulModuleOptions): DynamicModule;
    static registerAsync(options: {
        useFactory: (...args: any[]) => Promise<ConsulModuleOptions> | ConsulModuleOptions;
        inject?: any[];
    }): DynamicModule;
}
