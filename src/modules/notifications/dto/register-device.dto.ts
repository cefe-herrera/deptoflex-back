import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevicePlatform, DeviceProvider } from '@prisma/client';

export class RegisterDeviceDto {
  @ApiProperty({ enum: DevicePlatform, description: 'Plataforma del device', example: 'WEB' })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiProperty({ enum: DeviceProvider, description: 'Proveedor de push', example: 'WEBPUSH' })
  @IsEnum(DeviceProvider)
  provider: DeviceProvider;

  @ApiProperty({
    description:
      'Para FCM: el registration token devuelto por `getToken()` en el cliente. Para Web Push: el `subscription.endpoint` (URL).',
  })
  @IsString()
  token: string;

  @ApiPropertyOptional({ description: 'Solo Web Push: `subscription.endpoint`' })
  @IsOptional() @IsString()
  endpoint?: string;

  @ApiPropertyOptional({ description: 'Solo Web Push: `subscription.keys.p256dh`' })
  @IsOptional() @IsString()
  p256dh?: string;

  @ApiPropertyOptional({ description: 'Solo Web Push: `subscription.keys.auth`' })
  @IsOptional() @IsString()
  authKey?: string;

  @ApiPropertyOptional({ description: 'User-Agent del navegador/app (max 500 chars)', maxLength: 500 })
  @IsOptional() @IsString() @MaxLength(500)
  userAgent?: string;
}
