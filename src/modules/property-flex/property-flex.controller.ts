import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe,
  Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PropertyFlexService } from './property-flex.service';
import { FlexPricingService } from './flex-pricing.service';
import { CreatePropertyFlexDto } from './dto/create-property-flex.dto';
import { UpdatePropertyFlexDto } from './dto/update-property-flex.dto';
import { QueryPropertyFlexDto } from './dto/query-property-flex.dto';
import { CreatePricingPlanDto } from './dto/create-pricing-plan.dto';
import { UpdatePricingPlanDto } from './dto/update-pricing-plan.dto';
import { MediaService } from '../media/media.service';
import { PresignUploadDto } from '../media/dto/presign-upload.dto';
import { ConfirmUploadDto } from '../media/dto/confirm-upload.dto';
import { UpdatePropertyFlexImageDto } from '../media/dto/update-property-flex-image.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Property Flex')
@ApiBearerAuth('access-token')
@Controller('property-flex')
export class PropertyFlexController {
  constructor(
    private propertyFlexService: PropertyFlexService,
    private flexPricingService: FlexPricingService,
    private mediaService: MediaService,
  ) {}

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Crear una propiedad flex',
    description: 'Registra una nueva propiedad flex (dpto, monoambiente, casa) para alquiler mensualizado. Solo ADMIN/OPERATOR.',
  })
  create(@Body() dto: CreatePropertyFlexDto) {
    return this.propertyFlexService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar propiedades flex',
    description: 'Devuelve propiedades flex paginadas con filtros por ciudad, tipo, habitaciones, precio máximo, etc.',
  })
  findAll(@Query() query: QueryPropertyFlexDto) {
    return this.propertyFlexService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener propiedad flex por ID',
    description: 'Devuelve el detalle de una propiedad flex incluyendo dirección, amenities e imágenes.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertyFlexService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Actualizar propiedad flex',
    description: 'Modifica datos de una propiedad flex existente. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePropertyFlexDto) {
    return this.propertyFlexService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar propiedad flex (soft delete)',
    description: 'Marca la propiedad flex como eliminada sin borrarla físicamente. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertyFlexService.softDelete(id);
  }

  @Get(':id/pricing-plans')
  @ApiOperation({ summary: 'Listar planes de precios de una propiedad flex' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  listPricingPlans(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.flexPricingService.listPlans(id, activeOnly === 'true');
  }

  @Get(':id/pricing-quote')
  @ApiOperation({ summary: 'Cotizar reserva flex según plan y duración' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'totalMonths', required: true, type: Number })
  @ApiQuery({ name: 'pricingPlanId', required: false, type: String })
  pricingQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('totalMonths') totalMonths: string,
    @Query('pricingPlanId') pricingPlanId?: string,
  ) {
    return this.flexPricingService.quote(id, +totalMonths, pricingPlanId);
  }

  @Post(':id/pricing-plans')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({ summary: 'Crear plan de precios para propiedad flex' })
  createPricingPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePricingPlanDto,
  ) {
    return this.flexPricingService.createPlan(id, dto);
  }

  @Patch(':id/pricing-plans/:planId')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({ summary: 'Actualizar plan de precios' })
  updatePricingPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdatePricingPlanDto,
  ) {
    return this.flexPricingService.updatePlan(id, planId, dto);
  }

  @Delete(':id/pricing-plans/:planId')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar plan de precios' })
  deletePricingPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planId', ParseUUIDPipe) planId: string,
  ) {
    return this.flexPricingService.deletePlan(id, planId);
  }

  @Get(':id/booked-periods')
  @ApiOperation({
    summary: 'Períodos ocupados de una propiedad flex',
    description: 'Devuelve reservas activas que solapan el rango indicado, para pintar el calendario.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'from', required: true, type: String, description: 'Inicio del rango (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: true, type: String, description: 'Fin del rango (YYYY-MM-DD)' })
  getBookedPeriods(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.propertyFlexService.getBookedPeriods(id, from, to);
  }

  @Get(':id/next-available')
  @ApiOperation({
    summary: 'Próxima fecha de ingreso disponible',
    description: 'Calcula el primer día disponible para una estadía de N meses según reservas activas.',
  })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Duración de la estadía (default: minMonths de la propiedad)' })
  getNextAvailable(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('months') months?: string,
  ) {
    const stayMonths = months != null && months !== '' ? Number(months) : undefined;
    return this.propertyFlexService.getNextAvailableFrom(id, stayMonths);
  }

  @Get(':id/availability')
  @ApiOperation({
    summary: 'Consultar disponibilidad de una propiedad flex',
    description: 'Verifica si la propiedad está disponible en el rango de fechas indicado.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Fecha de inicio (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'Fecha de fin (YYYY-MM-DD)' })
  checkAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.propertyFlexService.checkAvailability(id, startDate, endDate);
  }

  @Post(':id/amenities')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Agregar amenity a la propiedad flex',
    description: 'Asocia una amenity existente a la propiedad flex. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  addAmenity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amenityId', ParseUUIDPipe) amenityId: string,
  ) {
    return this.propertyFlexService.addAmenity(id, amenityId);
  }

  @Delete(':id/amenities/:amenityId')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Quitar amenity de la propiedad flex',
    description: 'Desasocia una amenity de la propiedad flex. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  removeAmenity(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('amenityId', ParseUUIDPipe) amenityId: string,
  ) {
    return this.propertyFlexService.removeAmenity(id, amenityId);
  }

  @Post(':id/images/presign')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Presign de subida de imagen de propiedad flex',
    description: 'Genera una URL prefirmada (R2/S3) para subir una imagen directamente desde el cliente.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  presignImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignUploadDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.mediaService.presignForPropertyFlex(id, dto, user.id);
  }

  @Post(':id/images/confirm')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Confirmar subida de imagen de propiedad flex',
    description: 'Confirma que la imagen fue subida y la registra en la galería de la propiedad flex.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  confirmImage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmUploadDto) {
    return this.mediaService.confirmForPropertyFlex(id, dto);
  }

  @Patch(':id/images/:imageId')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Actualizar imagen de propiedad flex',
    description: 'Permite marcar una imagen como principal o actualizar caption/orden.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiParam({ name: 'imageId', type: String, format: 'uuid' })
  updateImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdatePropertyFlexImageDto,
  ) {
    return this.mediaService.updatePropertyFlexImage(id, imageId, dto);
  }

  @Delete(':id/images/:imageId')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar imagen de propiedad flex',
    description: 'Elimina una imagen de la galería (DB y R2/S3).',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  deleteImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.mediaService.deletePropertyFlexImage(id, imageId);
  }
}
