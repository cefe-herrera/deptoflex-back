import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AiSearchService } from './ai-search.service';
import { AiSearchQueryDto } from './dto/ai-search-query.dto';

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const ALLOWED_AUDIO_MIME = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
]);

@ApiTags('AI Search')
@ApiBearerAuth()
@Controller('ai-search')
@UseGuards(ThrottlerGuard)
export class AiSearchController {
  constructor(private readonly aiSearchService: AiSearchService) {}

  @Post('query')
  @Throttle({ global: { limit: 15, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Traduce una búsqueda en lenguaje natural a filtros del catálogo (requiere login)',
  })
  searchByText(@Body() dto: AiSearchQueryDto) {
    return this.aiSearchService.searchByText(dto.query);
  }

  @Post('audio')
  @Throttle({ global: { limit: 8, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Transcribe un audio y lo traduce a filtros del catálogo (requiere login)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { audio: { type: 'string', format: 'binary' } },
      required: ['audio'],
    },
  })
  @UseInterceptors(
    // Sin `storage`, multer guarda en memoria (file.buffer). No importar 'multer' directo:
    // no es dependencia declarada y con pnpm (Vercel) no se resuelve.
    FileInterceptor('audio', {
      limits: { fileSize: MAX_AUDIO_BYTES },
    }),
  )
  searchByAudio(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Subí un archivo de audio en el campo "audio".',
      );
    }
    const mime = (file.mimetype || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_AUDIO_MIME.has(mime)) {
      throw new BadRequestException('Formato de audio no soportado.');
    }
    return this.aiSearchService.searchByAudio(file.buffer, mime);
  }
}
