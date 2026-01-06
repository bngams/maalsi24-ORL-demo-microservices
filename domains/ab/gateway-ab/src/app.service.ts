import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AppService {
  constructor(
    @Inject('SERVICE_A_CLIENT') private readonly serviceAClient: ClientProxy,
    @Inject('SERVICE_B_CLIENT') private readonly serviceBClient: ClientProxy,
  ) {}

  async getHello(): Promise<string> {
    // Call Service A and Service B via their microservice clients
    const responseA = await this.serviceAClient
      .send<string>({ cmd: 'hello-b' }, {})
      .toPromise();

    const responseB = await this.serviceBClient
      .send<string>({ cmd: 'hello-b' }, {})
      .toPromise();

    return `Service A: ${responseA}\nService B: ${responseB}`;
  }
}
