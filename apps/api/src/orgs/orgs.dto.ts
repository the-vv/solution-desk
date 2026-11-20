import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '../generated/prisma/client.js';

export class CreateOrgDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class UpdateOrgDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class InviteDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsEnum(Role) role: Role;
}

export class UpdateRoleDto {
  @IsEnum(Role) role: Role;
}
