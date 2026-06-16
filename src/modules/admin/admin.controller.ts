import { Controller, Get, Post, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminDashboardQueryDto, SyncCloudbedsQueryDto } from './dto/admin-dashboard-query.dto';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private dashboardService: AdminDashboardService,
  ) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Estadísticas generales del sistema',
    description: 'Devuelve métricas agregadas (usuarios, propiedades, bookings, etc.) para el dashboard de administración. Solo accesible para usuarios con rol ADMIN.',
  })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Dashboard operativo (KPIs, forecast, disponibilidad)',
    description:
      'Centro de operaciones estilo PMS: llegadas, salidas, actividad del día, forecast 14 días, matriz de disponibilidad e intents Cloudbeds.',
  })
  getDashboard(@Query() query: AdminDashboardQueryDto) {
    return this.dashboardService.getDashboard(query);
  }

  @Post('dashboard/sync-cloudbeds')
  @ApiOperation({
    summary: 'Sincronizar disponibilidad Cloudbeds',
    description:
      'Consulta el motor público de Cloudbeds para la propiedad y persiste snapshot. Útil para contrastar con datos locales.',
  })
  syncCloudbeds(@Query() query: SyncCloudbedsQueryDto) {
    return this.dashboardService.syncCloudbeds(query.propertyId, query.date);
  }
}
