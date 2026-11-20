import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates or updates the user, then turns any pending invitations for their email into memberships. */
  async signInWithGoogle(p: { googleId: string; email: string; name: string; avatarUrl: string | null }) {
    const email = p.email.toLowerCase();
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { googleId: p.googleId },
        create: { googleId: p.googleId, email, name: p.name, avatarUrl: p.avatarUrl },
        update: { email, name: p.name, avatarUrl: p.avatarUrl },
      });
      const invitations = await tx.invitation.findMany({ where: { email } });
      if (invitations.length) {
        await tx.membership.createMany({
          data: invitations.map((i) => ({ orgId: i.orgId, userId: user.id, role: i.role })),
          skipDuplicates: true,
        });
        await tx.invitation.deleteMany({ where: { id: { in: invitations.map((i) => i.id) } } });
      }
      return user;
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { include: { org: true }, orderBy: { createdAt: 'asc' } } },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizations: user.memberships.map((m) => ({ id: m.org.id, name: m.org.name, role: m.role })),
    };
  }
}
