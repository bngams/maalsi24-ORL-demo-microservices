import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices/enums/transport.enum';
import { MicroserviceOptions } from '@nestjs/microservices';

async function bootstrap() {
  // Créer une application hybride (HTTP + TCP)
  const app = await NestFactory.create(AppModule);

  // Ajouter le microservice TCP
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: 'localhost', // TCP en localhost
      port: parseInt(process.env.SERVICE_PORT || '3001', 10),
    },
  });

  await app.startAllMicroservices();

  // Démarrer le serveur HTTP pour le health check
  const httpPort = parseInt(process.env.SERVICE_PORT || '3001', 10);
  await app.listen(httpPort, '0.0.0.0'); // Écouter sur toutes les interfaces réseau

  console.log(`Service A is listening on port ${httpPort} (HTTP + TCP)`);
}
bootstrap();
