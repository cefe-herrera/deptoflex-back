import { IsIn, IsOptional, IsString } from 'class-validator';

export type FlexBookingStatusType = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export class UpdateFlexBookingDto {
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']) status?: FlexBookingStatusType;
  @IsOptional() @IsString() notes?: string;
}
