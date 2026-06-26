import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkSettlementPaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
