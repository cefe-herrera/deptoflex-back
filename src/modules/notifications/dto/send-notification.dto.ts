import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { NotificationType } from '@prisma/client';

export enum NotificationTarget {
  USER = 'user',
  ROLE = 'role',
  ALL = 'all',
}

export class SendNotificationDto {
  @IsEnum(NotificationTarget)
  target: NotificationTarget;

  @ValidateIf((o) => o.target === NotificationTarget.USER)
  @IsUUID()
  userId?: string;

  @ValidateIf((o) => o.target === NotificationTarget.ROLE)
  @IsString()
  @MaxLength(50)
  role?: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  /** Si true junto con type GENERIC, se trata como promoción y respeta promosEnabled. */
  @IsOptional()
  @IsBoolean()
  isPromotional?: boolean;
}
