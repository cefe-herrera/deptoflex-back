import { UnitStatus } from '@prisma/client';
import { CreateUnitDto } from './create-unit.dto';
declare const UpdateUnitDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateUnitDto>>;
export declare class UpdateUnitDto extends UpdateUnitDto_base {
    status?: UnitStatus;
}
export {};
