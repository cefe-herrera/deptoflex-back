import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class ConfirmReservationDto {
  @ApiProperty({
    description: 'Token opaco `data_res` devuelto por Cloudbeds en la URL de confirmación.',
  })
  @IsString()
  @Length(1, 4000)
  dataRes: string;

  @ApiPropertyOptional({
    description:
      'Reservation intent originada en nuestro sistema. Si se provee, se usa para resolver propiedad, embajador y fechas canónicas.',
  })
  @IsOptional()
  @IsUUID()
  reservationIntentId?: string;

  @ApiPropertyOptional({
    description:
      'Embajador (professional profile) al que se atribuye la reserva y la comisión. Tiene prioridad sobre el de la intent.',
  })
  @IsOptional()
  @IsUUID()
  professionalProfileId?: string;
}
