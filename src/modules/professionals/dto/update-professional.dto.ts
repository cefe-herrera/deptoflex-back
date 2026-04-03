import { IsString, IsOptional, MaxLength, IsDecimal, IsEnum } from 'class-validator';
import { ProfessionalStatus } from '@prisma/client';

export class UpdateProfessionalDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;
}

export class AdminUpdateProfessionalDto extends UpdateProfessionalDto {
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  defaultCommissionRate?: string;

  @IsOptional()
  @IsEnum(ProfessionalStatus)
  status?: ProfessionalStatus;
}
