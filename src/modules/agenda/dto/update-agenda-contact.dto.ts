import { PartialType } from '@nestjs/swagger';
import { CreateAgendaContactDto } from './create-agenda-contact.dto';

export class UpdateAgendaContactDto extends PartialType(CreateAgendaContactDto) {}
