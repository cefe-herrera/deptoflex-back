import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class AgencyTeamMemberDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @ApiProperty({ example: '35123456' })
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

  @ApiProperty({ example: 'juan@agencia.com' })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  email: string;

  @ApiProperty({ example: 'Asesor comercial' })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  roleInCompany: string;
}
