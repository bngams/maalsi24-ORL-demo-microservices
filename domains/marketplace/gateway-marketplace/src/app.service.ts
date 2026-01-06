import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AppService {
  constructor(
    @Inject('CLIENTS_SERVICE') private readonly clientsService: ClientProxy,
  ) {}

  generateInvoice(clientId: string) {
    return this.clientsService.send({ cmd: 'generate_invoice' }, { clientId });
  }
}
