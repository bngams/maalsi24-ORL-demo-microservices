import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern } from '@nestjs/microservices'; // import from barrel (index.js referencing all exports)

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Endpoint de health check pour Consul
  @Get('health')
  health() {
    return { status: 'ok', service: 'service-a' };
  }

  // @Get() => HTTP GET endpoint removed
  // Replaced with a message pattern for microservice communication
  @MessagePattern({ cmd: 'hello-a' })
  getHello(): string {
    return this.appService.getHello();
  }
}
