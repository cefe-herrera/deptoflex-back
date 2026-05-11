import { Controller, Get } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Commissions')
@ApiBearerAuth('access-token')
@Controller('commissions')
export class CommissionsController {
    constructor(private readonly commissionsService: CommissionsService) { }

    @Get()
    @ApiOperation({
        summary: 'Listar comisiones',
        description: 'Devuelve el listado de comisiones generadas por bookings/leads convertidos por profesionales y embajadores.',
    })
    findAll() {
        return this.commissionsService.findAll();
    }
}
