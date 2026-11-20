import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CONFIG, type AppConfig } from '../config.js';
import { JwtAuthGuard, OrgGuard } from '../common/auth.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleStrategy } from './google.strategy.js';

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      global: true,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({ secret: config.jwtSecret, signOptions: { expiresIn: '7d' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtAuthGuard, OrgGuard],
  exports: [JwtAuthGuard, OrgGuard],
})
export class AuthModule {}
