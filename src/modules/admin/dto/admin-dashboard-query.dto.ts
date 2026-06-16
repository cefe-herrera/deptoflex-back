import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum DashboardModality {
  ALL = 'ALL',
  TEMPORAL = 'TEMPORAL',
  FLEX = 'FLEX',
}

export class AdminDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsEnum(DashboardModality)
  modality?: DashboardModality = DashboardModality.TEMPORAL;
}

export class SyncCloudbedsQueryDto {
  @IsUUID()
  propertyId: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
