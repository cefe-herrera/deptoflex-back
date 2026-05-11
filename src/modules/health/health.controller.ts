import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, MemoryHealthIndicator } from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private memory: MemoryHealthIndicator,
    ) { }

    @Get()
    @HealthCheck()
    @ApiOperation({
        summary: 'Health check del servicio',
        description: 'Verifica que el servicio esté operativo y dentro de los límites de memoria. Útil para load balancers, uptime monitors y orquestadores.',
    })
    check() {
        return this.health.check([
            () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
        ]);
    }
}
