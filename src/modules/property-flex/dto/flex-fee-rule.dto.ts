import { PartialType, OmitType } from '@nestjs/mapped-types';
import {
  IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { FlexFeeRuleKind, FlexFeeRuleMode } from '@prisma/client';

export class CreateFlexFeeRuleDto {
  @IsEnum(FlexFeeRuleKind) kind: FlexFeeRuleKind;
  @IsString() @MaxLength(120) name: string;
  @IsEnum(FlexFeeRuleMode) mode: FlexFeeRuleMode;

  /** RENT_FRACTION: alquiler × numerator / denominator (ej. 1/3, 50/100, 2/1). */
  @IsOptional() @IsNumber() @Min(0) numerator?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) denominator?: number;
  /** FIXED: monto en la moneda del plan. */
  @IsOptional() @IsNumber() @Min(0) fixedAmount?: number;

  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

/** El tipo (depósito / comisión) no se puede cambiar: los planes ya la usan en un rol concreto. */
export class UpdateFlexFeeRuleDto extends PartialType(OmitType(CreateFlexFeeRuleDto, ['kind'] as const)) {}
