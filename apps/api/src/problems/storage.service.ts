import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG, type AppConfig } from '../config.js';

/** Stores files on local disk (a Docker volume in production). Keys are server generated. */
@Injectable()
export class StorageService {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  async save(orgId: string, data: Buffer): Promise<string> {
    const key = `${orgId}/${randomUUID()}`;
    const full = this.pathFor(key);
    await mkdir(join(this.config.uploadDir, orgId), { recursive: true });
    await writeFile(full, data, { mode: 0o640 });
    return key;
  }

  pathFor(key: string): string {
    return join(this.config.uploadDir, key);
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
