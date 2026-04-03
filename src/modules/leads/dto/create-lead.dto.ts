import {
  IsString, IsEmail, IsOptional, IsUUID, IsDateString,
  IsInt, Min, IsEnum, MaxLength,
} from 'class-validator';

export class CreateLeadDto {
  @IsOptional() @IsUUID() unitId?: string;
  @IsString() @MaxLength(200) clientName: string;
  @IsOptional() @IsEmail() clientEmail?: string;
  @IsOptional() @IsString() @MaxLength(30) clientPhone?: string;
  @IsOptional() @IsDateString() checkInDate?: string;
  @IsOptional() @IsDateString() checkOutDate?: string;
  @IsInt() @Min(1) adults: number;
  @IsOptional() @IsInt() @Min(0) children?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() @MaxLength(100) source?: string;
}
