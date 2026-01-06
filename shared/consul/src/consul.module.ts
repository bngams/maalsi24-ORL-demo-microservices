import { DynamicModule, Module } from '@nestjs/common';
import { ConsulService } from './consul.service';
import { ConsulDiscoveryService } from './consul-discovery.service';
import { ConsulModuleOptions } from './consul.interface';
import { CONSUL_OPTIONS } from './consul.constants';

@Module({})
export class ConsulModule {
  /**
   * Enregistrement synchrone du module
   */
  static register(options: ConsulModuleOptions): DynamicModule {
    return {
      module: ConsulModule,
      providers: [
        {
          provide: CONSUL_OPTIONS,
          useValue: options,
        },
        ConsulService,
        ConsulDiscoveryService,
      ],
      exports: [ConsulService, ConsulDiscoveryService],
      global: false,
    };
  }

  /**
   * Enregistrement asynchrone (pour récupérer la config depuis un ConfigService)
   */
  static registerAsync(options: {
    useFactory: (...args: any[]) => Promise<ConsulModuleOptions> | ConsulModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: ConsulModule,
      providers: [
        {
          provide: CONSUL_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        ConsulService,
      ],
      exports: [ConsulService],
      global: false,
    };
  }
}
