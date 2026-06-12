import {
  IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';
import {
  FlexDepositRule, FlexEntryCommissionRule, FlexPricingPlanCode,
} from '@prisma/client';

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

  @IsOptional() @IsEnum(FlexDepositRule) depositRule?: FlexDepositRule;
  @IsOptional() @IsNumber() @Min(0) customDepositAmount?: number;
  @IsOptional() @IsEnum(FlexEntryCommissionRule) entryCommissionRule?: FlexEntryCommissionRule;

  @IsOptional() @IsString() conditionsText?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
