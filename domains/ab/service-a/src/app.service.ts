import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    console.log('Service A: getHello called');
    return 'Hello World!';
  }
}
