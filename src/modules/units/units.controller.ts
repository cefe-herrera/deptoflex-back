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

@Controller('units')
export class UnitsController {
  constructor(
    private unitsService: UnitsService,
    private mediaService: MediaService,
  ) { }

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Get()
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
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.unitsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    return this.unitsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.unitsService.softDelete(id);
  }

  @Get(':id/availability')
  getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.unitsService.getAvailability(id, from, to);
  }

  @Post(':id/availability')
  @Roles('ADMIN', 'OPERATOR')
  setAvailability(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetAvailabilityDto) {
    return this.unitsService.setAvailability(id, dto);
  }

  @Get(':id/rates')
  getRates(@Param('id', ParseUUIDPipe) id: string) {
    return this.unitsService.getRates(id);
  }

  @Put(':id/rates')
  @Roles('ADMIN', 'OPERATOR')
  setRates(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPricingRulesDto) {
    return this.unitsService.setRates(id, dto);
  }

  @Post(':id/amenities')
  @Roles('ADMIN', 'OPERATOR')
  addAmenity(@Param('id', ParseUUIDPipe) id: string, @Body('amenityId', ParseUUIDPipe) amenityId: string) {
    return this.unitsService.addAmenity(id, amenityId);
  }

  @Delete(':id/amenities/:amenityId')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAmenity(@Param('id', ParseUUIDPipe) id: string, @Param('amenityId', ParseUUIDPipe) amenityId: string) {
    return this.unitsService.removeAmenity(id, amenityId);
  }

  @Post(':id/images/presign')
  @Roles('ADMIN', 'OPERATOR')
  presignImage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PresignUploadDto, @CurrentUser() user: CurrentUserPayload) {
    return this.mediaService.presignForUnit(id, dto, user.id);
  }

  @Post(':id/images/confirm')
  @Roles('ADMIN', 'OPERATOR')
  confirmImage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmUploadDto) {
    return this.mediaService.confirmForUnit(id, dto);
  }

  @Delete(':id/images/:imageId')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteImage(@Param('id', ParseUUIDPipe) id: string, @Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.mediaService.deleteUnitImage(id, imageId);
  }
}
