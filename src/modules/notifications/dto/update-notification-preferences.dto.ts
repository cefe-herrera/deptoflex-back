import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  promosEnabled?: boolean;

  /** Reservado — WhatsApp aún no implementado; el backend ignora cambios a true. */
  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;
}
