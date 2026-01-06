import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices/client/client-proxy';

@Injectable()
export class AppService {
  // constructor
  // with ClientProxy injection (SERVICE_A_CLIENT and SERVICE_B_CLIENT)
  constructor(
    @Inject('CLIENTS_SERVICE') private readonly clientsService: ClientProxy,
  ) {}

  generateInvoice(clientId: string) {
    return this.clientsService.send({ cmd: 'generate_invoice' }, { clientId });
  }
}
