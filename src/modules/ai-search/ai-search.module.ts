import { Module } from '@nestjs/common';
import { AiSearchController } from './ai-search.controller';
import { AiSearchService } from './ai-search.service';
import { GeminiAiProvider } from './gemini-ai.provider';

@Module({
  controllers: [AiSearchController],
  providers: [AiSearchService, GeminiAiProvider],
  exports: [AiSearchService],
})
export class AiSearchModule {}
