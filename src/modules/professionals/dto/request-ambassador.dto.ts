import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AgencyTeamMemberDto } from './agency-team-member.dto';

function normalizePersonType(value: unknown): PersonType | unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'AGENCY') return PersonType.COMPANY;
  return normalized;
}

export class RequestAmbassadorDto {
  @ApiProperty({
    enum: PersonType,
    example: 'individual',
    description: 'Tipo de persona: `individual` o `company` (también acepta `agency`).',
  })
  @Transform(({ value }) => normalizePersonType(value))
  @IsEnum(PersonType)
  personType: PersonType;

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

  // ── Individuo ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'María' })
  @ValidateIf((o: RequestAmbassadorDto) => o.personType === PersonType.INDIVIDUAL)
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiPropertyOptional({ example: 'González' })
  @ValidateIf((o: RequestAmbassadorDto) => o.personType === PersonType.INDIVIDUAL)
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @ApiPropertyOptional({ example: '35123456', description: 'DNI del individuo' })
  @ValidateIf((o: RequestAmbassadorDto) => o.personType === PersonType.INDIVIDUAL)
  @IsString()
  @Length(6, 20)
  @Matches(/^[0-9.\-]+$/, { message: 'dni must contain only digits, dots or dashes' })
  @Transform(({ value }) => value?.trim())
  dni?: string;

  @ApiPropertyOptional({ example: 'Salta' })
  @ValidateIf((o: RequestAmbassadorDto) => o.personType === PersonType.INDIVIDUAL)
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  city?: string;

  @ApiPropertyOptional({ example: 'Salta' })
  @ValidateIf((o: RequestAmbassadorDto) => o.personType === PersonType.INDIVIDUAL)
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  province?: string;

  // ── Agencia / empresa ────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: '30-71234567-8', description: 'CUIT de la agencia' })
  @ValidateIf((o: RequestAmbassadorDto) => o.personType === PersonType.COMPANY)
  @IsString()
  @Length(10, 13)
  @Matches(/^[0-9.\-]+$/, { message: 'cuit must contain only digits, dots or dashes' })
  @Transform(({ value }) => value?.trim())
  cuit?: string;

  @ApiPropertyOptional({ example: 'Inmobiliaria Norte S.A.' })
  @ValidateIf((o: RequestAmbassadorDto) => o.personType === PersonType.COMPANY)
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  legalName?: string;

  @ApiPropertyOptional({ example: 'Norte Propiedades' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  tradeName?: string;

  @ApiPropertyOptional({ example: 'Av. Belgrano 1234, Salta' })
  @ValidateIf((o: RequestAmbassadorDto) => o.personType === PersonType.COMPANY)
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  fiscalAddress?: string;

  @ApiPropertyOptional({ example: 'Av. San Martín 567, Salta' })
  @ValidateIf((o: RequestAmbassadorDto) => o.personType === PersonType.COMPANY)
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  realAddress?: string;

  // ── Documentación ──────────────────────────────────────────────────────────

  // Los mediaFileId de documentación son opcionales: lo normal es que ya
  // hayan sido confirmados antes, uno por uno, vía
  // POST /professionals/me/ambassador-documents/:documentType/confirm.
  // Se aceptan igual acá por compatibilidad con clientes viejos del wizard.

  @ApiPropertyOptional({ description: 'MediaFileId del frente del DNI (individuo)' })
  @IsOptional()
  @IsUUID()
  dniFrontMediaFileId?: string;

  @ApiPropertyOptional({ description: 'MediaFileId del dorso del DNI (individuo)' })
  @IsOptional()
  @IsUUID()
  dniBackMediaFileId?: string;

  @ApiPropertyOptional({ description: 'MediaFileId de la selfie (individuo)' })
  @IsOptional()
  @IsUUID()
  selfieMediaFileId?: string;

  @ApiPropertyOptional({ description: 'MediaFileId de la constancia de CUIT (agencia)' })
  @IsOptional()
  @IsUUID()
  cuitCertificateMediaFileId?: string;

  @ApiPropertyOptional({ description: 'MediaFileId de la 1ra hoja del documento constitutivo (agencia)' })
  @IsOptional()
  @IsUUID()
  foundingDocMediaFileId?: string;

  @ApiPropertyOptional({ type: [AgencyTeamMemberDto], description: 'Embajadores dependientes de la agencia' })
  @ValidateIf((o: RequestAmbassadorDto) => o.personType === PersonType.COMPANY)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AgencyTeamMemberDto)
  teamMembers?: AgencyTeamMemberDto[];
}
