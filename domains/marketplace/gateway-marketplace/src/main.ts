import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3301;
  await app.listen(port, '0.0.0.0');
  console.log(`Gateway Marketplace is running on port ${port}`);
}
bootstrap();
