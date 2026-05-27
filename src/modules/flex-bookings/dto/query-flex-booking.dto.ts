import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryFlexBookingDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
  @IsOptional() @IsUUID() propertyFlexId?: string;
  @IsOptional() @IsUUID() professionalProfileId?: string;
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']) status?: string;
  @IsOptional() @IsString() startDateFrom?: string;
  @IsOptional() @IsString() startDateTo?: string;
}
