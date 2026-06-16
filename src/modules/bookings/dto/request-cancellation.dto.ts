import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestCancellationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
