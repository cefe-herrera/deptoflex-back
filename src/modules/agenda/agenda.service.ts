import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgendaContactDto } from './dto/create-agenda-contact.dto';
import { UpdateAgendaContactDto } from './dto/update-agenda-contact.dto';
import { AddAgendaNoteDto } from './dto/add-agenda-note.dto';
import { AgendaContactSort, QueryAgendaContactDto } from './dto/query-agenda-contact.dto';

@Injectable()
export class AgendaService {
  constructor(private prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateAgendaContactDto) {
    return this.prisma.agendaContact.create({
      data: {
        ownerId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        company: dto.company,
        avatarColor: dto.avatarColor,
        lastContactedAt: dto.lastContactedAt ? new Date(dto.lastContactedAt) : null,
      },
    });
  }

  async findAll(ownerId: string, query: QueryAgendaContactDto) {
    const { page = 1, limit = 20, search, sort = AgendaContactSort.ALPHA } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AgendaContactWhereInput = {
      ownerId,
      deletedAt: null,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.AgendaContactOrderByWithRelationInput[] =
      sort === AgendaContactSort.RECENT
        ? [{ lastContactedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
        : [{ firstName: 'asc' }, { lastName: 'asc' }];

    const [items, total] = await Promise.all([
      this.prisma.agendaContact.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.agendaContact.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(ownerId: string, id: string) {
    const contact = await this.prisma.agendaContact.findFirst({
      where: { id, ownerId, deletedAt: null },
      include: {
        agendaNotes: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!contact) throw new NotFoundException('Agenda contact not found');
    return contact;
  }

  async update(ownerId: string, id: string, dto: UpdateAgendaContactDto) {
    await this.findOne(ownerId, id);
    return this.prisma.agendaContact.update({
      where: { id },
      data: {
        ...dto,
        lastContactedAt: dto.lastContactedAt ? new Date(dto.lastContactedAt) : undefined,
      },
    });
  }

  async softDelete(ownerId: string, id: string) {
    await this.findOne(ownerId, id);
    await this.prisma.agendaContact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Marca un contacto como contactado ahora (al llamar/WhatsApp). */
  async markContacted(ownerId: string, id: string) {
    await this.findOne(ownerId, id);
    return this.prisma.agendaContact.update({
      where: { id },
      data: { lastContactedAt: new Date() },
    });
  }

  // ── Notas de seguimiento ────────────────────────────────────────────────

  /** Agrega una nota y actualiza el último contacto del contacto. */
  async addNote(ownerId: string, contactId: string, dto: AddAgendaNoteDto, createdById: string) {
    await this.findOne(ownerId, contactId);
    const [note] = await this.prisma.$transaction([
      this.prisma.agendaNote.create({
        data: { contactId, createdById, body: dto.body },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.agendaContact.update({
        where: { id: contactId },
        data: { lastContactedAt: new Date() },
      }),
    ]);
    return note;
  }

  async listNotes(ownerId: string, contactId: string) {
    await this.findOne(ownerId, contactId);
    return this.prisma.agendaNote.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async deleteNote(ownerId: string, noteId: string) {
    const note = await this.prisma.agendaNote.findFirst({
      where: { id: noteId, contact: { ownerId, deletedAt: null } },
    });
    if (!note) throw new NotFoundException('Agenda note not found');
    await this.prisma.agendaNote.delete({ where: { id: noteId } });
  }
}
