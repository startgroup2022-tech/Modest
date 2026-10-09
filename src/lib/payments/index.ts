import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '../prisma';
import { getPaymentConfigs, PAYMENT_METHODS } from '../payment-config';
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
  /** Provider-supplied reason when initialisation fails, for internal logging. */
  failureReason?: string;
}

export interface WebhookResult {
  orderId?: string;
  providerRef?: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  /**
   * Amount reported by the gateway for the transaction, in the presentment
   * currency the session was opened in (not necessarily BHD). The caller
   * compares this against the stored payment's presentment amount.
   */
  amountBhd?: number;
  /** ISO-4217 currency the gateway reports for the transaction, normalised. */
  currency?: string;
  signatureVerified: boolean;
}

/**
 * Normalises a provider-supplied currency to a canonical, upper-case ISO code.
 * Returns null when the provider did not supply a usable value, so callers can
 * decide whether currency is required for the given transition rather than
 * silently assuming one.
 */
export function normalizeCurrencyCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  // Guard against a provider sending a symbol or free text instead of a code.
  if (!/^[A-Z]{3}$/.test(trimmed)) return null;
  return trimmed;
}

export interface TappTestResult {
  state: 'success' | 'failed' | 'not_configured';
  ok: boolean;
  environment: string;
  message: string;
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
    const { getPaymentConfigs } = await import('../payment-config');
    const cfg = (await getPaymentConfigs()).COD;
    const instructions =
      cfg.instructionsEn || cfg.instructionsAr
        ? { en: cfg.instructionsEn, ar: cfg.instructionsAr }
        : undefined;
    return { status: 'PENDING', provider: 'cod', instructions };
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
    const { getPaymentConfigs } = await import('../payment-config');
    const cfg = (await getPaymentConfigs()).BANK_TRANSFER;
    const details = await getSetting('bank_transfer_details', {
      bankName: process.env.BANK_NAME ?? '',
      iban: process.env.BANK_IBAN ?? '',
      accountNumber: '',
      accountName: process.env.BANK_ACCOUNT_NAME ?? 'Attention Modest Fashion',
      instructionsEn: '',
      instructionsAr: '',
    });
    const step = (locale: 'en' | 'ar') => {
      const custom = locale === 'en' ? details.instructionsEn : details.instructionsAr;
      return custom ? ` ${custom}` : '';
    };
    const en = `Transfer to ${details.bankName || 'our bank'} — Account: ${details.accountName}, IBAN: ${details.iban || 'to be provided'}${details.accountNumber ? `, Account no: ${details.accountNumber}` : ''}. Include your order number as the reference.${step('en')}`;
    const ar = `حوّلي إلى ${details.bankName || 'حسابنا البنكي'} — الحساب: ${details.accountName}، الآيبان: ${details.iban || 'سيتم تزويدك به'}${details.accountNumber ? `، رقم الحساب: ${details.accountNumber}` : ''}. اذكري رقم الطلب في المرجع.${step('ar')}`;
    const instructions =
      cfg.instructionsEn || cfg.instructionsAr
        ? { en: cfg.instructionsEn || en, ar: cfg.instructionsAr || ar }
        : { en, ar };
    return { status: 'PENDING', provider: 'bank_transfer', instructions };
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
    const { getPaymentConfigs } = await import('../payment-config');
    const cfg = (await getPaymentConfigs()).BENEFIT;
    const details = await getSetting('benefit_details', {
      alias: process.env.BENEFIT_ALIAS ?? '',
      accountName: process.env.BENEFIT_ACCOUNT_NAME ?? 'Attention Modest Fashion',
      accountNumber: process.env.BENEFIT_ACCOUNT_NUMBER ?? '',
      instructionsEn: '',
      instructionsAr: '',
    });
    const step = (locale: 'en' | 'ar') => {
      const custom = locale === 'en' ? details.instructionsEn : details.instructionsAr;
      return custom ? ` ${custom}` : '';
    };
    const en = `Send payment via BenefitPay to alias ${details.alias || 'our alias'} (${details.accountName}). Include your order number as the note.${step('en')}`;
    const ar = `أرسلي الدفعة عبر بنفت بي إلى المعرّف ${details.alias || 'معرّفنا'} (${details.accountName}). اذكري رقم الطلب في الملاحظة.${step('ar')}`;
    const instructions =
      cfg.instructionsEn || cfg.instructionsAr
        ? { en: cfg.instructionsEn || en, ar: cfg.instructionsAr || ar }
        : { en, ar };
    return { status: 'PENDING', provider: 'benefit', instructions };
  }
  async verifyWebhook(): Promise<WebhookResult> {
    return { status: 'PENDING', signatureVerified: false };
  }
}

