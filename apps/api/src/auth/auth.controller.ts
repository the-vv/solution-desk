import { Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AUTH_COOKIE, CurrentUser, JwtAuthGuard } from '../common/auth.js';
import { CONFIG, type AppConfig } from '../config.js';
import type { User } from '../generated/prisma/client.js';
import { AuthService } from './auth.service.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  google() {
    // Redirects to Google; handled by the guard.
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async callback(@Req() req: { user: User }, @Res() res: Response) {
    const token = await this.jwt.signAsync({ sub: req.user.id });
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.secureCookies,
      maxAge: SEVEN_DAYS_MS,
      path: '/',
    });
    res.redirect(`${this.config.publicUrl}/`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.auth.me(user.id);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }
}
