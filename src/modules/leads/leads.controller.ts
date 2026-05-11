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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Leads')
@ApiBearerAuth('access-token')
@Controller('leads')
export class LeadsController {
  constructor(
    private leadsService: LeadsService,
    private prisma: PrismaService,
  ) { }

  @Post()
  @Roles('ADMIN', 'OPERATOR', 'PROFESSIONAL', 'AMBASSADOR')
  @ApiOperation({
    summary: 'Crear un lead',
    description: 'Registra un nuevo lead (prospecto interesado). Si el usuario actual tiene perfil profesional, queda asociado automáticamente como referente.',
  })
  async create(@Body() dto: CreateLeadDto, @CurrentUser() user: CurrentUserPayload) {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId: user.id } });
    return this.leadsService.create(dto, profile?.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar leads',
    description: 'Devuelve los leads paginados. ADMIN/OPERATOR ven todos; profesionales y embajadores ven solo los propios.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.findAll(+page, +limit, user.id, user.roles);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un lead por ID',
    description: 'Devuelve el detalle completo del lead, incluyendo notas y conversiones a booking.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un lead',
    description: 'Modifica datos del lead (estado, contacto, observaciones, etc.).',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar un lead (soft delete)',
    description: 'Marca el lead como eliminado sin borrarlo físicamente. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.softDelete(id);
  }

  @Post(':id/notes')
  @ApiOperation({
    summary: 'Agregar una nota al lead',
    description: 'Agrega una nota interna al lead, registrando el autor (usuario actual). Útil para tracking de seguimiento.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.addNote(id, dto, user.id);
  }

  @Post(':id/convert-to-booking')
  @ApiOperation({
    summary: 'Convertir lead a reserva',
    description: 'Crea una reserva a partir del lead y dispara el cálculo de comisiones para el referente. El lead queda marcado como convertido.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  convertToBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertToBookingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.convertToBooking(id, dto, user.id);
  }
}