interface TappConfig {
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
      environment: stored.environment ?? (process.env.TAPP_ENV === 'live' ? 'live' : 'sandbox'),
      baseUrl: stored.baseUrl || process.env.TAPP_BASE_URL || 'https://api.tapp.sa',
      merchantId: stored.merchantId || process.env.TAPP_MERCHANT_ID || '',
      apiKey: stored.apiKey || process.env.TAPP_API_KEY || '',
      webhookSecret: stored.webhookSecret || process.env.TAPP_WEBHOOK_SECRET || '',
    };
  }

  /** Usable when credentials exist. The on/off switch lives in payments_config. */
  async isEnabled() {
    const c = await this.config();
    return Boolean(c.merchantId && c.apiKey);
  }

  /**
   * Non-destructive configuration check. It never claims "connected" without a
   * server response: it reports exactly which fields are missing, and when
   * credentials are present it probes the configured base URL. A network or
   * HTTP error is surfaced as `failed` with the real reason.
   */
  async testConfig(): Promise<TappTestResult> {
    const c = await this.config();
    const missing: string[] = [];
    if (!c.merchantId) missing.push('merchantId');
    if (!c.apiKey) missing.push('apiKey');
    if (!c.webhookSecret) missing.push('webhookSecret');
    if (!c.baseUrl) missing.push('baseUrl');
    if (missing.length) {
      return { state: 'not_configured', ok: false, environment: c.environment, message: `Missing: ${missing.join(', ')}` };
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(c.baseUrl, { method: 'HEAD', signal: controller.signal, cache: 'no-store' }).catch(
        async () => fetch(c.baseUrl, { method: 'GET', signal: controller.signal, cache: 'no-store' }),
      );
      clearTimeout(timer);
      // Any HTTP response proves the endpoint is reachable and the base URL is
      // valid; an auth decision (401/403) is a successful *transport* check.
      return {
        state: 'success',
        ok: true,
        environment: c.environment,
        message: `Endpoint reachable (HTTP ${res.status}). Credentials are stored but not validated against a live transaction.`,
      };
    } catch (err) {
      return {
        state: 'failed',
        ok: false,
        environment: c.environment,
        message: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  async init(input: PaymentIntentInput): Promise<PaymentInitResult> {
    const c = await this.config();
    if (!(c.merchantId && c.apiKey)) {
      // Not configured — distinct from a gateway outage, so the order carries an
      // honest reason instead of a generic "initialisation failed".
      return { status: 'FAILED', provider: 'tapp', failureReason: 'TAPP is not configured (missing merchant id or API key)' };
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
      if (!res.ok) return { status: 'FAILED', provider: 'tapp', failureReason: `TAPP session request failed (HTTP ${res.status})` };
      const data = (await res.json()) as { id?: string; url?: string };
      if (!data.url) return { status: 'FAILED', provider: 'tapp', failureReason: 'TAPP returned no redirect URL' };
      return { status: 'INITIATED', provider: 'tapp', providerRef: data.id, redirectUrl: data.url };
    } catch (err) {
      console.error('[tapp] init failed', err);
      return { status: 'FAILED', provider: 'tapp', failureReason: 'TAPP gateway unreachable' };
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
      // TAPP returns the transaction currency alongside the amount. Without it a
      // signed callback carries no monetary unit, so we surface whatever the
      // gateway sent (normalised) and let the route decide. A missing currency
      // on a settlement callback is rejected there, never assumed to be BHD.
      currency: normalizeCurrencyCode(payload.currency) ?? undefined,
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

/** Runs the TAPP connectivity check against the currently saved configuration. */
export async function testTappConnection(): Promise<TappTestResult> {
  return (registry.TAPP as TappProvider).testConfig();
}

export interface PaymentMethodMeta {
  method: PaymentMethodType;
  key: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

/**
 * Methods the storefront may offer. Labels/copy come from the admin-configured
 * `payments_config`; the provider itself must also be usable (e.g. TAPP needs
 * credentials), so an enabled-but-unconfigured gateway is never shown.
 */
export async function listEnabledPaymentMethods(): Promise<PaymentMethodMeta[]> {
  const configs = await getPaymentConfigs();
  const results: PaymentMethodMeta[] = [];
  for (const method of PAYMENT_METHODS) {
    const cfg = configs[method];
    if (!cfg.enabled || !cfg.visible) continue;
    if (!(await registry[method].isEnabled())) continue;
    results.push({
      method,
      key: registry[method].key,
      labelEn: cfg.labelEn,
      labelAr: cfg.labelAr,
      descriptionEn: cfg.descriptionEn,
      descriptionAr: cfg.descriptionAr,
    });
  }
  return results.sort((a, b) => configs[a.method].sortOrder - configs[b.method].sortOrder);
}
