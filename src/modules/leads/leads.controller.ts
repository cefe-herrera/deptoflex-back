import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe,
  Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ConvertToBookingDto } from './dto/convert-to-booking.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('leads')
export class LeadsController {
  constructor(
    private leadsService: LeadsService,
    private prisma: PrismaService,
  ) { }

  @Post()
  @Roles('ADMIN', 'OPERATOR', 'PROFESSIONAL', 'AMBASSADOR')
  async create(@Body() dto: CreateLeadDto, @CurrentUser() user: CurrentUserPayload) {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId: user.id } });
    return this.leadsService.create(dto, profile?.id);
  }

  @Get()
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.findAll(+page, +limit, user.id, user.roles);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.softDelete(id);
  }

  @Post(':id/notes')
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.addNote(id, dto, user.id);
  }

  @Post(':id/convert-to-booking')
  convertToBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertToBookingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.convertToBooking(id, dto, user.id);
  }
}
