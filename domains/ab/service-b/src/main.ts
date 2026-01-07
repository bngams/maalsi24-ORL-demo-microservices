import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices/enums/transport.enum';
import { MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  // Créer une application hybride (HTTP + TCP)
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3002;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: port,
    },
  });
  await app.startAllMicroservices();

  // Démarrer le serveur HTTP pour le health check
  await app.listen(port, '0.0.0.0'); // Écouter sur toutes les interfaces réseau

  console.log(`Service B is listening on port ${port} (HTTP + TCP)`);
}
bootstrap();
