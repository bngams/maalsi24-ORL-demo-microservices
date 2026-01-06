import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // @Get() HTTP removed as this is a TCP microservice controller
  @MessagePattern({ cmd: 'generate_invoice' })
  generateInvoice(data: { clientId: string }) {
    return this.appService.generateInvoice(data.clientId);
  }
}
