import {
  Controller, Get, Patch, Post, Body, Param, ParseUUIDPipe, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { UpdateProfessionalDto, AdminUpdateProfessionalDto } from './dto/update-professional.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('professionals')
export class ProfessionalsController {
  constructor(private professionalsService: ProfessionalsService) { }

  @Get('me')
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.professionalsService.findByUserId(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateProfessionalDto) {
    return this.professionalsService.update(user.id, dto);
  }

  @Get()
  @Roles('ADMIN', 'OPERATOR')
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.professionalsService.findAll(+page, +limit);
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERATOR')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  adminUpdate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateProfessionalDto) {
    return this.professionalsService.adminUpdate(id, dto);
  }

  @Post('me/request-ambassador')
  requestAmbassador(@CurrentUser() user: CurrentUserPayload) {
    return this.professionalsService.requestAmbassador(user.id);
  }

  @Post(':id/verify')
  @Roles('ADMIN')
  verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.verify(id);
  }

  @Post(':id/reject')
  @Roles('ADMIN')
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.reject(id);
  }

  @Post(':id/suspend')
  @Roles('ADMIN')
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.suspend(id);
  }
}
