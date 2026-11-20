import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Membership, OrgGuard, OrgRoles } from '../common/auth.js';
import { Role, type User } from '../generated/prisma/client.js';
import { CreateOrgDto, InviteDto, UpdateOrgDto, UpdateRoleDto } from './orgs.dto.js';
import { OrgsService } from './orgs.service.js';

@Controller('orgs')
@UseGuards(JwtAuthGuard)
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateOrgDto) {
    return this.orgs.create(user.id, dto);
  }

  @Get(':orgId')
  @UseGuards(OrgGuard)
  get(@Param('orgId', ParseUUIDPipe) orgId: string, @Membership() m: { role: Role }) {
    return this.orgs.get(orgId, m.role);
  }

  @Patch(':orgId')
  @UseGuards(OrgGuard)
  @OrgRoles(Role.ADMIN)
  update(@Param('orgId', ParseUUIDPipe) orgId: string, @Body() dto: UpdateOrgDto) {
    return this.orgs.update(orgId, dto);
  }

  @Delete(':orgId')
  @UseGuards(OrgGuard)
  @OrgRoles(Role.ADMIN)
  remove(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.orgs.remove(orgId);
  }

  @Get(':orgId/members')
  @UseGuards(OrgGuard)
  members(@Param('orgId', ParseUUIDPipe) orgId: string, @Membership() m: { role: Role }) {
    return this.orgs.members(orgId, m.role === Role.ADMIN);
  }

  @Post(':orgId/invitations')
  @UseGuards(OrgGuard)
  @OrgRoles(Role.ADMIN)
  invite(@Param('orgId', ParseUUIDPipe) orgId: string, @CurrentUser() user: User, @Body() dto: InviteDto) {
    return this.orgs.invite(orgId, user.id, dto);
  }

  @Delete(':orgId/invitations/:invitationId')
  @UseGuards(OrgGuard)
  @OrgRoles(Role.ADMIN)
  cancelInvitation(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.orgs.cancelInvitation(orgId, invitationId);
  }

  @Patch(':orgId/members/:userId')
  @UseGuards(OrgGuard)
  @OrgRoles(Role.ADMIN)
  changeRole(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.orgs.changeRole(orgId, userId, dto.role);
  }

  @Delete(':orgId/members/:userId')
  @UseGuards(OrgGuard)
  removeMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: User,
    @Membership() m: { role: Role },
  ) {
    // Admins can remove anyone; everyone else can only leave.
    if (m.role !== Role.ADMIN && userId !== user.id) {
      throw new ForbiddenException('Only admins can remove other members');
    }
    return this.orgs.removeMember(orgId, userId);
  }
}
