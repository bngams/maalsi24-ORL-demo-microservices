/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import * as Consul from 'consul';
import { CONSUL_OPTIONS } from './consul.constants';
import { ConsulModuleOptions } from './consul.interface';

@Injectable()
export class ConsulService implements OnModuleInit, OnModuleDestroy {
  private consul: Consul.Consul;
  private serviceId: string;

  constructor(
    @Inject(CONSUL_OPTIONS) private options: ConsulModuleOptions,
  ) {
    this.consul = new Consul({
      host: options.consulHost || process.env.CONSUL_HOST || 'localhost',
      port: String(options.consulPort || process.env.CONSUL_PORT || '8500'),
    });
  }

  async onModuleInit() {
    const serviceName = this.options.serviceName;
    const servicePort = parseInt(String(this.options.servicePort));
    const serviceHost = this.options.serviceHost || 'host.docker.internal';
    const healthCheckPath = this.options.healthCheckPath || '/health';

    this.serviceId = `${serviceName}-${servicePort}`;

    console.log(`📝 [Consul] Registering service: ${this.serviceId}`);

    await (this.consul.agent.service.register as any)({
      id: this.serviceId,
      name: serviceName,
      address: serviceHost,
      port: servicePort,
      tags: this.options.tags || [],
      meta: this.options.meta || {},
      check: {
        http: `http://${serviceHost}:${servicePort}${healthCheckPath}`,
        interval: this.options.healthCheckInterval || '10s',
      },
    });

    console.log(`✅ [Consul] Service registered successfully: ${this.serviceId}`);
  }

  async onModuleDestroy() {
    console.log(`📤 [Consul] Deregistering service: ${this.serviceId}`);
    try {
      await this.consul.agent.service.deregister(this.serviceId);
      console.log(`✅ [Consul] Service deregistered: ${this.serviceId}`);
    } catch (error) {
      console.error(`❌ [Consul] Error deregistering service:`, error);
    }
  }

  /**
   * Découvrir les instances d'un service
   */
  async getServiceInstances(serviceName: string): Promise<Array<{ host: string; port: number }>> {
    const services: any = await this.consul.health.service({
      service: serviceName,
      passing: true, // Seulement les instances en bonne santé
    });

    return services.map((s: any) => ({
      host: s.Service.Address,
      port: s.Service.Port,
    }));
  }

  /**
   * Découvrir une instance d'un service (load balancing simple)
   */
  async getServiceUrl(serviceName: string): Promise<string> {
    const instances = await this.getServiceInstances(serviceName);

    if (instances.length === 0) {
      throw new Error(`Service ${serviceName} not found in Consul or all instances are unhealthy`);
    }

    // Simple round-robin (première instance disponible)
    const instance = instances[0];
    return `http://${instance.host}:${instance.port}`;
  }
}
