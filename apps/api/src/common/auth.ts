import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Role, User } from '../generated/prisma/client.js';

export const AUTH_COOKIE = 'sd_token';

export interface AuthedRequest extends Request {
  user: User;
  membership?: { orgId: string; userId: string; role: Role };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});

export const OrgRoles = (...roles: Role[]) => SetMetadata('orgRoles', roles);

/** Requires the :orgId route param and a membership. Pair with OrgRoles to restrict by role. */
@Injectable()
export class OrgGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const orgId = (req.params as Record<string, string>)['orgId'];
    const membership = await this.prisma.membership.findUnique({
      where: { orgId_userId: { orgId, userId: req.user.id } },
    });
    // Same response for "not found" and "not a member" so org ids cannot be probed.
    if (!membership) throw new ForbiddenException('You are not a member of this organization');
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>('orgRoles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles?.length && !roles.includes(membership.role)) {
      throw new ForbiddenException('Your role does not allow this action');
    }
    req.membership = membership;
    return true;
  }
}

export const Membership = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().membership!;
});
