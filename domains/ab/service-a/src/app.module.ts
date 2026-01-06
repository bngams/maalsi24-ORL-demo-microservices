import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConsulModule } from '@shared/consul';

@Module({
  imports: [
    ConsulModule.register({
      serviceName: process.env.SERVICE_NAME || 'service-a',
      servicePort: parseInt(process.env.SERVICE_PORT || '3001', 10),
      serviceHost: process.env.SERVICE_HOST || 'host.docker.internal',
      healthCheckPath: '/health',
      healthCheckInterval: '10s',
      tags: ['domain:ab', 'type:tcp'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
