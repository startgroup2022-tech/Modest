import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '../prisma';
import type { PaymentMethodType } from '@prisma/client';

/**
 * Payment provider abstraction.
 *
 * A provider never decides that a payment succeeded on the client's word.
 * Every provider returns a server-derived status, and online providers must
 * pass signature verification before an order is marked paid.
 */

export interface PaymentIntentInput {
  orderId: string;
  orderNumber: string;
  amountBhd: number;
  currencyCode: string;
  amountPresentment: number;
  customer: { name: string; email: string; phone: string };
  returnUrl: string;
  cancelUrl: string;
}

export interface PaymentInitResult {
  status: 'INITIATED' | 'PENDING' | 'PAID' | 'FAILED';
  provider: string;
  providerRef?: string;
  redirectUrl?: string;
  instructions?: { en: string; ar: string };
  signatureVerified?: boolean;
}

export interface WebhookResult {
  orderId?: string;
  providerRef?: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  amountBhd?: number;
  signatureVerified: boolean;
}

export interface PaymentProvider {
  readonly method: PaymentMethodType;
  readonly key: string;
  isEnabled(): Promise<boolean>;
  init(input: PaymentIntentInput): Promise<PaymentInitResult>;
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookResult>;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row ? (row.value as T) : fallback;
}

class CodProvider implements PaymentProvider {
  readonly method = 'COD' as const;
  readonly key = 'cod';
  async isEnabled() {
    return true;
  }
  async init(): Promise<PaymentInitResult> {
    return { status: 'PENDING', provider: 'cod' };
  }
  async verifyWebhook(): Promise<WebhookResult> {
    return { status: 'PENDING', signatureVerified: false };
  }
}

class BankTransferProvider implements PaymentProvider {
  readonly method = 'BANK_TRANSFER' as const;
  readonly key = 'bank_transfer';
  async isEnabled() {
    return true;
  }
  async init(): Promise<PaymentInitResult> {
    const details = await getSetting('bank_transfer_details', {
      bankName: process.env.BANK_NAME ?? '',
      iban: process.env.BANK_IBAN ?? '',
      accountName: process.env.BANK_ACCOUNT_NAME ?? 'Attention Modest Fashion',
    });
    const en = `Transfer to ${details.bankName || 'our bank'} — Account: ${details.accountName}, IBAN: ${details.iban || 'to be provided'}. Include your order number as the reference.`;
    const ar = `حوّلي إلى ${details.bankName || 'حسابنا البنكي'} — الحساب: ${details.accountName}، الآيبان: ${details.iban || 'سيتم تزويدك به'}. اذكري رقم الطلب في المرجع.`;
    return { status: 'PENDING', provider: 'bank_transfer', instructions: { en, ar } };
  }
  async verifyWebhook(): Promise<WebhookResult> {
    return { status: 'PENDING', signatureVerified: false };
  }
}

class BenefitProvider implements PaymentProvider {
  readonly method = 'BENEFIT' as const;
  readonly key = 'benefit';
  async isEnabled() {
    return true;
  }
  async init(): Promise<PaymentInitResult> {
    const details = await getSetting('benefit_details', {
      alias: process.env.BENEFIT_ALIAS ?? '',
      accountName: process.env.BENEFIT_ACCOUNT_NAME ?? 'Attention Modest Fashion',
      accountNumber: process.env.BENEFIT_ACCOUNT_NUMBER ?? '',
    });
    const en = `Send payment via BenefitPay to alias ${details.alias || 'our alias'} (${details.accountName}). Include your order number as the note.`;
    const ar = `أرسلي الدفعة عبر بنفت بي إلى المعرّف ${details.alias || 'معرّفنا'} (${details.accountName}). اذكري رقم الطلب في الملاحظة.`;
    return { status: 'PENDING', provider: 'benefit', instructions: { en, ar } };
  }
  async verifyWebhook(): Promise<WebhookResult> {
    return { status: 'PENDING', signatureVerified: false };
  }
}

interface TappConfig {
  enabled: boolean;
  environment: 'sandbox' | 'live';
  baseUrl: string;
  merchantId: string;
  apiKey: string;
  webhookSecret: string;
}

class TappProvider implements PaymentProvider {
  readonly method = 'TAPP' as const;
  readonly key = 'tapp';

  private async config(): Promise<TappConfig> {
    const stored = await getSetting<Partial<TappConfig>>('tapp_config', {});
    return {
      enabled: stored.enabled ?? false,
      environment: stored.environment ?? (process.env.TAPP_ENV === 'live' ? 'live' : 'sandbox'),
      baseUrl: stored.baseUrl || process.env.TAPP_BASE_URL || 'https://api.tapp.sa',
      merchantId: stored.merchantId || process.env.TAPP_MERCHANT_ID || '',
      apiKey: stored.apiKey || process.env.TAPP_API_KEY || '',
      webhookSecret: stored.webhookSecret || process.env.TAPP_WEBHOOK_SECRET || '',
    };
  }

