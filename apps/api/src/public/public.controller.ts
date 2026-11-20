import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttachmentsService } from '../problems/attachments.service.js';
import { sendFile } from '../problems/problems.controller.js';

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

/** Unauthenticated, read-only access to a single problem through its secret share token. */
@Controller('public/share')
@Throttle({ default: { ttl: 60_000, limit: 60 } })
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
  ) {}

  private async link(token: string) {
    if (!TOKEN.test(token)) throw new NotFoundException();
    const link = await this.prisma.shareLink.findFirst({
      where: { token, revokedAt: null },
      include: {
        problem: {
          include: {
            org: { select: { name: true } },
            author: { select: { name: true } },
            attachments: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    if (!link) throw new NotFoundException();
    return link;
  }

  @Get(':token')
  async get(@Param('token') token: string) {
    const { problem: p } = await this.link(token);
    return {
      title: p.title,
      problem: p.problem,
      solution: p.solution,
      format: p.format,
      tags: p.tags,
      organization: p.org.name,
      author: p.author.name,
      updatedAt: p.updatedAt,
      attachments: p.attachments.map((a) => this.attachments.view(a)),
    };
  }

  @Get(':token/attachments/:attachmentId')
  async download(
    @Param('token') token: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const link = await this.link(token);
    const f = await this.attachments.forDownload({ id: attachmentId, problemId: link.problemId });
    sendFile(res, f);
  }
}
