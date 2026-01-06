import { Controller, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('clients/:id/generate-invoice')
  generateInvoice(@Param('id') clientId: string) {
    return this.appService.generateInvoice(clientId);
  }
}
