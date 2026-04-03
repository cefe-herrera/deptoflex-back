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

@Controller('properties')
export class PropertiesController {
  constructor(
    private propertiesService: PropertiesService,
    private mediaService: MediaService,
  ) { }

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  create(@Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryPropertiesDto) {
    return this.propertiesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePropertyDto) {
    return this.propertiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.softDelete(id);
  }

  @Post(':id/amenities')
  @Roles('ADMIN', 'OPERATOR')
  addAmenity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amenityId', ParseUUIDPipe) amenityId: string,
  ) {
    return this.propertiesService.addAmenity(id, amenityId);
  }

  @Delete(':id/amenities/:amenityId')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAmenity(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('amenityId', ParseUUIDPipe) amenityId: string,
  ) {
    return this.propertiesService.removeAmenity(id, amenityId);
  }

  @Post(':id/images/presign')
  @Roles('ADMIN', 'OPERATOR')
  presignImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignUploadDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.mediaService.presignForProperty(id, dto, user.id);
  }

  @Post(':id/images/confirm')
  @Roles('ADMIN', 'OPERATOR')
  confirmImage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmUploadDto) {
    return this.mediaService.confirmForProperty(id, dto);
  }

  @Delete(':id/images/:imageId')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.mediaService.deletePropertyImage(id, imageId);
  }
}
