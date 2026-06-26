import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSettlementDto {
  /** Si se omite, liquida todos los embajadores con comisiones elegibles. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  professionalProfileIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
