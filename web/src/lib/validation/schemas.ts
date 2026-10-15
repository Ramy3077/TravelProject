import { z } from 'zod';
import { nightsBetween } from '@/lib/engine/date';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NIGHTS = 30;

export const tierSchema = z.enum(['budget', 'balanced', 'comfort']);

/** Base shape (a ZodObject, so it can be `.extend()`-ed for the afford schema). */
export const estimateInputObject = z.object({
  originCityId: z.string().min(1).max(32),
  destinationCityId: z.string().min(1).max(32),
  startDate: z.string().regex(ISO_DATE, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(ISO_DATE, 'endDate must be YYYY-MM-DD'),
  travellers: z.number().int().min(1).max(8),
  tier: tierSchema,
  currency: z.literal('USD').optional(),
});

// Cross-field rules shared by estimate + afford. ISO dates compare correctly as
// strings, so endDate > startDate is a safe lexicographic check.
function applyTripRules<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data: z.infer<typeof estimateInputObject>, ctx: z.RefinementCtx) => {
    if (data.originCityId === data.destinationCityId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Origin and destination must be different',
        path: ['destinationCityId'],
      });
    }
    if (data.endDate <= data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be after start date',
        path: ['endDate'],
      });
      return;
    }
    const nights = nightsBetween(data.startDate, data.endDate);
    if (nights > MAX_NIGHTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Trip cannot exceed ${MAX_NIGHTS} nights`,
        path: ['endDate'],
      });
    }
  });
}

export const estimateInputSchema = applyTripRules(estimateInputObject);

export const affordInputSchema = applyTripRules(
  estimateInputObject.extend({
    budget: z.number().positive().max(10_000_000),
  }),
);

export const citiesQuerySchema = z.object({
  q: z.string().min(2).max(100),
});

export type EstimateRequest = z.infer<typeof estimateInputSchema>;
export type AffordRequest = z.infer<typeof affordInputSchema>;
