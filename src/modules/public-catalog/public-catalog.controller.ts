import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PublicCatalogService } from './public-catalog.service';

@ApiTags('Public Catalog')
@Controller('public')
export class PublicCatalogController {
  constructor(private readonly publicCatalogService: PublicCatalogService) {}

  @Public()
  @Get('flex/:id')
  @ApiOperation({ summary: 'Vista pública de propiedad flex (solo lectura)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findFlex(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicCatalogService.findFlex(id);
  }

  @Public()
  @Get('properties/:id')
  @ApiOperation({ summary: 'Vista pública de propiedad temporal (solo lectura)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findProperty(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicCatalogService.findProperty(id);
  }

  @Public()
  @Get('units/:id')
  @ApiOperation({ summary: 'Vista pública de unidad temporal (solo lectura)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findUnit(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicCatalogService.findUnit(id);
  }
}
