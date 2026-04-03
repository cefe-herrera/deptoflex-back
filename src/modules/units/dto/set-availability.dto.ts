import { IsDateString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { AvailabilityReason } from '@prisma/client';

export class SetAvailabilityDto {
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsBoolean() isAvailable: boolean;
  @IsOptional() @IsEnum(AvailabilityReason) reason?: AvailabilityReason;
}
