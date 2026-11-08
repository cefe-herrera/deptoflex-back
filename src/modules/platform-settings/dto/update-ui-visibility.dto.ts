import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/** Cambia la visibilidad de elementos de la interfaz. Solo se actualizan los campos enviados. */
export class UpdateUiVisibilityDto {
  /** Botón "Soporte Koli" (WhatsApp) del menú lateral. */
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  supportButton?: boolean;

  /** Chat del asistente (botón flotante y panel). */
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  assistantChat?: boolean;
}
