import { IsNumber, Min, Max } from 'class-validator';

export class SetCommissionRateDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  rate: number;
}
