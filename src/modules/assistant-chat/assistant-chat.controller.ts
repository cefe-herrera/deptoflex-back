import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { AssistantChatService } from './assistant-chat.service';
import { SendAssistantMessageDto } from './dto/send-assistant-message.dto';

@ApiTags('Assistant Chat')
@ApiBearerAuth()
@Controller('assistant-chat')
@UseGuards(ThrottlerGuard)
export class AssistantChatController {
  constructor(private readonly chat: AssistantChatService) {}

  @Get()
  @Throttle({ global: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Últimos mensajes con el asistente; trae respuestas nuevas de WeSpeak (requiere login)',
  })
  @ApiQuery({
    name: 'sync',
    required: false,
    description:
      '1 = llegó un evento en tiempo real: consultar WeSpeak ya (intervalo mínimo más corto)',
  })
  getState(
    @CurrentUser() user: CurrentUserPayload,
    @Query('sync') sync?: string,
  ) {
    return this.chat.run(user.id, () =>
      this.chat.getState(user.id, sync === '1' || sync === 'true'),
    );
  }

  @Get('history')
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Mensajes anteriores a uno dado, del mismo hilo (requiere login)',
  })
  @ApiQuery({
    name: 'before',
    description: 'id del mensaje más viejo que ya tiene el cliente',
  })
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query('before', new ParseUUIDPipe()) before: string,
  ) {
    return this.chat.getHistory(user.id, before);
  }

  @Post('messages')
  @Throttle({ global: { limit: 12, ttl: 60_000 } })
  @ApiOperation({ summary: 'Envía un mensaje al asistente (requiere login)' })
  send(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SendAssistantMessageDto,
  ) {
    return this.chat.run(user.id, () =>
      this.chat.sendMessage(user.id, dto.text, dto.clientMsgId, {
        selection: dto.selection,
        hotelSelection: dto.hotelSelection,
      }),
    );
  }

  @Post('threads')
  @Throttle({ global: { limit: 6, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Empieza una conversación nueva; la anterior queda guardada (requiere login)',
  })
  newThread(@CurrentUser() user: CurrentUserPayload) {
    return this.chat.run(user.id, () => this.chat.startNewThread(user.id));
  }
}
