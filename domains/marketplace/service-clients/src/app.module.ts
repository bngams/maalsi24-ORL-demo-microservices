import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConsulModule } from '@shared/consul';

@Module({
  imports: [
    ConsulModule.register({
      serviceName: process.env.SERVICE_NAME || 'service-clients',
      servicePort: parseInt(process.env.SERVICE_PORT || '3003', 10),
      serviceHost: process.env.SERVICE_HOST || 'host.docker.internal',
      healthCheckPath: '/health',
      healthCheckInterval: '10s',
      tags: ['domain:marketplace', 'type:tcp'],
    }),
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://admin:admin@localhost:5672'],
          queue: 'invoices',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
