import { Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from './storage.service.js';

const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AttachmentsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AttachmentsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.cleanupOrphans(), 60 * 60 * 1000);
    this.timer.unref();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async upload(orgId: string, userId: string, file: Express.Multer.File) {
    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/[\r\n"\\/]/g, '_').slice(0, 200);
    const storageKey = await this.storage.save(orgId, file.buffer);
    const row = await this.prisma.attachment.create({
      data: {
        orgId,
        uploadedById: userId,
        filename: filename || 'file',
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        storageKey,
      },
    });
    return this.view(row);
  }

  async forDownload(where: { id: string; orgId?: string; problemId?: string }) {
    const row = await this.prisma.attachment.findFirst({ where });
    if (!row) throw new NotFoundException();
    return {
      path: this.storage.pathFor(row.storageKey),
      filename: row.filename,
      mimeType: row.mimeType,
      // Only raster images render inline. Everything else (including SVG/HTML) downloads.
      inline: INLINE_TYPES.has(row.mimeType),
    };
  }

  view(a: { id: string; filename: string; mimeType: string; size: number }) {
    return { id: a.id, filename: a.filename, mimeType: a.mimeType, size: a.size };
  }

  /** Removes uploads that were never saved into a problem (and are not waiting in a pending change request). */
  async cleanupOrphans() {
    try {
      const pending = await this.prisma.changeRequest.findMany({
        where: { status: 'PENDING', type: 'EDIT' },
        select: { payload: true },
      });
      const keep = new Set(
        pending.flatMap((p) => ((p.payload as { attachmentIds?: string[] } | null)?.attachmentIds ?? [])),
      );
      const stale = await this.prisma.attachment.findMany({
        where: { problemId: null, createdAt: { lt: new Date(Date.now() - ORPHAN_MAX_AGE_MS) } },
      });
      for (const a of stale.filter((s) => !keep.has(s.id))) {
        await this.storage.remove(a.storageKey);
        await this.prisma.attachment.delete({ where: { id: a.id } });
      }
    } catch (err) {
      this.log.warn(`Orphan cleanup failed: ${String(err)}`);
    }
  }
}
