import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsulModule } from '@shared/consul';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ConsulModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        serviceName: configService.get<string>('SERVICE_NAME') || 'service-a',
        servicePort: configService.get<number>('PORT') || 3001,
        serviceHost: configService.get<string>('SERVICE_HOST') || 'host.docker.internal',
        consulHost: configService.get<string>('CONSUL_HOST') || 'localhost',
        consulPort: configService.get<string>('CONSUL_PORT') || '8500',
        healthCheckPath: '/health',
        healthCheckInterval: '10s',
        tags: ['domain:ab', 'type:tcp'],
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
