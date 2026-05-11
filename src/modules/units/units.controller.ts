import {
  Controller, Get, Post, Patch, Delete, Put, Body, Param, ParseUUIDPipe,
  Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { SetPricingRulesDto } from './dto/set-pricing-rules.dto';
import { MediaService } from '../media/media.service';
import { PresignUploadDto } from '../media/dto/presign-upload.dto';
import { ConfirmUploadDto } from '../media/dto/confirm-upload.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UnitStatus, RentalModality } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Units')
@ApiBearerAuth('access-token')
@Controller('units')
export class UnitsController {
  constructor(
    private unitsService: UnitsService,
    private mediaService: MediaService,
  ) { }

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Crear una unidad',
    description: 'Crea una unidad (departamento/habitación) asociada a una propiedad. Solo ADMIN/OPERATOR.',
  })
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar unidades',
    description: 'Devuelve unidades paginadas, con filtros opcionales por propiedad, estado y modalidad de alquiler.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'propertyId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'status', required: false, enum: UnitStatus })
  @ApiQuery({ name: 'rentalModality', required: false, enum: RentalModality })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('propertyId') propertyId?: string,
    @Query('status') status?: UnitStatus,
    @Query('rentalModality') rentalModality?: RentalModality,
  ) {
    return this.unitsService.findAll(+page, +limit, propertyId, status, rentalModality);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una unidad por ID',
    description: 'Devuelve el detalle de una unidad incluyendo amenities, imágenes y propiedad asociada.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.unitsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Actualizar unidad',
    description: 'Modifica datos de una unidad existente. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    return this.unitsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar unidad (soft delete)',
    description: 'Marca la unidad como eliminada sin borrarla físicamente. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.unitsService.softDelete(id);
  }

  @Get(':id/availability')
  @ApiOperation({
    summary: 'Disponibilidad de una unidad',
    description: 'Devuelve la disponibilidad de la unidad en el rango `from`/`to` (ISO date). Si no se especifica rango, devuelve la actual.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Fecha desde (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Fecha hasta (ISO 8601)' })
  getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.unitsService.getAvailability(id, from, to);
  }

  @Post(':id/availability')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Setear disponibilidad de una unidad',
    description: 'Define bloques de disponibilidad/bloqueo para la unidad. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  setAvailability(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetAvailabilityDto) {
    return this.unitsService.setAvailability(id, dto);
  }

  @Get(':id/rates')
  @ApiOperation({
    summary: 'Obtener reglas de pricing',
    description: 'Devuelve las reglas de precios y tarifas configuradas para la unidad.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  getRates(@Param('id', ParseUUIDPipe) id: string) {
    return this.unitsService.getRates(id);
  }

  @Put(':id/rates')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Setear reglas de pricing',
    description: 'Reemplaza las reglas de precios y tarifas de la unidad. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  setRates(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPricingRulesDto) {
    return this.unitsService.setRates(id, dto);
  }

  @Post(':id/amenities')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Agregar amenity a la unidad',
    description: 'Asocia una amenity existente a la unidad. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  addAmenity(@Param('id', ParseUUIDPipe) id: string, @Body('amenityId', ParseUUIDPipe) amenityId: string) {
    return this.unitsService.addAmenity(id, amenityId);
  }

  @Delete(':id/amenities/:amenityId')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Quitar amenity de la unidad',
    description: 'Desasocia una amenity de la unidad. Solo ADMIN/OPERATOR.',
  })
  removeAmenity(@Param('id', ParseUUIDPipe) id: string, @Param('amenityId', ParseUUIDPipe) amenityId: string) {
    return this.unitsService.removeAmenity(id, amenityId);
  }

  @Post(':id/images/presign')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Presign de subida de imagen de unidad',
    description: 'Genera una URL prefirmada (S3) para subir una imagen a la galería de la unidad.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  presignImage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PresignUploadDto, @CurrentUser() user: CurrentUserPayload) {
    return this.mediaService.presignForUnit(id, dto, user.id);
  }

  @Post(':id/images/confirm')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Confirmar subida de imagen de unidad',
    description: 'Confirma que la imagen fue subida correctamente y la registra en la galería de la unidad.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  confirmImage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmUploadDto) {
    return this.mediaService.confirmForUnit(id, dto);
  }

  @Delete(':id/images/:imageId')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar imagen de unidad',
    description: 'Elimina una imagen de la galería de la unidad (DB y S3).',
  })
  deleteImage(@Param('id', ParseUUIDPipe) id: string, @Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.mediaService.deleteUnitImage(id, imageId);
  }
}
