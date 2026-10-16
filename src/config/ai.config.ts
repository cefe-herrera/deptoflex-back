import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  provider: (process.env.AI_PROVIDER ?? 'gemini').trim(),
  apiKey: (process.env.AI_API_KEY ?? '').trim(),
  model: (process.env.AI_MODEL ?? 'gemini-3.5-flash-lite').trim(),
}));
