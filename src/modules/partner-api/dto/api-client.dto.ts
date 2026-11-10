import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiClientStatus } from '@prisma/client';

export class CreateApiClientDto {
  @ApiProperty({ example: 'Agencia de viajes XYZ' })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiProperty({ example: 'integraciones@xyz.com' })
  @IsEmail()
  @MaxLength(255)
  contactEmail!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Requests por minuto (todas las keys del cliente). Sin valor: sin límite.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6000)
  rpmLimit?: number | null;
}

export class UpdateApiClientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: '`null` quita el límite.',
  })
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  @Max(6000)
  rpmLimit?: number | null;

  @ApiPropertyOptional({ enum: ApiClientStatus })
  @IsOptional()
  @IsEnum(ApiClientStatus)
  status?: ApiClientStatus;
}

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Producción' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Fecha de vencimiento (ISO). Sin valor no vence.',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UsageRangeQueryDto {
  @ApiPropertyOptional({ description: 'Desde (ISO). Default: hace 30 días' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Hasta (ISO, excluyente). Default: ahora',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class UsageEventsQueryDto extends UsageRangeQueryDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
