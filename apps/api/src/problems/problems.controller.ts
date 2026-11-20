import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, JwtAuthGuard, Membership, OrgGuard, OrgRoles } from '../common/auth.js';
import { Role, type User } from '../generated/prisma/client.js';
import { AttachmentsService } from './attachments.service.js';
import { ListProblemsDto, ListRequestsDto, ProblemInputDto, ReviewDto } from './problems.dto.js';
import { ProblemsService } from './problems.service.js';

type Member = { role: Role };
const MAX_UPLOAD = 25 * 1024 * 1024;

@Controller('orgs/:orgId')
@UseGuards(JwtAuthGuard, OrgGuard)
export class ProblemsController {
  constructor(
    private readonly problems: ProblemsService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get('problems')
  list(@Param('orgId', ParseUUIDPipe) orgId: string, @Query() query: ListProblemsDto) {
    return this.problems.list(orgId, query);
  }

  @Get('tags')
  tags(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.problems.tags(orgId);
  }

  @Post('problems')
  @OrgRoles(Role.ADMIN, Role.MEMBER)
  create(@Param('orgId', ParseUUIDPipe) orgId: string, @CurrentUser() user: User, @Body() dto: ProblemInputDto) {
    return this.problems.create(orgId, user.id, dto);
  }

  @Get('problems/:id')
  get(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Membership() m: Member,
  ) {
    return this.problems.get(orgId, id, { userId: user.id, role: m.role });
  }

  @Patch('problems/:id')
  update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Membership() m: Member,
    @Body() dto: ProblemInputDto,
  ) {
    return this.problems.update(orgId, id, { userId: user.id, role: m.role }, dto);
  }

  @Delete('problems/:id')
  remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Membership() m: Member,
  ) {
    return this.problems.remove(orgId, id, { userId: user.id, role: m.role });
  }

  @Post('problems/:id/share')
  createShare(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Membership() m: Member,
  ) {
    return this.problems.createShare(orgId, id, { userId: user.id, role: m.role });
  }

  @Delete('problems/:id/share')
  revokeShare(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Membership() m: Member,
  ) {
    return this.problems.revokeShare(orgId, id, { userId: user.id, role: m.role });
  }

  @Post('attachments')
  @OrgRoles(Role.ADMIN, Role.MEMBER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD, files: 1 } }))
  upload(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('A file is required');
    return this.attachments.upload(orgId, user.id, file);
  }

  @Get('attachments/:attachmentId')
  async download(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res() res: Response,
  ) {
    const f = await this.attachments.forDownload({ id: attachmentId, orgId });
    sendFile(res, f);
  }

  @Get('change-requests')
  listRequests(@Param('orgId', ParseUUIDPipe) orgId: string, @CurrentUser() user: User, @Membership() m: Member, @Query() q: ListRequestsDto) {
    return this.problems.listRequests(orgId, { userId: user.id, role: m.role }, q.status);
  }

  @Post('change-requests/:requestId/approve')
  @OrgRoles(Role.ADMIN)
  approve(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: User,
    @Body() dto: ReviewDto,
  ) {
    return this.problems.reviewRequest(orgId, requestId, user.id, true, dto.note);
  }

  @Post('change-requests/:requestId/reject')
  @OrgRoles(Role.ADMIN)
  reject(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: User,
    @Body() dto: ReviewDto,
  ) {
    return this.problems.reviewRequest(orgId, requestId, user.id, false, dto.note);
  }

  @Delete('change-requests/:requestId')
  cancel(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: User,
  ) {
    return this.problems.cancelRequest(orgId, requestId, user.id);
  }
}

export function sendFile(
  res: Response,
  f: { path: string; filename: string; mimeType: string; inline: boolean },
) {
  res.setHeader('Content-Type', f.inline ? f.mimeType : 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${f.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
  );
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(f.path);
}
