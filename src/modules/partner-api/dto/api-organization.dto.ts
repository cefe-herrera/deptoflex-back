import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Roles que la organización puede asignar (OWNER solo lo asigna el admin). */
export const ASSIGNABLE_MEMBER_ROLES = ['ADMIN', 'VIEWER'] as const;
export type AssignableMemberRole = (typeof ASSIGNABLE_MEMBER_ROLES)[number];

export class InviteApiMemberDto {
  @ApiProperty({ example: 'dev@xyz.com' })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({
    enum: ASSIGNABLE_MEMBER_ROLES,
    description:
      'ADMIN: gestiona keys y usuarios. VIEWER: solo ve las métricas.',
  })
  @IsIn(ASSIGNABLE_MEMBER_ROLES)
  role!: AssignableMemberRole;
}

export class ChangeApiMemberRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_MEMBER_ROLES })
  @IsIn(ASSIGNABLE_MEMBER_ROLES)
  role!: AssignableMemberRole;
}

/** Datos para crear la cuenta al aceptar (solo si el email no tiene cuenta activa). */
export class AcceptApiInvitationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe tener mayúscula, minúscula y número',
  })
  password?: string;
}
