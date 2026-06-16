import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectCancellationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
