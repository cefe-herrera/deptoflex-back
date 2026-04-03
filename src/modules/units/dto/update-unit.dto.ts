import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { UnitStatus } from '@prisma/client';
import { CreateUnitDto } from './create-unit.dto';

export class UpdateUnitDto extends PartialType(CreateUnitDto) {
  @IsOptional() @IsEnum(UnitStatus) status?: UnitStatus;
}
