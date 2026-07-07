import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendInvitationDto {
  @ApiProperty({ example: 'nuevo@ejemplo.com', description: 'Email del invitado' })
  @IsEmail({}, { message: 'Ingresá un email válido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}
