import {
  IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateIf,
} from 'class-validator';
import { FlexPricingPlanCode } from '@prisma/client';

export class CreatePricingPlanDto {
  @IsEnum(FlexPricingPlanCode) code: FlexPricingPlanCode;
  @IsString() @MaxLength(120) label: string;
  @IsInt() @Min(1) minMonths: number;
  @IsOptional() @IsInt() @Min(1) maxMonths?: number;
  @IsNumber() @Min(0) monthlyRent: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;

  @IsOptional() @IsBoolean() rentIncludesExpenses?: boolean;
  @IsOptional() @IsBoolean() rentIncludesUtilities?: boolean;
  @IsOptional() @IsBoolean() includesLinens?: boolean;

  /** Regla del catálogo `flex-fee-rules`. Omitido → regla por defecto; null → sin depósito. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() depositRuleId?: string | null;
  /** Regla del catálogo `flex-fee-rules`. Omitido → regla por defecto; null → sin comisión. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() entryCommissionRuleId?: string | null;

  @IsOptional() @IsString() conditionsText?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
