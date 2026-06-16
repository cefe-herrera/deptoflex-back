import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRoleDto {
  @ApiProperty({ example: 2, description: 'ID del rol a asignar' })
  @IsInt()
  @Min(1)
  roleId: number;
}
