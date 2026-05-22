import { z } from 'zod';

const StringOrNumber = z.union([z.string(), z.number()]);

export const CloudbedsPrepareResponseSchema = z.object({
  success: z.boolean().optional(),
  reservation_id: StringOrNumber.optional().nullable(),
  enc_res_id: z.string().optional().nullable(),
  customer_id: StringOrNumber.optional().nullable(),
  status: z.string().optional().nullable(),
  statusMessage: z.string().optional().nullable(),
  statusCode: StringOrNumber.optional().nullable(),
  errorCode: z.unknown().optional().nullable(),
});

export type RawCloudbedsPrepareResponse = z.infer<typeof CloudbedsPrepareResponseSchema>;
