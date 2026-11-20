import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { CONFIG, loadConfig } from '../config.js';

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: loadConfig }, PrismaService],
  exports: [CONFIG, PrismaService],
})
export class PrismaModule {}
