/**
 * Expense category machine types (pure).
 *
 * Behaviour keys off the stable `ExpenseCategoryType` enum, never the editable
 * display name. The tailor-dues category is a protected system category.
 */

export const EXPENSE_CATEGORY_TYPES = ['GENERAL', 'DELIVERY', 'MATERIAL', 'TAILOR_DUE'] as const;
export type ExpenseCategoryTypeValue = (typeof EXPENSE_CATEGORY_TYPES)[number];

/** The system category that receives system-generated tailor dues. */
export const TAILOR_DUE_TYPE: ExpenseCategoryTypeValue = 'TAILOR_DUE';

export function isExpenseCategoryType(value: unknown): value is ExpenseCategoryTypeValue {
  return typeof value === 'string' && (EXPENSE_CATEGORY_TYPES as readonly string[]).includes(value);
}

/** A system category must not be deleted or have its type changed. */
export function isProtectedExpenseCategory(category: { isSystem: boolean }): boolean {
  return category.isSystem === true;
}

export const EXPENSE_CATEGORY_TYPE_LABELS: Record<ExpenseCategoryTypeValue, { en: string; ar: string }> = {
  GENERAL: { en: 'General', ar: 'عام' },
  DELIVERY: { en: 'Delivery', ar: 'التوصيل' },
  MATERIAL: { en: 'Material', ar: 'المواد' },
  TAILOR_DUE: { en: 'Tailor dues', ar: 'مستحقات الخياطة' },
};
