import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe,
  Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { MediaService } from '../media/media.service';
import { PresignUploadDto } from '../media/dto/presign-upload.dto';
import { ConfirmUploadDto } from '../media/dto/confirm-upload.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Properties')
@ApiBearerAuth('access-token')
@Controller('properties')
export class PropertiesController {
  constructor(
    private propertiesService: PropertiesService,
    private mediaService: MediaService,
  ) { }

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Crear una propiedad',
    description: 'Registra una nueva propiedad (edificio/complejo) que luego puede contener unidades. Solo ADMIN/OPERATOR.',
  })
  create(@Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar propiedades',
    description: 'Devuelve propiedades paginadas con filtros por ubicación, amenities, precio, etc. (ver `QueryPropertiesDto`).',
  })
  findAll(@Query() query: QueryPropertiesDto) {
    return this.propertiesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener propiedad por ID',
    description: 'Devuelve el detalle de una propiedad incluyendo unidades, amenities e imágenes.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Actualizar propiedad',
    description: 'Modifica datos de una propiedad existente. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePropertyDto) {
    return this.propertiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar propiedad (soft delete)',
    description: 'Marca la propiedad como eliminada sin borrarla físicamente. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.softDelete(id);
  }

  @Post(':id/amenities')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Agregar amenity a la propiedad',
    description: 'Asocia una amenity existente a la propiedad indicada. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  addAmenity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amenityId', ParseUUIDPipe) amenityId: string,
  ) {
    return this.propertiesService.addAmenity(id, amenityId);
  }

  @Delete(':id/amenities/:amenityId')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Quitar amenity de la propiedad',
    description: 'Desasocia una amenity de la propiedad. Solo ADMIN/OPERATOR.',
  })
  removeAmenity(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('amenityId', ParseUUIDPipe) amenityId: string,
  ) {
    return this.propertiesService.removeAmenity(id, amenityId);
  }

  @Post(':id/images/presign')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Presign de subida de imagen de propiedad',
    description: 'Genera una URL prefirmada (S3) para subir una imagen de la propiedad directamente desde el cliente.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  presignImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignUploadDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.mediaService.presignForProperty(id, dto, user.id);
  }

  @Post(':id/images/confirm')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Confirmar subida de imagen de propiedad',
    description: 'Confirma que la imagen fue subida correctamente y la registra en la galería de la propiedad.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  confirmImage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmUploadDto) {
    return this.mediaService.confirmForProperty(id, dto);
  }

  @Delete(':id/images/:imageId')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar imagen de propiedad',
    description: 'Elimina una imagen de la galería de la propiedad (tanto en DB como en S3).',
  })
  deleteImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.mediaService.deletePropertyImage(id, imageId);
  }
}
