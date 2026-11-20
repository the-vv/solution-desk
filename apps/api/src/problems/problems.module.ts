import { Module } from '@nestjs/common';
import { PublicController } from '../public/public.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { ProblemsController } from './problems.controller.js';
import { ProblemsService } from './problems.service.js';
import { StorageService } from './storage.service.js';

@Module({
  controllers: [ProblemsController, PublicController],
  providers: [ProblemsService, AttachmentsService, StorageService],
})
export class ProblemsModule {}
