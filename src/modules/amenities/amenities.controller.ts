import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Amenities')
@ApiBearerAuth('access-token')
@Controller('amenities')
export class AmenitiesController {
  constructor(private amenitiesService: AmenitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar todas las amenities',
    description: 'Devuelve el catálogo completo de amenities disponibles para asociar a propiedades y unidades (ej: pileta, wifi, cochera).',
  })
  findAll() {
    return this.amenitiesService.findAll();
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Crear una amenity',
    description: 'Agrega una nueva amenity al catálogo. Solo ADMIN.',
  })
  create(@Body() dto: CreateAmenityDto) {
    return this.amenitiesService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Actualizar una amenity',
    description: 'Modifica los datos de una amenity existente. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateAmenityDto>) {
    return this.amenitiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar una amenity',
    description: 'Elimina una amenity del catálogo. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.amenitiesService.remove(id);
  }
}