  async isEnabled() {
    const c = await this.config();
    return Boolean(c.enabled && c.merchantId && c.apiKey);
  }

  async init(input: PaymentIntentInput): Promise<PaymentInitResult> {
    const c = await this.config();
    if (!(c.enabled && c.merchantId && c.apiKey)) {
      return { status: 'FAILED', provider: 'tapp' };
    }
    try {
      const res = await fetch(`${c.baseUrl}/v1/payment/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${c.apiKey}`,
        },
        body: JSON.stringify({
          merchant_id: c.merchantId,
          amount: input.amountPresentment,
          currency: input.currencyCode,
          reference: input.orderNumber,
          customer: input.customer,
          callback_url: `${input.returnUrl}?order=${input.orderId}`,
          cancel_url: `${input.cancelUrl}?order=${input.orderId}`,
        }),
        cache: 'no-store',
      });
      if (!res.ok) return { status: 'FAILED', provider: 'tapp' };
      const data = (await res.json()) as { id?: string; url?: string };
      if (!data.url) return { status: 'FAILED', provider: 'tapp' };
      return { status: 'INITIATED', provider: 'tapp', providerRef: data.id, redirectUrl: data.url };
    } catch (err) {
      console.error('[tapp] init failed', err);
      return { status: 'FAILED', provider: 'tapp' };
    }
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookResult> {
    const c = await this.config();
    const signature = headers['x-tapp-signature'] ?? headers['x-signature'] ?? '';
    if (!c.webhookSecret || !signature) {
      return { status: 'FAILED', signatureVerified: false };
    }
    const expected = createHmac('sha256', c.webhookSecret).update(rawBody).digest('hex');
    if (!safeEqual(expected, signature)) {
      return { status: 'FAILED', signatureVerified: false };
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { status: 'FAILED', signatureVerified: false };
    }
    const rawStatus = String(payload.status ?? '').toLowerCase();
    const status: WebhookResult['status'] =
      rawStatus === 'paid' || rawStatus === 'captured' || rawStatus === 'success'
        ? 'PAID'
        : rawStatus === 'cancelled'
          ? 'CANCELLED'
          : rawStatus === 'refunded'
            ? 'REFUNDED'
            : rawStatus === 'failed'
              ? 'FAILED'
              : 'PENDING';
    return {
      orderId: typeof payload.reference === 'string' ? payload.reference : undefined,
      providerRef: typeof payload.id === 'string' ? payload.id : undefined,
      amountBhd: typeof payload.amount === 'number' ? payload.amount : undefined,
      status,
      signatureVerified: true,
    };
  }
}

const registry: Record<PaymentMethodType, PaymentProvider> = {
  COD: new CodProvider(),
  BANK_TRANSFER: new BankTransferProvider(),
  BENEFIT: new BenefitProvider(),
  TAPP: new TappProvider(),
};

export function getPaymentProvider(method: PaymentMethodType): PaymentProvider {
  return registry[method];
}

export interface PaymentMethodMeta {
  method: PaymentMethodType;
  key: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

export async function listEnabledPaymentMethods(): Promise<PaymentMethodMeta[]> {
  const meta: Record<PaymentMethodType, Omit<PaymentMethodMeta, 'method' | 'key'>> = {
    COD: {
      labelEn: 'Cash on Delivery',
      labelAr: 'الدفع عند الاستلام',
      descriptionEn: 'Pay in cash when your order is delivered.',
      descriptionAr: 'ادفعي نقداً عند استلام طلبك.',
    },
    BANK_TRANSFER: {
      labelEn: 'Bank Transfer',
      labelAr: 'تحويل بنكي',
      descriptionEn: 'Transfer to our bank account.',
      descriptionAr: 'حوّلي إلى حسابنا البنكي.',
    },
    BENEFIT: {
      labelEn: 'BenefitPay Transfer',
      labelAr: 'تحويل بنفت بي',
      descriptionEn: 'Send payment via BenefitPay.',
      descriptionAr: 'أرسلي الدفعة عبر بنفت بي.',
    },
    TAPP: {
      labelEn: 'TAPP',
      labelAr: 'تاب',
      descriptionEn: 'Pay securely online with TAPP.',
      descriptionAr: 'ادفعي بأمان عبر الإنترنت باستخدام تاب.',
    },
  };
  const results: PaymentMethodMeta[] = [];
  for (const method of Object.keys(registry) as PaymentMethodType[]) {
    if (await registry[method].isEnabled()) {
      results.push({ method, key: registry[method].key, ...meta[method] });
    }
  }
  return results;
}
