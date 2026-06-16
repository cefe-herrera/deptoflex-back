import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PublicCatalogService } from './public-catalog.service';
import {
  QueryPublicFlexListDto,
  QueryPublicPropertiesListDto,
  QueryPublicUnitsListDto,
} from './dto/query-public-list.dto';

@ApiTags('Public Catalog')
@Controller('public')
export class PublicCatalogController {
  constructor(private readonly publicCatalogService: PublicCatalogService) {}

  @Public()
  @Get('flex')
  @ApiOperation({ summary: 'Listar propiedades flex activas (solo lectura, sin auth)' })
  listFlex(@Query() query: QueryPublicFlexListDto) {
    return this.publicCatalogService.listFlex(query);
  }

  @Public()
  @Get('properties')
  @ApiOperation({ summary: 'Listar propiedades temporales activas (solo lectura, sin auth)' })
  listProperties(@Query() query: QueryPublicPropertiesListDto) {
    return this.publicCatalogService.listProperties(query);
  }

  @Public()
  @Get('units')
  @ApiOperation({ summary: 'Listar unidades activas (solo lectura, sin auth)' })
  listUnits(@Query() query: QueryPublicUnitsListDto) {
    return this.publicCatalogService.listUnits(query);
  }

  @Public()
  @Get('flex/:id/next-available')
  @ApiOperation({ summary: 'Próxima fecha de ingreso disponible (público)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'months', required: false, type: Number })
  flexNextAvailable(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('months') months?: string,
  ) {
    const stayMonths = months != null && months !== '' ? Number(months) : undefined;
    return this.publicCatalogService.getFlexNextAvailable(id, stayMonths);
  }

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
