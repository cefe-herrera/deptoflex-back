import {
    BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus,
    Param, ParseUUIDPipe, Patch, Post, Put, Query,
} from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { CommissionRatesService } from './commission-rates.service';
import { SetCommissionRateDto } from './dto/set-commission-rate.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Commissions')
@ApiBearerAuth('access-token')
@Controller()
export class CommissionsController {
    constructor(
        private readonly commissionsService: CommissionsService,
        private readonly commissionRatesService: CommissionRatesService,
    ) { }

    @Get('commissions')
    @Roles('ADMIN', 'OPERATOR')
    @ApiOperation({
        summary: 'Listar comisiones',
        description: 'Devuelve el listado de comisiones generadas por bookings/leads convertidos por profesionales y embajadores.',
    })
    findAll() {
        return this.commissionsService.findAll();
    }

    @Get('commission-rates/overview')
    @Roles('ADMIN', 'OPERATOR')
    @ApiOperation({
        summary: 'Resumen de tasas de comisión',
        description: 'Lista propiedades flex, embajadores y overrides embajador×propiedad para gestión de comisiones.',
    })
    getOverview() {
        return this.commissionRatesService.getOverview();
    }

    @Get('commission-rates/flex-preview/:propertyFlexId')
    @Roles('ADMIN', 'OPERATOR', 'AMBASSADOR')
    @ApiOperation({
        summary: 'Vista previa de comisión flex',
        description: 'Calcula la comisión estimada para el embajador autenticado según las tasas vigentes y el monto total de la reserva.',
    })
    @ApiParam({ name: 'propertyFlexId', type: String, format: 'uuid' })
    @ApiQuery({ name: 'totalAmount', required: true, type: Number })
    previewFlex(
        @Param('propertyFlexId', ParseUUIDPipe) propertyFlexId: string,
        @Query('totalAmount') totalAmountRaw: string,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        const totalAmount = Number(totalAmountRaw);
        if (!totalAmountRaw || Number.isNaN(totalAmount) || totalAmount < 0) {
            throw new BadRequestException('totalAmount must be a non-negative number');
        }
        return this.commissionRatesService.previewFlexCommissionForUser(propertyFlexId, totalAmount, user);
    }

    @Post('commission-rates/recalculate')
    @HttpCode(HttpStatus.OK)
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Recalcular comisiones flex pendientes',
        description: 'Vuelve a calcular rate y monto de todas las comisiones PENDING de reservas flex según las tasas vigentes.',
    })
    recalculateAll() {
        return this.commissionRatesService.recalculateAllPendingFlex();
    }

    @Patch('commission-rates/flex-property/:propertyFlexId')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Tasa de comisión por propiedad flex',
        description: 'Define el porcentaje de comisión por defecto para una propiedad flex. Recalcula comisiones pendientes.',
    })
    @ApiParam({ name: 'propertyFlexId', type: String, format: 'uuid' })
    setPropertyRate(
        @Param('propertyFlexId', ParseUUIDPipe) propertyFlexId: string,
        @Body() dto: SetCommissionRateDto,
    ) {
        return this.commissionRatesService.setPropertyFlexRate(propertyFlexId, dto.rate);
    }

    @Put('commission-rates/flex-property/:propertyFlexId/ambassador/:profileId')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Override embajador × propiedad flex',
        description: 'Define un porcentaje específico para un embajador en una propiedad flex. Tiene prioridad sobre tasas por propiedad y por embajador.',
    })
    upsertOverride(
        @Param('propertyFlexId', ParseUUIDPipe) propertyFlexId: string,
        @Param('profileId', ParseUUIDPipe) profileId: string,
        @Body() dto: SetCommissionRateDto,
    ) {
        return this.commissionRatesService.upsertAmbassadorOverride(propertyFlexId, profileId, dto.rate);
    }

    @Delete('commission-rates/flex-property/:propertyFlexId/ambassador/:profileId')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Eliminar override embajador × propiedad',
        description: 'Quita el porcentaje específico; vuelve a aplicar tasa de propiedad o default del embajador.',
    })
    deleteOverride(
        @Param('propertyFlexId', ParseUUIDPipe) propertyFlexId: string,
        @Param('profileId', ParseUUIDPipe) profileId: string,
    ) {
        return this.commissionRatesService.deleteAmbassadorOverride(propertyFlexId, profileId);
    }
}
