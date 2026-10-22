import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, ValidateIf } from 'class-validator';

export class UpdateBookingPolicyDto {
  /** `null` elimina el override del admin y vuelve al default de BOOKINGS_REQUIRE_APPROVED_AMBASSADOR. */
  @ApiProperty({ type: Boolean, nullable: true })
  @ValidateIf((_o, v) => v !== null)
  @IsBoolean()
  requireApprovedAmbassador!: boolean | null;
}
