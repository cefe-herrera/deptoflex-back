import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Estadísticas generales del sistema',
    description: 'Devuelve métricas agregadas (usuarios, propiedades, bookings, etc.) para el dashboard de administración. Solo accesible para usuarios con rol ADMIN.',
  })
  getStats() {
    return this.adminService.getStats();
  }
}
