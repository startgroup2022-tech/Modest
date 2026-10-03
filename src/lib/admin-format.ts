import type { Locale } from '@/i18n/config';
import type { AdminDict } from '@/i18n/admin-dict';
import { formatMoney } from './utils';

type Numish = number | string | { toString(): string } | null | undefined;

function toNumber(value: Numish): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

/** BHD is the accounting base for every admin figure. */
export function formatBhd(value: Numish, locale: Locale): string {
  const n = toNumber(value);
  return formatMoney(n, {
    code: 'BHD',
    symbol: locale === 'ar' ? 'د.ب' : 'BHD',
    decimals: 3,
    symbolPosition: 'prefix',
    locale,
  });
}

export function formatMoneyDisplay(
  value: number | string | null | undefined,
  opts: { code: string; symbol: string; decimals: number; symbolPosition: 'prefix' | 'suffix'; locale: Locale },
): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  return formatMoney(Number.isFinite(n) ? n : 0, opts);
}

export function formatNumber(value: Numish, locale: Locale): string {
  return toNumber(value).toLocaleString(locale === 'ar' ? 'ar-BH' : 'en-US', {
    numberingSystem: 'latn',
  });
}

export function formatPercent(value: number, locale: Locale, decimals = 1): string {
  return `${value.toFixed(decimals)}${locale === 'ar' ? '٪' : '%'}`;
}

export function formatDate(value: Date | string | null | undefined, locale: Locale): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'ar' ? 'ar-BH' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    numberingSystem: 'latn',
  });
}

export function formatDateTime(value: Date | string | null | undefined, locale: Locale): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale === 'ar' ? 'ar-BH' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: 'latn',
  });
}

export function formatRelative(value: Date | string | null | undefined, locale: Locale): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  if (Math.abs(mins) < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(-days, 'day');
  return formatDate(d, locale);
}

const EN_LABELS: Record<string, string> = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', IN_PRODUCTION: 'In production',
  QUALITY_CHECK: 'Quality check', READY: 'Ready', SHIPPED: 'Shipped', DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled', REFUND_REQUESTED: 'Refund requested', REFUNDED: 'Refunded',
  INITIATED: 'Initiated', PAID: 'Paid', FAILED: 'Failed', PARTIALLY_REFUNDED: 'Partially refunded',
  ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', REWORK: 'Rework',
  PASSED: 'Passed', REWORK_REQUIRED: 'Rework required',
  DRAFT: 'Draft', SUBMITTED: 'Submitted', APPROVED: 'Approved', REJECTED: 'Rejected',
  ACTIVE: 'Active', INACTIVE: 'Inactive', ON_LEAVE: 'On leave', SUSPENDED: 'Suspended',
  ARCHIVED: 'Archived', LOW_STOCK: 'Low stock', OUT_OF_STOCK: 'Out of stock', IN_STOCK: 'In stock', PRE_ORDER: 'Pre-order',
  ONLINE: 'Online', QUICK_ORDER: 'Quick order', WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram',
  PHONE: 'Phone', WALK_IN: 'Walk-in', MANUAL: 'Manual',
  COD: 'Cash on delivery', BANK_TRANSFER: 'Bank transfer', BENEFIT: 'BenefitPay', TAPP: 'TAPP',
  PERCENTAGE: 'Percentage', FIXED: 'Fixed amount', FREE_SHIPPING: 'Free shipping',
  READY_TO_WEAR: 'Ready to wear', MADE_TO_ORDER: 'Made to order',
  LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent',
  SALE: 'Sale', RESERVATION: 'Reservation', RELEASE: 'Release', MANUAL_ADJUSTMENT: 'Manual adjustment',
  RETURN: 'Return', RESTOCK: 'Restock', DAMAGE: 'Damage', QC_REJECTED: 'QC rejected', CANCELLATION: 'Cancellation',
};

const AR_LABELS: Record<string, string> = {
  PENDING: 'معلّق', CONFIRMED: 'مؤكد', PREPARING: 'قيد التحضير', IN_PRODUCTION: 'قيد الإنتاج',
  QUALITY_CHECK: 'ضبط الجودة', READY: 'جاهز', SHIPPED: 'مشحون', DELIVERED: 'مُسلَّم',
  CANCELLED: 'ملغى', REFUND_REQUESTED: 'طلب استرداد', REFUNDED: 'مسترد',
  INITIATED: 'مُبدأ', PAID: 'مدفوع', FAILED: 'فشل', PARTIALLY_REFUNDED: 'مسترد جزئياً',
  ASSIGNED: 'مُعيَّن', IN_PROGRESS: 'قيد التنفيذ', COMPLETED: 'مكتمل', REWORK: 'إعادة تصحيح',
  PASSED: 'اجتياز', REWORK_REQUIRED: 'يتطلب إعادة تصحيح',
  DRAFT: 'مسودة', SUBMITTED: 'مُرسل', APPROVED: 'معتمد', REJECTED: 'مرفوض',
  ACTIVE: 'نشط', INACTIVE: 'غير نشط', ON_LEAVE: 'في إجازة', SUSPENDED: 'موقوف',
  ARCHIVED: 'مؤرشف', LOW_STOCK: 'مخزون منخفض', OUT_OF_STOCK: 'غير متوفر', IN_STOCK: 'متوفر', PRE_ORDER: 'طلب مسبق',
  ONLINE: 'أونلاين', QUICK_ORDER: 'طلب سريع', WHATSAPP: 'واتساب', INSTAGRAM: 'إنستغرام',
  PHONE: 'هاتف', WALK_IN: 'زيارة', MANUAL: 'يدوي',
  COD: 'الدفع عند الاستلام', BANK_TRANSFER: 'تحويل بنكي', BENEFIT: 'بنفت بي', TAPP: 'تاب',
  PERCENTAGE: 'نسبة مئوية', FIXED: 'مبلغ ثابت', FREE_SHIPPING: 'شحن مجاني',
  READY_TO_WEAR: 'جاهز للارتداء', MADE_TO_ORDER: 'حسب الطلب',
  LOW: 'منخفضة', NORMAL: 'عادية', HIGH: 'عالية', URGENT: 'عاجلة',
  SALE: 'بيع', RESERVATION: 'حجز', RELEASE: 'تحرير', MANUAL_ADJUSTMENT: 'تعديل يدوي',
  RETURN: 'إرجاع', RESTOCK: 'إعادة تخزين', DAMAGE: 'تلف', QC_REJECTED: 'رفض ضبط الجودة', CANCELLATION: 'إلغاء',
};

export function label(value: string | null | undefined, locale: Locale): string {
  if (!value) return '—';
  const map = locale === 'ar' ? AR_LABELS : EN_LABELS;
  return map[value] ?? value.replace(/_/g, ' ').toLowerCase();
}

/** Reads a value from the admin dictionary by a dotted path, e.g. t('orders.title'). */
export function t(dict: AdminDict, path: string): string {
  const parts = path.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof cur === 'string' ? cur : path;
}
