import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum AgendaContactSort {
  RECENT = 'recent',
  ALPHA = 'alpha',
}

export class QueryAgendaContactDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Busca por nombre, apellido, teléfono o email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: AgendaContactSort,
    default: AgendaContactSort.ALPHA,
    description: '`recent` = por último contacto (para "Últimos contactos"); `alpha` = A-Z',
  })
  @IsOptional()
  @IsEnum(AgendaContactSort)
  sort?: AgendaContactSort = AgendaContactSort.ALPHA;
}
