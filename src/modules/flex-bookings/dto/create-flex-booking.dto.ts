import { IsString, IsOptional, IsUUID, IsInt, IsNumber, Min, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateFlexBookingDto {
  @IsUUID() propertyFlexId: string;
  @IsOptional() @IsUUID() professionalProfileId?: string;
  @IsOptional() @IsUUID() pricingPlanId?: string;

  @IsString() @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  clientName: string;

  @IsOptional() @IsString() @MaxLength(255) clientEmail?: string;
  @IsOptional() @IsString() @MaxLength(30) clientPhone?: string;

  @IsString() startDate: string;
  @IsString() endDate: string;

  @IsInt() @Min(1) totalMonths: number;

  @IsNumber() @Min(0) monthlyAmount: number;
  @IsNumber() @Min(0) totalAmount: number;
  @IsOptional() @IsNumber() @Min(0) depositAmount?: number;

  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsString() notes?: string;
}
