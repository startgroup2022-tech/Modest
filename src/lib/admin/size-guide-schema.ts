import { z } from 'zod';

/**
 * Admin size-guide schemas. Cuts, ready sizes and custom measurement fields
 * are business data, so they are edited here — never hard-coded into pages.
 */

export const READY_SIZE_CODES = ['XS', 'S', 'M', 'L', 'XL'] as const;
const sizeCodes = z.array(z.string().min(1).max(8)).max(20);

export const cutSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_]+$/, 'Use uppercase letters, digits and underscores only'),
  nameEn: z.string().min(1).max(120),
  nameAr: z.string().min(1).max(120),
  descriptionEn: z.string().max(2000).optional().default(''),
  descriptionAr: z.string().max(2000).optional().default(''),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const updateCutSchema = cutSchema.partial().extend({
  id: z.string().min(1),
});

export const fieldSchema = z.object({
  cutId: z.string().min(1),
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase snake_case keys'),
  labelEn: z.string().min(1).max(120),
  labelAr: z.string().min(1).max(120),
  unit: z.string().min(1).max(20).default('inch'),
  minValue: z.coerce.number().min(0).max(1000).nullable().optional(),
  maxValue: z.coerce.number().min(0).max(1000).nullable().optional(),
  helperEn: z.string().max(500).optional().default(''),
  helperAr: z.string().max(500).optional().default(''),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  /** fieldKey values per ready-size code, e.g. { XS: 15.2, S: 15.6 }. */
  sizeValues: z.record(z.string(), z.coerce.number().min(0).max(1000)).optional(),
});

export const updateFieldSchema = fieldSchema.omit({ cutId: true }).partial().extend({
  id: z.string().min(1),
  cutId: z.string().min(1),
  sizes: sizeCodes.optional(),
});

export const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_cut'), data: cutSchema }),
  z.object({ action: z.literal('update_cut'), data: updateCutSchema }),
  z.object({ action: z.literal('delete_cut'), data: z.object({ id: z.string().min(1) }) }),
  z.object({ action: z.literal('create_field'), data: fieldSchema }),
  z.object({ action: z.literal('update_field'), data: updateFieldSchema }),
  z.object({ action: z.literal('delete_field'), data: z.object({ id: z.string().min(1) }) }),
]);

export type SizeGuideAction = z.infer<typeof actionSchema>;
