import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddAgendaNoteDto {
  @ApiProperty({ description: 'Texto de la nota de seguimiento', example: 'Llamé, le interesa el depto de Dean Funes. Volver a contactar el viernes.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim())
  body: string;
}
