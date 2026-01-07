/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
// import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConsulModule } from '@shared/consul/dist/consul.module';
import { AppDnsService } from './app-dns.service';
import { AuthModule } from './auth/auth.module';

@Module({
  //imports: [
  //   ClientsModule.register([
  //     {
  //       name: 'SERVICE_A_CLIENT',
  //       transport: Transport.TCP,
  //       options: {
  //         host: 'localhost',
  //         port: 3001,
  //       },
  //     },
  //     {
  //       name: 'SERVICE_B_CLIENT',
  //       transport: Transport.TCP,
  //       options: {
  //         host: 'localhost',
  //         port: 3002,
  //       },
  //     },
  //   ]),
  // ],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule, // Module d'authentification JWT
    ConsulModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        serviceName: 'gateway-ab',
        servicePort: configService.get<number>('PORT') || 3300,
        consulHost: configService.get<string>('CONSUL_HOST') || 'localhost',
        consulPort: configService.get<string>('CONSUL_PORT') || '8500',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, AppDnsService],
})
export class AppModule {}
