import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Listar roles del sistema',
    description: 'Devuelve todos los roles disponibles para asignación. Solo ADMIN.',
  })
  findAll() {
    return this.rolesService.findAll();
  }
}
