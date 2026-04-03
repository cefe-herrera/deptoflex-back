import {
  IsString, IsUUID, IsDateString, IsInt, Min, IsNumber, IsOptional, MaxLength,
} from 'class-validator';

export class CreateBookingDto {
  @IsOptional() @IsUUID() leadId?: string;
  @IsUUID() unitId: string;
  @IsOptional() @IsUUID() professionalProfileId?: string;
  @IsString() @MaxLength(200) clientName: string;
  @IsOptional() @IsString() clientEmail?: string;
  @IsOptional() @IsString() clientPhone?: string;
  @IsDateString() checkInDate: string;
  @IsDateString() checkOutDate: string;
  @IsInt() @Min(1) adults: number;
  @IsOptional() @IsInt() @Min(0) children?: number;
  @IsNumber() @Min(0) baseAmount: number;
  @IsNumber() @Min(0) totalAmount: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;
}
