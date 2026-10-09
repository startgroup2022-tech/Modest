import 'server-only';
import { prisma } from './prisma';
import type { PaymentMethodType } from '@prisma/client';

/**
 * Admin-configurable payment methods.
 *
 * The legacy `payments` setting only carried booleans. This layer keeps that
 * working while letting the owner control labels, copy, ordering, visibility
 * and order-value limits for every method without a source change. The single
 * source of truth is the `payments_config` site setting; anything missing falls
 * back to a sensible default so an empty database still produces a working
 * checkout.
 */

export const PAYMENT_METHODS: PaymentMethodType[] = ['COD', 'BANK_TRANSFER', 'BENEFIT', 'TAPP'];

export interface PaymentMethodConfig {
  method: PaymentMethodType;
  enabled: boolean;
  visible: boolean;
  sortOrder: number;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  instructionsEn: string;
  instructionsAr: string;
  minOrderBhd: number | null;
  maxOrderBhd: number | null;
}

export type PaymentConfigMap = Record<PaymentMethodType, PaymentMethodConfig>;

const DEFAULTS: PaymentConfigMap = {
  COD: {
    method: 'COD',
    enabled: true,
    visible: true,
    sortOrder: 1,
    labelEn: 'Cash on Delivery',
    labelAr: 'الدفع عند الاستلام',
    descriptionEn: 'Pay in cash when your order is delivered.',
    descriptionAr: 'ادفعي نقداً عند استلام طلبك.',
    instructionsEn: 'Please have the exact amount ready for the courier.',
    instructionsAr: 'يرجى تجهيز المبلغ بالضبط للمندوب.',
    minOrderBhd: null,
    maxOrderBhd: null,
  },
  BANK_TRANSFER: {
    method: 'BANK_TRANSFER',
    enabled: true,
    visible: true,
    sortOrder: 2,
    labelEn: 'Bank Transfer',
    labelAr: 'تحويل بنكي',
    descriptionEn: 'Transfer to our bank account and include your order number.',
    descriptionAr: 'حوّلي إلى حسابنا البنكي واذكري رقم الطلب.',
    instructionsEn: 'Your order is reserved until payment is verified.',
    instructionsAr: 'يتم حجز طلبك حتى يتم التحقق من الدفع.',
    minOrderBhd: null,
    maxOrderBhd: null,
  },
  BENEFIT: {
    method: 'BENEFIT',
    enabled: true,
    visible: true,
    sortOrder: 3,
    labelEn: 'BenefitPay Transfer',
    labelAr: 'تحويل بنفت بي',
    descriptionEn: 'Send payment via BenefitPay and include your order number.',
    descriptionAr: 'أرسلي الدفعة عبر بنفت بي واذكري رقم الطلب.',
    instructionsEn: 'Your order is reserved until payment is verified.',
    instructionsAr: 'يتم حجز طلبك حتى يتم التحقق من الدفع.',
    minOrderBhd: null,
    maxOrderBhd: null,
  },
  TAPP: {
    method: 'TAPP',
    enabled: false,
    visible: true,
    sortOrder: 4,
    labelEn: 'TAPP',
    labelAr: 'تاب',
    descriptionEn: 'Pay securely online with TAPP.',
    descriptionAr: 'ادفعي بأمان عبر الإنترنت باستخدام تاب.',
    instructionsEn: '',
    instructionsAr: '',
    minOrderBhd: null,
    maxOrderBhd: null,
  },
};

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Order-value limits: a missing, zero or negative value means "no limit". */
function limit(value: unknown): number | null {
  const n = num(value);
  return n !== null && n > 0 ? n : null;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Merges a stored method entry (or legacy boolean) over the defaults. */
function mergeMethod(
  method: PaymentMethodType,
  stored: unknown,
  legacyEnabled?: boolean,
): PaymentMethodConfig {
  const d = DEFAULTS[method];
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  return {
    method,
    enabled: bool(s.enabled, legacyEnabled ?? d.enabled),
    visible: bool(s.visible, d.visible),
    sortOrder: num(s.sortOrder) ?? d.sortOrder,
    labelEn: str(s.labelEn, d.labelEn),
    labelAr: str(s.labelAr, d.labelAr),
    descriptionEn: str(s.descriptionEn, d.descriptionEn),
    descriptionAr: str(s.descriptionAr, d.descriptionAr),
    instructionsEn: str(s.instructionsEn, d.instructionsEn),
    instructionsAr: str(s.instructionsAr, d.instructionsAr),
    minOrderBhd: limit(s.minOrderBhd),
    maxOrderBhd: limit(s.maxOrderBhd),
  };
}

type SettingReader = (key: string) => Promise<Record<string, unknown>>;

async function readSetting(key: string): Promise<Record<string, unknown>> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return (row?.value as Record<string, unknown>) ?? {};
}

/** Full method configuration, merged with defaults, ordered for display. */
export async function getPaymentConfigs(read: SettingReader = readSetting): Promise<PaymentConfigMap> {
  const [config, legacy] = await Promise.all([read('payments_config'), read('payments')]);
  const legacyMap: Record<string, boolean | undefined> = {
    COD: typeof legacy.enableCod === 'boolean' ? legacy.enableCod : undefined,
    BANK_TRANSFER: typeof legacy.enableBank === 'boolean' ? legacy.enableBank : undefined,
    BENEFIT: typeof legacy.enableBenefit === 'boolean' ? legacy.enableBenefit : undefined,
    TAPP: typeof legacy.enableTapp === 'boolean' ? legacy.enableTapp : undefined,
  };
  const out = {} as PaymentConfigMap;
  for (const method of PAYMENT_METHODS) {
    out[method] = mergeMethod(method, config[method], legacyMap[method]);
  }
  return out;
}

/** A method is orderable when the owner enabled it, it is visible, and the
 *  order value sits inside any configured limits. */
export function isMethodOrderable(cfg: PaymentMethodConfig, totalBhd: number | null): boolean {
  if (!cfg.enabled || !cfg.visible) return false;
  if (totalBhd === null) return true;
  if (cfg.minOrderBhd !== null && totalBhd < cfg.minOrderBhd) return false;
  if (cfg.maxOrderBhd !== null && totalBhd > cfg.maxOrderBhd) return false;
  return true;
}

/**
 * Server-side gate for a chosen method. Throws a machine code so the checkout
 * route can return a precise, localized message. Never trusts the client's
 * method list — the client only ever receives methods this function approves.
 */
export function assertMethodAllowed(
  cfg: PaymentMethodConfig,
  totalBhd: number,
): { ok: true } | { ok: false; code: 'DISABLED' | 'MIN' | 'MAX'; message: string } {
  if (!cfg.enabled || !cfg.visible) {
    return { ok: false, code: 'DISABLED', message: 'This payment method is not available' };
  }
  if (cfg.minOrderBhd !== null && totalBhd < cfg.minOrderBhd) {
    return {
      ok: false,
      code: 'MIN',
      message: `This payment method requires a minimum order of ${cfg.minOrderBhd.toFixed(3)} BHD`,
    };
  }
  if (cfg.maxOrderBhd !== null && totalBhd > cfg.maxOrderBhd) {
    return {
      ok: false,
      code: 'MAX',
      message: `This payment method is limited to orders up to ${cfg.maxOrderBhd.toFixed(3)} BHD`,
    };
  }
  return { ok: true };
}
