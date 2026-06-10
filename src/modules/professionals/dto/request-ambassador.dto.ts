import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RequestAmbassadorDto {
  @ApiProperty({ example: 'María' })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @ApiProperty({ example: 'González' })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @ApiProperty({ example: '35123456', description: 'Documento (DNI/CUIT)' })
  @IsString()
  @Length(6, 20)
  @Matches(/^[0-9.\-]+$/, { message: 'dni must contain only digits, dots or dashes' })
  @Transform(({ value }) => value?.trim())
  dni: string;

  @ApiProperty({ example: '+5493871234567' })
  @IsString()
  @Length(5, 30)
  @Transform(({ value }) => value?.trim())
  phone: string;

  @ApiPropertyOptional({ example: 'maria@ejemplo.com', description: 'Email de contacto (opcional; por defecto se usa el del usuario)' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  email?: string;

  @ApiProperty({ example: 'Salta' })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  city: string;

  @ApiProperty({ example: 'Salta' })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  province: string;

  @ApiProperty({
    enum: PersonType,
    example: 'individual',
    description: 'Tipo de persona: `individual` o `company` (también acepta INDIVIDUAL/COMPANY).',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(PersonType)
  personType: PersonType;
}
