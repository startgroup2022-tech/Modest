/**
 * Helpers for the declarative admin resource routes. Forms submit empty strings
 * for cleared optional fields; these turn that into `null` so partial records
 * update cleanly, and coerce date-only inputs to `Date` for Prisma.
 */

export const cleanStr = (v: unknown): string | null => (v === '' || v == null ? null : String(v));

export const dateOrNull = (v: unknown): Date | null =>
  typeof v === 'string' && v.trim().length > 0 ? new Date(v) : null;

export const numOrNull = (v: unknown): number | null => (v === '' || v == null ? null : Number(v));
