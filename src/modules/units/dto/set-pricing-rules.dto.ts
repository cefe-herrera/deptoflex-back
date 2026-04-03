import {
  IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min, IsNumber, MaxLength,
  ValidateNested, IsArray, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RateType } from '@prisma/client';

export class PricingRuleDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsNumber() @Min(0) baseRate: number;
  @IsOptional() @IsString() currency?: string;
  @IsEnum(RateType) rateType: RateType;
  @IsInt() @Min(1) minNights: number;
  @IsOptional() @IsInt() maxNights?: number;
  @IsBoolean() isDefault: boolean;
}

export class SetPricingRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingRuleDto)
  rules: PricingRuleDto[];
}
