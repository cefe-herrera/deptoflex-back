import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum DashboardActivityPeriod {
  '7d' = '7d',
  '30d' = '30d',
  month = 'month',
}

export class AdminDashboardQueryDto {
  @IsOptional()
  @IsEnum(DashboardActivityPeriod)
  period?: DashboardActivityPeriod = DashboardActivityPeriod['30d'];
}

export class SyncCloudbedsQueryDto {
  @IsUUID()
  propertyId: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
