import { IsUUID, IsOptional, IsBoolean, IsString, IsInt, Min, MaxLength } from 'class-validator';

export class ConfirmUploadDto {
  @IsUUID() mediaFileId: string;
  @IsOptional() @IsString() @MaxLength(255) caption?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
