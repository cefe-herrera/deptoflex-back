import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export type FlexBookingStatusType = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export class UpdateFlexBookingDto {
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']) status?: FlexBookingStatusType;
  @IsOptional() @IsString() notes?: string;

  @IsOptional() @IsString() @MaxLength(200) clientName?: string;
  @IsOptional() @IsString() @MaxLength(255) clientEmail?: string;
  @IsOptional() @IsString() @MaxLength(30) clientPhone?: string;

  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsInt() @Min(1) totalMonths?: number;
  @IsOptional() @IsNumber() @Min(0) monthlyAmount?: number;
  @IsOptional() @IsNumber() @Min(0) totalAmount?: number;
}
