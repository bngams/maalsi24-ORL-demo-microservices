import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672'],
        queue: process.env.RABBITMQ_QUEUE || 'invoices',
        queueOptions: {
          durable: true,
        },
        noAck: false,
      },
    },
  );
  await app.listen();
  console.log(`Service Orders is listening to RabbitMQ queue: ${process.env.RABBITMQ_QUEUE || 'invoices'}`);
}
bootstrap();
