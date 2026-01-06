import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { AppDnsService } from './app-dns.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly appDnsService: AppDnsService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'gateway-ab' };
  }

  @Get('hello') // HTTP GET endpoint /hello
  async getHello(): Promise<string> {
    return await this.appService.getHello();
  }

  @Get('hello-dns') // HTTP GET endpoint /hello-dns using DNS-based discovery
  async getHelloDns(): Promise<string> {
    return await this.appDnsService.getHello();
  }
}
