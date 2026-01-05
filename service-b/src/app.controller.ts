import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // @Get()
  // replaced with TCP microservice pattern
  @MessagePattern({ cmd: 'hello-b' })
  getHello(): string {
    return this.appService.getHello();
  }
}
