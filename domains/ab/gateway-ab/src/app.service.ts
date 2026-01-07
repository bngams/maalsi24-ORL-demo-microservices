import { /*Inject,*/ Injectable } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ClientProxy } from '@nestjs/microservices/client/client-proxy';
import { ConsulDiscoveryService } from '@shared/consul/dist/consul-discovery.service';

@Injectable()
export class AppService {
  // constructor
  // with ClientProxy injection (SERVICE_A_CLIENT and SERVICE_B_CLIENT)
  // constructor(
  //   @Inject('SERVICE_A_CLIENT') private readonly serviceAClient: ClientProxy,
  //   @Inject('SERVICE_B_CLIENT') private readonly serviceBClient: ClientProxy,
  // ) {}

  private serviceAClient: ClientProxy;
  private serviceBClient: ClientProxy;

  constructor(private consulDiscovery: ConsulDiscoveryService) {}

  async onModuleInit() {
    try {
      setTimeout(() => {
        console.log('⏳ [Gateway AB] Waiting for Consul to be ready...');
      }, 1000);
      // Découvrir service-a
      const serviceAUrl = await this.consulDiscovery.getServiceUrl('service-a');
      const [hostA, portA] = this.parseUrl(serviceAUrl);

      this.serviceAClient = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: hostA, port: portA },
      });

      // Découvrir service-b
      const serviceBUrl = await this.consulDiscovery.getServiceUrl('service-b');
      const [hostB, portB] = this.parseUrl(serviceBUrl);

      this.serviceBClient = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: hostB, port: portB },
      });

      console.log('✅ [Gateway AB] Dynamic service discovery completed');
    } catch (error) {
      console.warn('⚠️  [Gateway AB] Consul service discovery failed, using fallback configuration');
      console.warn('    Error:', error.message);
      
      // Fallback: use direct localhost connections
      this.serviceAClient = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: 'localhost', port: 3001 },
      });

      this.serviceBClient = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: 'localhost', port: 3002 },
      });
      
      console.log('✅ [Gateway AB] Using fallback service connections');
    }
  }

  private parseUrl(url: string): [string, number] {
    const urlObj = new URL(url);
    // return [urlObj.hostname, parseInt(urlObj.port, 10)];
    return ['localhost', parseInt(urlObj.port, 10)];
  }

  async getHello(): Promise<string> {
    // I am waiting for service A and service B responses with await
    const responseA = await this.serviceAClient
      .send<string>({ cmd: 'hello-a' }, {})
      .toPromise(); // TODO: update to lastValueFrom in RxJS 7+
    const responseB = await this.serviceBClient
      .send<string>({ cmd: 'hello-b' }, {})
      .toPromise(); // TODO: update to lastValueFrom in RxJS 7+
    return `Service A says: ${responseA}, Service B says: ${responseB}`;
  }
}
