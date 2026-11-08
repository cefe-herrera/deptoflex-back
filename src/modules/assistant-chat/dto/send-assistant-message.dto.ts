import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Botón de una tarjeta del carrusel ("Más info", "Me interesa"). */
export class CarouselSelectionDto {
  /** id del mensaje del carrusel en WeSpeak. */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  messageId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  buttonId!: string;

  @IsInt()
  @Min(0)
  @Max(9)
  cardIndex!: number;
}

/** Opción elegida entre los complejos que ofrece el asistente. */
export class HotelSelectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  messageId!: string;

  @Matches(/^hotel-\d{1,2}$/)
  optionId!: string;
}

export class SendAssistantMessageDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;

  /** UUID generado por el cliente; se reusa al reintentar para que WeSpeak no duplique el mensaje. */
  @IsUUID()
  clientMsgId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CarouselSelectionDto)
  selection?: CarouselSelectionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HotelSelectionDto)
  hotelSelection?: HotelSelectionDto;
}
