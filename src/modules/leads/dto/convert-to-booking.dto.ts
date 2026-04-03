import { IsUUID, IsDateString, IsNumber, Min, IsOptional, IsString, IsInt } from 'class-validator';

export class ConvertToBookingDto {
  @IsUUID() unitId: string;
  @IsDateString() checkInDate: string;
  @IsDateString() checkOutDate: string;
  @IsNumber() @Min(0) baseAmount: number;
  @IsNumber() @Min(0) totalAmount: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;
}
