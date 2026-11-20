import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '../generated/prisma/client.js';
import type { CreateOrgDto, InviteDto, UpdateOrgDto } from './orgs.dto.js';

@Injectable()
export class OrgsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrgDto) {
    const org = await this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        memberships: { create: { userId, role: Role.ADMIN } },
      },
    });
    return { ...org, role: Role.ADMIN };
  }

  async get(orgId: string, role: Role) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { _count: { select: { problems: true, memberships: true } } },
    });
    if (!org) throw new NotFoundException();
    return {
      id: org.id,
      name: org.name,
      description: org.description,
      createdAt: org.createdAt,
      problemCount: org._count.problems,
      memberCount: org._count.memberships,
      role,
    };
  }

  update(orgId: string, dto: UpdateOrgDto) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { name: dto.name?.trim(), description: dto.description?.trim() },
    });
  }

  async remove(orgId: string) {
    await this.prisma.organization.delete({ where: { id: orgId } });
    return { ok: true };
  }

  async members(orgId: string, isAdmin: boolean) {
    const rows = await this.prisma.membership.findMany({
      where: { orgId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    const invitations = isAdmin
      ? await this.prisma.invitation.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } })
      : [];
    return {
      members: rows.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      invitations: invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.createdAt })),
    };
  }

  /** Existing users are added straight away. Unknown emails get a pending invitation used at first sign-in. */
  async invite(orgId: string, invitedById: string, dto: InviteDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      const already = await this.prisma.membership.findUnique({
        where: { orgId_userId: { orgId, userId: existing.id } },
      });
      if (already) throw new ConflictException('This user is already a member');
      await this.prisma.membership.create({ data: { orgId, userId: existing.id, role: dto.role } });
      return { status: 'added' as const };
    }
    await this.prisma.invitation.upsert({
      where: { orgId_email: { orgId, email } },
      create: { orgId, email, role: dto.role, invitedById },
      update: { role: dto.role, invitedById },
    });
    return { status: 'invited' as const };
  }

  async cancelInvitation(orgId: string, invitationId: string) {
    const res = await this.prisma.invitation.deleteMany({ where: { id: invitationId, orgId } });
    if (!res.count) throw new NotFoundException();
    return { ok: true };
  }

  async changeRole(orgId: string, userId: string, role: Role) {
    await this.assertNotLastAdmin(orgId, userId, role);
    const res = await this.prisma.membership.updateMany({ where: { orgId, userId }, data: { role } });
    if (!res.count) throw new NotFoundException();
    return { ok: true };
  }

  async removeMember(orgId: string, userId: string) {
    await this.assertNotLastAdmin(orgId, userId, null);
    const res = await this.prisma.membership.deleteMany({ where: { orgId, userId } });
    if (!res.count) throw new NotFoundException();
    return { ok: true };
  }

  private async assertNotLastAdmin(orgId: string, userId: string, newRole: Role | null) {
    const target = await this.prisma.membership.findUnique({ where: { orgId_userId: { orgId, userId } } });
    if (!target) throw new NotFoundException();
    if (target.role !== Role.ADMIN || newRole === Role.ADMIN) return;
    const admins = await this.prisma.membership.count({ where: { orgId, role: Role.ADMIN } });
    if (admins <= 1) throw new BadRequestException('An organization needs at least one admin');
  }
}
