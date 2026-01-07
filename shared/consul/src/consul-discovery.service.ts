import { Injectable, Inject } from '@nestjs/common';
import * as Consul from 'consul';
import { CONSUL_OPTIONS } from './consul.constants';
import { ConsulModuleOptions } from './consul.interface';

@Injectable()
export class ConsulDiscoveryService {
  private consul: Consul.Consul;

  constructor(@Inject(CONSUL_OPTIONS) private options: ConsulModuleOptions) {
    this.consul = new Consul({
      host: options.consulHost || 'localhost',
      port: String(options.consulPort || '8500'),
    });
  }

  async getServiceInstances(serviceName: string): Promise<Array<{ host: string; port: number }>> {
    try {
      const services: any = await this.consul.health.service({
        service: serviceName,
        passing: true,
      });

      return services.map(s => ({
        host: s.Service.Address,
        port: s.Service.Port,
      }));
    } catch (error) {
      console.error(`❌ [Consul Discovery] Error finding service ${serviceName}:`, error);
      throw error;
    }
  }

  async getServiceUrl(serviceName: string): Promise<string> {
    const instances = await this.getServiceInstances(serviceName);

    if (instances.length === 0) {
      throw new Error(`Service ${serviceName} not found in Consul`);
    }

    const instance = instances[0];
    const url = `http://${instance.host}:${instance.port}`;
    console.log(`🔍 [Consul Discovery] Found ${serviceName} at ${url}`);

    return url;
  }
}