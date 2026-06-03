import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgendaContactDto {
  @ApiProperty({ example: 'Rebeca' })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @ApiPropertyOptional({ example: 'García' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @ApiPropertyOptional({ example: '+54223443442244' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => value?.trim())
  phone?: string;

  @ApiPropertyOptional({ example: 'rebeca@mail.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'Inmobiliaria Sur' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

  @ApiPropertyOptional({ description: 'Color del avatar (hex o nombre)', example: '#1d4ed8' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  avatarColor?: string;

  @ApiPropertyOptional({ description: 'Fecha del último contacto (ISO-8601)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  lastContactedAt?: string;
}
