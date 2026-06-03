import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AgendaService } from './agenda.service';
import { CreateAgendaContactDto } from './dto/create-agenda-contact.dto';
import { UpdateAgendaContactDto } from './dto/update-agenda-contact.dto';
import { QueryAgendaContactDto } from './dto/query-agenda-contact.dto';
import { AddAgendaNoteDto } from './dto/add-agenda-note.dto';

@ApiTags('Agenda')
@ApiBearerAuth('access-token')
@Controller('agenda/contacts')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear contacto en la agenda',
    description: 'Crea un contacto en la agenda personal del usuario autenticado.',
  })
  create(@Body() dto: CreateAgendaContactDto, @CurrentUser() user: CurrentUserPayload) {
    return this.agenda.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar contactos de la agenda',
    description:
      'Devuelve los contactos del usuario autenticado, paginados. `sort=recent` para "Últimos contactos", `sort=alpha` para A-Z. Soporta `search` por nombre/apellido/teléfono/email.',
  })
  findAll(@Query() query: QueryAgendaContactDto, @CurrentUser() user: CurrentUserPayload) {
    return this.agenda.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener contacto por ID',
    description: 'Devuelve el detalle del contacto con sus notas de seguimiento.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.agenda.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar contacto' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgendaContactDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.agenda.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar contacto (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.agenda.softDelete(user.id, id);
  }

  @Post(':id/contacted')
  @ApiOperation({
    summary: 'Marcar contacto como contactado',
    description: 'Actualiza `lastContactedAt` a ahora. Llamar al iniciar una llamada/WhatsApp.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  markContacted(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.agenda.markContacted(user.id, id);
  }

  // ── Notas de seguimiento ────────────────────────────────────────────────

  @Post(':id/notes')
  @ApiOperation({
    summary: 'Agregar nota de seguimiento',
    description: 'Agrega una nota al contacto y actualiza su último contacto. Útil para hacer seguimiento.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddAgendaNoteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.agenda.addNote(user.id, id, dto, user.id);
  }

  @Get(':id/notes')
  @ApiOperation({ summary: 'Listar notas de seguimiento del contacto' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  listNotes(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.agenda.listNotes(user.id, id);
  }

  @Delete('notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una nota de seguimiento' })
  @ApiParam({ name: 'noteId', type: String, format: 'uuid' })
  deleteNote(@Param('noteId', ParseUUIDPipe) noteId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.agenda.deleteNote(user.id, noteId);
  }
}
