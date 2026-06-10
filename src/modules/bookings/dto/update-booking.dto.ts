import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBookingDto {
  @IsOptional() @IsString() @MaxLength(200) clientName?: string;
  @IsOptional() @IsString() @MaxLength(255) clientEmail?: string;
  @IsOptional() @IsString() @MaxLength(30) clientPhone?: string;
  @IsOptional() @IsDateString() checkInDate?: string;
  @IsOptional() @IsDateString() checkOutDate?: string;
  @IsOptional() @IsString() notes?: string;
}
