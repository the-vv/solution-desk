import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ChangeStatus, ContentFormat } from '../generated/prisma/client.js';

export class ProblemInputDto {
  @IsString() @MinLength(3) @MaxLength(200) title: string;
  @IsString() @MinLength(1) @MaxLength(100_000) problem: string;
  @IsString() @MaxLength(100_000) solution: string;
  @IsEnum(ContentFormat) format: ContentFormat;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(30, { each: true })
  tags: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) attachmentIds?: string[];
}

export class ListProblemsDto {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsString() @MaxLength(30) tag?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}

export class ListRequestsDto {
  @IsOptional() @IsEnum(ChangeStatus) status?: ChangeStatus;
}

export class ReviewDto {
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(500)
  note?: string;
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}
