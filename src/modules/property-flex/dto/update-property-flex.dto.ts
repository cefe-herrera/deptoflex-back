import { PartialType } from '@nestjs/mapped-types';
import { CreatePropertyFlexDto } from './create-property-flex.dto';

export class UpdatePropertyFlexDto extends PartialType(CreatePropertyFlexDto) {}
