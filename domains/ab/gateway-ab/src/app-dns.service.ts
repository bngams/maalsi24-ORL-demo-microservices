import { Injectable } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ClientProxy } from '@nestjs/microservices/client/client-proxy';
import { Resolver } from 'dns';

@Injectable()
export class AppDnsService {
  private serviceAClient: ClientProxy;
  private serviceBClient: ClientProxy;
  private dnsResolver: Resolver;

  constructor() {
    // Configure DNS resolver to use Consul DNS on localhost:8600
    this.dnsResolver = new Resolver();
    this.dnsResolver.setServers(['127.0.0.1:8600']);
  }

  async onModuleInit() {
    // Resolve service-a via Consul DNS
    const serviceAHost = await this.resolveService('service-a.service.consul');
    this.serviceAClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: serviceAHost,
        port: 3001,
      },
    });

    // Resolve service-b via Consul DNS
    const serviceBHost = await this.resolveService('service-b.service.consul');
    this.serviceBClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: serviceBHost,
        port: 3002,
      },
    });

    console.log('✅ [Gateway AB - DNS] Using Consul DNS for service discovery');
  }

  private async resolveService(serviceName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.dnsResolver.resolve4(serviceName, (err, addresses) => {
        if (err) {
          console.error(`Failed to resolve ${serviceName}:`, err);
          reject(err);
        } else {
          console.log(`Resolved ${serviceName} to ${addresses[0]}`);
          resolve(addresses[0]);
        }
      });
    });
  }

  async getHello(): Promise<string> {
    const responseA = await this.serviceAClient
      .send<string>({ cmd: 'hello-a' }, {})
      .toPromise();
    const responseB = await this.serviceBClient
      .send<string>({ cmd: 'hello-b' }, {})
      .toPromise();
    return `Service A says: ${responseA}, Service B says: ${responseB}`;
  }
}
