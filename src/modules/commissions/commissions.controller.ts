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
        description: 'Calcula la comisión estimada para el embajador autenticado según las tasas vigentes y el alquiler del primer mes.',
    })
    @ApiParam({ name: 'propertyFlexId', type: String, format: 'uuid' })
    @ApiQuery({ name: 'monthlyAmount', required: true, type: Number })
    previewFlex(
        @Param('propertyFlexId', ParseUUIDPipe) propertyFlexId: string,
        @Query('monthlyAmount') monthlyAmountRaw: string,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        const monthlyAmount = Number(monthlyAmountRaw);
        if (!monthlyAmountRaw || Number.isNaN(monthlyAmount) || monthlyAmount < 0) {
            throw new BadRequestException('monthlyAmount must be a non-negative number');
        }
        return this.commissionRatesService.previewFlexCommissionForUser(propertyFlexId, monthlyAmount, user);
    }

    @Post('commission-rates/recalculate')
    @HttpCode(HttpStatus.OK)
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Recalcular comisiones flex pendientes',
        description: 'Vuelve a calcular rate y monto de todas las comisiones PENDING de reservas flex según las tasas vigentes.',
    })
    recalculateAll() {
        return this.commissionRatesService.recalculateAllPending();
    }

    @Get('commission-rates/temporal-preview/:propertyId')
    @Roles('ADMIN', 'OPERATOR', 'AMBASSADOR')
    @ApiOperation({
        summary: 'Vista previa de comisión temporal',
        description: 'Calcula la comisión estimada para el embajador autenticado en una propiedad temporal (Cloudbeds).',
    })
    @ApiParam({ name: 'propertyId', type: String, format: 'uuid' })
    @ApiQuery({ name: 'totalAmount', required: true, type: Number })
    previewTemporal(
        @Param('propertyId', ParseUUIDPipe) propertyId: string,
        @Query('totalAmount') totalAmountRaw: string,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        const totalAmount = Number(totalAmountRaw);
        if (!totalAmountRaw || Number.isNaN(totalAmount) || totalAmount < 0) {
            throw new BadRequestException('totalAmount must be a non-negative number');
        }
        return this.commissionRatesService.previewTemporalCommissionForUser(propertyId, totalAmount, user);
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

    @Patch('commission-rates/temporal-property/:propertyId')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Tasa de comisión por propiedad temporal',
        description: 'Define el porcentaje de comisión por defecto para una propiedad temporal. Recalcula comisiones pendientes.',
    })
    @ApiParam({ name: 'propertyId', type: String, format: 'uuid' })
    setTemporalPropertyRate(
        @Param('propertyId', ParseUUIDPipe) propertyId: string,
        @Body() dto: SetCommissionRateDto,
    ) {
        return this.commissionRatesService.setPropertyTemporalRate(propertyId, dto.rate);
    }

    @Put('commission-rates/temporal-property/:propertyId/ambassador/:profileId')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Override embajador × propiedad temporal',
        description: 'Define un porcentaje específico para un embajador en una propiedad temporal.',
    })
    upsertTemporalOverride(
        @Param('propertyId', ParseUUIDPipe) propertyId: string,
        @Param('profileId', ParseUUIDPipe) profileId: string,
        @Body() dto: SetCommissionRateDto,
    ) {
        return this.commissionRatesService.upsertAmbassadorPropertyOverride(propertyId, profileId, dto.rate);
    }

    @Delete('commission-rates/temporal-property/:propertyId/ambassador/:profileId')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Eliminar override embajador × propiedad temporal',
    })
    deleteTemporalOverride(
        @Param('propertyId', ParseUUIDPipe) propertyId: string,
        @Param('profileId', ParseUUIDPipe) profileId: string,
    ) {
        return this.commissionRatesService.deleteAmbassadorPropertyOverride(propertyId, profileId);
    }
}
