import { IsString, IsIn, IsInt, Min, Max, MaxLength } from 'class-validator';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export class PresignUploadDto {
  @IsString() @MaxLength(255) filename: string;
  @IsString() @IsIn(ALLOWED_MIME_TYPES) contentType: string;
  @IsInt() @Min(1) @Max(MAX_FILE_SIZE) fileSize: number;
}
