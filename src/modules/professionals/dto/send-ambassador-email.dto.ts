import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MaxLength } from 'class-validator';

export class SendAmbassadorEmailDto {
  @ApiProperty({ example: 'Documentación pendiente', maxLength: 200 })
  @IsString()
  @Length(1, 200)
  subject: string;

  @ApiProperty({
    example: 'Hola, necesitamos que completes la documentación para poder habilitar tus liquidaciones.',
    maxLength: 5000,
  })
  @IsString()
  @MaxLength(5000)
  message: string;
}
