import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma, Role, type ChangeStatus, type ContentFormat } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttachmentsService } from './attachments.service.js';
import { type ListProblemsDto, type ProblemInputDto, normalizeTags } from './problems.dto.js';
import { StorageService } from './storage.service.js';

interface Actor {
  userId: string;
  role: Role;
}

interface EditPayload {
  title: string;
  problem: string;
  solution: string;
  format: ContentFormat;
  tags: string[];
  attachmentIds: string[];
}

/** A short plain-text preview. Markdown syntax is stripped so lists do not show backticks and hashes. */
function excerptOf(text: string, format: ContentFormat): string {
  const head = text.slice(0, 600);
  const plain =
    format === 'MARKDOWN'
      ? head
          .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
          .replace(/```[a-z]*/gi, ' ')
          .replace(/[`*_#>|]/g, '')
      : head;
  return plain.replace(/\s+/g, ' ').trim().slice(0, 240);
}

const authorSelect = { select: { id: true, name: true, avatarUrl: true } } as const;

const searchVector = Prisma.sql`problem_search_vector(p."title", p."problem", p."solution", p."tags")`;

@Injectable()
export class ProblemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
    private readonly storage: StorageService,
  ) {}

  // ---- read ----------------------------------------------------------------

  async list(orgId: string, dto: ListProblemsDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const q = dto.q?.trim();
    const tag = dto.tag?.trim().toLowerCase();

    let ids: string[];
    let total: number;

    if (q) {
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      const tagFilter = tag ? Prisma.sql`AND ${tag} = ANY(p."tags")` : Prisma.empty;
      const match = Prisma.sql`
        p."orgId" = ${orgId} ${tagFilter}
        AND (${searchVector} @@ websearch_to_tsquery('english', ${q})
             OR p."title" ILIKE ${like} OR p."problem" ILIKE ${like} OR p."solution" ILIKE ${like}
             OR EXISTS (SELECT 1 FROM unnest(p."tags") t WHERE t ILIKE ${like}))`;
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT p."id" FROM "Problem" p WHERE ${match}
        ORDER BY ts_rank(${searchVector}, websearch_to_tsquery('english', ${q})) DESC, p."createdAt" DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
      const count = await this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM "Problem" p WHERE ${match}`;
      ids = rows.map((r) => r.id);
      total = Number(count[0].n);
    } else {
      const where: Prisma.ProblemWhereInput = { orgId, ...(tag ? { tags: { has: tag } } : {}) };
      const [rows, count] = await Promise.all([
        this.prisma.problem.findMany({
          where,
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.problem.count({ where }),
      ]);
      ids = rows.map((r) => r.id);
      total = count;
    }

    const found = await this.prisma.problem.findMany({
      where: { id: { in: ids } },
      include: { author: authorSelect, _count: { select: { attachments: true } } },
    });
    const byId = new Map(found.map((p) => [p.id, p]));
    const items = ids.flatMap((id) => {
      const p = byId.get(id);
      if (!p) return [];
      return [
        {
          id: p.id,
          title: p.title,
          excerpt: excerptOf(p.problem, p.format),
          format: p.format,
          tags: p.tags,
          author: p.author,
          attachmentCount: p._count.attachments,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        },
      ];
    });
    return { items, total, page, pageSize };
  }

  async tags(orgId: string) {
    const rows = await this.prisma.$queryRaw<{ tag: string; count: bigint }[]>`
      SELECT t AS tag, count(*) AS count FROM "Problem" p, unnest(p."tags") t
      WHERE p."orgId" = ${orgId} GROUP BY t ORDER BY count(*) DESC, t ASC LIMIT 100`;
    return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
  }

  async get(orgId: string, id: string, actor: Actor) {
    const p = await this.prisma.problem.findFirst({
      where: { id, orgId },
      include: {
        author: authorSelect,
        attachments: { orderBy: { createdAt: 'asc' } },
        shareLinks: { where: { revokedAt: null }, take: 1 },
        changeRequests: { where: { status: 'PENDING' }, select: { id: true } },
      },
    });
    if (!p) throw new NotFoundException();
    const isAuthor = p.authorId === actor.userId;
    const canWrite = actor.role !== Role.VIEWER;
    const direct = actor.role === Role.ADMIN || (isAuthor && canWrite);
    return {
      id: p.id,
      title: p.title,
      problem: p.problem,
      solution: p.solution,
      format: p.format,
      tags: p.tags,
      author: p.author,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      attachments: p.attachments.map((a) => this.attachments.view(a)),
      pendingRequests: p.changeRequests.length,
      shareToken: direct ? (p.shareLinks[0]?.token ?? null) : null,
      permissions: { canEdit: direct, canRequestChange: canWrite && !direct, canShare: direct },
    };
  }

  // ---- write ---------------------------------------------------------------

  async create(orgId: string, userId: string, dto: ProblemInputDto) {
    const input = this.toPayload(dto);
    const problem = await this.prisma.$transaction(async (tx) => {
      const created = await tx.problem.create({
        data: {
          orgId,
          authorId: userId,
          title: input.title,
          problem: input.problem,
          solution: input.solution,
          format: input.format,
          tags: input.tags,
        },
      });
      await this.syncAttachments(tx, orgId, created.id, input.attachmentIds);
      return created;
    });
    return { id: problem.id };
  }

  /** Authors and admins edit directly. Other members create a change request for admins to review. */
  async update(orgId: string, id: string, actor: Actor, dto: ProblemInputDto) {
    const problem = await this.mustFind(orgId, id);
    this.assertCanWrite(actor);
    const input = this.toPayload(dto);
    if (this.isDirect(actor, problem.authorId)) {
      await this.applyEdit(orgId, id, input);
      return { applied: true as const };
    }
    await this.validateAttachmentIds(orgId, id, input.attachmentIds);
    const existing = await this.prisma.changeRequest.findFirst({
      where: { problemId: id, requesterId: actor.userId, type: 'EDIT', status: 'PENDING' },
    });
    const data = { payload: input as unknown as Prisma.InputJsonValue };
    const request = existing
      ? await this.prisma.changeRequest.update({ where: { id: existing.id }, data })
      : await this.prisma.changeRequest.create({
          data: { orgId, problemId: id, requesterId: actor.userId, type: 'EDIT', ...data },
        });
    return { applied: false as const, changeRequestId: request.id };
  }

  async remove(orgId: string, id: string, actor: Actor) {
    const problem = await this.mustFind(orgId, id);
    this.assertCanWrite(actor);
    if (this.isDirect(actor, problem.authorId)) {
      await this.deleteProblem(id);
      return { applied: true as const };
    }
    const existing = await this.prisma.changeRequest.findFirst({
      where: { problemId: id, requesterId: actor.userId, type: 'DELETE', status: 'PENDING' },
    });
    const request =
      existing ??
      (await this.prisma.changeRequest.create({
        data: { orgId, problemId: id, requesterId: actor.userId, type: 'DELETE' },
      }));
    return { applied: false as const, changeRequestId: request.id };
  }

  // ---- share links ---------------------------------------------------------

  async createShare(orgId: string, id: string, actor: Actor) {
    const problem = await this.mustFind(orgId, id);
    if (!this.isDirect(actor, problem.authorId)) throw new ForbiddenException('Only the author or an admin can share');
    const existing = await this.prisma.shareLink.findFirst({ where: { problemId: id, revokedAt: null } });
    if (existing) return { token: existing.token };
    const link = await this.prisma.shareLink.create({
      data: { problemId: id, createdById: actor.userId, token: randomBytes(32).toString('base64url') },
    });
    return { token: link.token };
  }

  async revokeShare(orgId: string, id: string, actor: Actor) {
    const problem = await this.mustFind(orgId, id);
    if (!this.isDirect(actor, problem.authorId)) throw new ForbiddenException('Only the author or an admin can revoke');
    await this.prisma.shareLink.updateMany({
      where: { problemId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  // ---- change requests -----------------------------------------------------

  async listRequests(orgId: string, actor: Actor, status?: ChangeStatus) {
    const rows = await this.prisma.changeRequest.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
        ...(actor.role === Role.ADMIN ? {} : { requesterId: actor.userId }),
      },
      include: {
        problem: { select: { id: true, title: true, problem: true, solution: true, tags: true, format: true } },
        requester: authorSelect,
        reviewer: authorSelect,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      requester: r.requester,
      reviewer: r.reviewer,
      problem: r.problem,
      proposed: r.payload as EditPayload | null,
    }));
  }

  async reviewRequest(orgId: string, requestId: string, reviewerId: string, approve: boolean, note?: string) {
    const request = await this.prisma.changeRequest.findFirst({ where: { id: requestId, orgId } });
    if (!request) throw new NotFoundException();
    if (request.status !== 'PENDING') throw new BadRequestException('This request was already reviewed');

    if (approve) {
      if (request.type === 'DELETE') {
        // Deleting the problem cascades its change requests, so there is no row left to mark.
        await this.deleteProblem(request.problemId);
        return { ok: true };
      }
      await this.applyEdit(orgId, request.problemId, request.payload as unknown as EditPayload);
    }
    await this.prisma.changeRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        reviewerId,
        reviewNote: note || null,
        reviewedAt: new Date(),
      },
    });
    return { ok: true };
  }

  async cancelRequest(orgId: string, requestId: string, userId: string) {
    const res = await this.prisma.changeRequest.deleteMany({
      where: { id: requestId, orgId, requesterId: userId, status: 'PENDING' },
    });
    if (!res.count) throw new NotFoundException();
    return { ok: true };
  }

  // ---- internals -----------------------------------------------------------

  private isDirect(actor: Actor, authorId: string) {
    return actor.role === Role.ADMIN || (actor.role === Role.MEMBER && authorId === actor.userId);
  }

  private assertCanWrite(actor: Actor) {
    if (actor.role === Role.VIEWER) throw new ForbiddenException('Viewers cannot change problems');
  }

  private async mustFind(orgId: string, id: string) {
    const problem = await this.prisma.problem.findFirst({ where: { id, orgId } });
    if (!problem) throw new NotFoundException();
    return problem;
  }

  private toPayload(dto: ProblemInputDto): EditPayload {
    return {
      title: dto.title.trim(),
      problem: dto.problem,
      solution: dto.solution,
      format: dto.format,
      tags: normalizeTags(dto.tags),
      attachmentIds: [...new Set(dto.attachmentIds ?? [])],
    };
  }

  private async validateAttachmentIds(orgId: string, problemId: string | null, ids: string[]) {
    if (!ids.length) return;
    const found = await this.prisma.attachment.count({
      where: { id: { in: ids }, orgId, OR: [{ problemId: null }, ...(problemId ? [{ problemId }] : [])] },
    });
    if (found !== ids.length) throw new BadRequestException('Unknown attachment');
  }

  private async applyEdit(orgId: string, id: string, input: EditPayload) {
    const removedKeys = await this.prisma.$transaction(async (tx) => {
      await tx.problem.update({
        where: { id },
        data: {
          title: input.title,
          problem: input.problem,
          solution: input.solution,
          format: input.format,
          tags: input.tags,
        },
      });
      return this.syncAttachments(tx, orgId, id, input.attachmentIds);
    });
    await Promise.all(removedKeys.map((k) => this.storage.remove(k)));
  }

  /** Makes the problem's attachments exactly `ids`. Returns storage keys of removed files. */
  private async syncAttachments(
    tx: Prisma.TransactionClient,
    orgId: string,
    problemId: string,
    ids: string[],
  ): Promise<string[]> {
    const candidates = await tx.attachment.findMany({
      where: { id: { in: ids }, orgId, OR: [{ problemId: null }, { problemId }] },
    });
    if (candidates.length !== ids.length) throw new BadRequestException('Unknown attachment');
    const removed = await tx.attachment.findMany({ where: { problemId, id: { notIn: ids } } });
    await tx.attachment.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
    await tx.attachment.updateMany({ where: { id: { in: ids } }, data: { problemId } });
    return removed.map((r) => r.storageKey);
  }

  private async deleteProblem(id: string) {
    const files = await this.prisma.attachment.findMany({ where: { problemId: id } });
    await this.prisma.problem.delete({ where: { id } });
    await Promise.all(files.map((f) => this.storage.remove(f.storageKey)));
  }
}
