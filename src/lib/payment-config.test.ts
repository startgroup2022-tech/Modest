import { describe, it, expect } from 'vitest';
import { getPaymentConfigs, isMethodOrderable, assertMethodAllowed, PAYMENT_METHODS } from './payment-config';

/** Builds a settings reader from a plain map so the layer is testable without a database. */
function reader(map: Record<string, Record<string, unknown>>) {
  return async (key: string) => map[key] ?? {};
}

describe('payment-config', () => {
  it('falls back to defaults when nothing is configured', async () => {
    const configs = await getPaymentConfigs(reader({}));
    expect(Object.keys(configs).sort()).toEqual([...PAYMENT_METHODS].sort());
    expect(configs.COD.enabled).toBe(true);
    expect(configs.TAPP.enabled).toBe(false);
    expect(configs.BANK_TRANSFER.labelEn).toBe('Bank Transfer');
  });

  it('honours legacy boolean settings when payments_config is absent', async () => {
    const configs = await getPaymentConfigs(reader({ payments: { enableCod: false, enableTapp: true } }));
    expect(configs.COD.enabled).toBe(false);
    expect(configs.TAPP.enabled).toBe(true);
    expect(configs.BENEFIT.enabled).toBe(true);
  });

  it('lets payments_config override legacy booleans and copy', async () => {
    const configs = await getPaymentConfigs(
      reader({
        payments: { enableCod: false },
        payments_config: {
          COD: { enabled: true, labelEn: 'Pay at the door', sortOrder: 9, minOrderBhd: 5 },
        },
      }),
    );
    expect(configs.COD.enabled).toBe(true);
    expect(configs.COD.labelEn).toBe('Pay at the door');
    expect(configs.COD.sortOrder).toBe(9);
    expect(configs.COD.minOrderBhd).toBe(5);
    expect(configs.COD.labelAr).toBe('الدفع عند الاستلام'); // untouched default preserved
  });

  it('treats zero/negative limits as no limit', async () => {
    const configs = await getPaymentConfigs(reader({ payments_config: { COD: { minOrderBhd: 0, maxOrderBhd: -1 } } }));
    expect(configs.COD.minOrderBhd).toBeNull();
    expect(configs.COD.maxOrderBhd).toBeNull();
  });

  it('enforces enabled, visible and order-value limits', async () => {
    const configs = await getPaymentConfigs(
      reader({ payments_config: { COD: { enabled: false }, TAPP: { enabled: true, minOrderBhd: 10, maxOrderBhd: 100 } } }),
    );
    expect(assertMethodAllowed(configs.COD, 50).ok).toBe(false);
    expect(assertMethodAllowed(configs.TAPP, 5)).toMatchObject({ ok: false, code: 'MIN' });
    expect(assertMethodAllowed(configs.TAPP, 500)).toMatchObject({ ok: false, code: 'MAX' });
    expect(assertMethodAllowed(configs.TAPP, 50).ok).toBe(true);
  });

  it('isMethodOrderable mirrors the server gate for list filtering', async () => {
    const configs = await getPaymentConfigs(reader({ payments_config: { BENEFIT: { enabled: false } } }));
    expect(isMethodOrderable(configs.BENEFIT, 20)).toBe(false);
    expect(isMethodOrderable(configs.COD, 20)).toBe(true);
  });
});
