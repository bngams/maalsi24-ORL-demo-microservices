import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { AppDnsService } from './app-dns.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { Roles } from './auth/roles.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly appDnsService: AppDnsService,
  ) {}

  // ========== Public Endpoints (No authentication required) ==========

  @Get('health')
  health() {
    return { status: 'ok', service: 'gateway-ab' };
  }

  @Get('hello') // HTTP GET endpoint /hello
  async getHello(): Promise<string> {
    return await this.appService.getHello();
  }

  @Get('hello-dns') // HTTP GET endpoint /hello-dns using DNS-based discovery
  async getHelloDns(): Promise<string> {
    return await this.appDnsService.getHello();
  }

  // ========== Protected Endpoints (JWT required) ==========

  @UseGuards(JwtAuthGuard)
  @Get('protected')
  getProtected() {
    return {
      message: 'This is a protected route - JWT authentication successful!',
      info: 'Any authenticated user can access this endpoint',
    };
  }

  // ========== Role-Based Endpoints ==========

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin')
  getAdmin() {
    return {
      message: 'Admin-only route accessed successfully!',
      info: 'Only users with "admin" role can access this endpoint',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  @Get('user')
  getUser() {
    return {
      message: 'User route accessed successfully!',
      info: 'Users with "user" or "admin" role can access this endpoint',
    };
  }
}
