import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { CONFIG, type AppConfig } from '../config.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(CONFIG) config: AppConfig,
    private readonly auth: AuthService,
  ) {
    super({
      clientID: config.googleClientId,
      clientSecret: config.googleClientSecret,
      callbackURL: `${config.publicUrl}/api/auth/google/callback`,
      scope: ['openid', 'email', 'profile'],
    });
  }

  async validate(_access: string, _refresh: string, profile: Profile) {
    const email = profile.emails?.[0];
    if (!email?.value || email.verified === false) {
      throw new UnauthorizedException('A verified Google email is required');
    }
    return this.auth.signInWithGoogle({
      googleId: profile.id,
      email: email.value,
      name: profile.displayName || email.value,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    });
  }
}
