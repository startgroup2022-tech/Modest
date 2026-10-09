import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(255);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
  redirect: z.string().optional(),
});

export const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(80),
    lastName: z.string().trim().min(1, 'Last name is required').max(80),
    email: emailSchema,
    phone: z.string().trim().max(30).optional().or(z.literal('')),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptsMarketing: z.coerce.boolean().optional().default(false),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'Choose a password different from your current one',
    path: ['newPassword'],
  });

const phoneRegex = /^[+]?[\d\s()-]{7,20}$/;

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  email: emailSchema,
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid phone number'),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().min(1, 'City is required').max(80),
  area: z.string().trim().max(80).optional().or(z.literal('')),
  address: z.string().trim().min(3, 'Address is required').max(240),
  building: z.string().trim().max(80).optional().or(z.literal('')),
  unit: z.string().trim().max(80).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  paymentMethod: z.enum(['COD', 'BANK_TRANSFER', 'BENEFIT', 'TAPP']),
  shippingMethodCode: z.string().trim().max(60).optional().or(z.literal('')),
  couponCode: z.string().trim().max(60).optional().or(z.literal('')),
  acceptsTerms: z.coerce.boolean().refine((v) => v === true, 'You must accept the terms'),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional().or(z.literal('')),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid phone number'),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().min(1).max(80),
  area: z.string().trim().max(80).optional().or(z.literal('')),
  address: z.string().trim().min(3).max(240),
  building: z.string().trim().max(80).optional().or(z.literal('')),
  unit: z.string().trim().max(80).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  isDefault: z.coerce.boolean().optional().default(false),
});

export const measurementSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  // When true the client is explicitly adding a new profile, so the API must
  // create rather than fall back to updating the caller's default profile.
  create: z.boolean().optional(),
  name: z.string().trim().max(60).optional().or(z.literal('')),
  unit: z.enum(['cm', 'in']).default('cm'),
  height: z.coerce.number().positive().max(300).optional().nullable(),
  shoulder: z.coerce.number().positive().max(200).optional().nullable(),
  bust: z.coerce.number().positive().max(300).optional().nullable(),
  waist: z.coerce.number().positive().max(300).optional().nullable(),
  hip: z.coerce.number().positive().max(300).optional().nullable(),
  sleeve: z.coerce.number().positive().max(200).optional().nullable(),
  armhole: z.coerce.number().positive().max(200).optional().nullable(),
  length: z.coerce.number().positive().max(300).optional().nullable(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
});

export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid phone number').optional().or(z.literal('')),
  locale: z.enum(['en', 'ar']).default('en'),
});

export const newsletterSchema = z.object({
  email: emailSchema,
  locale: z.enum(['en', 'ar']).default('en'),
});

export const cartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(20),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  message: z.string().trim().min(5).max(2000),
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}
