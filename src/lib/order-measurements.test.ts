import { describe, it, expect } from 'vitest';
import {
  buildReadySizeSnapshot,
  buildCustomMeasurementSnapshot,
  isMeasurementSnapshot,
} from './order-measurements';

const fields = [
  { key: 'bust', labelEn: 'Bust', labelAr: 'الصدر' },
  { key: 'waist', labelEn: 'Waist', labelAr: 'الخصر' },
];

describe('order measurement snapshots', () => {
  it('freezes ready-size values and labels', () => {
    const snap = buildReadySizeSnapshot({
      unit: 'cm',
      cutCode: 'A',
      cutNameEn: 'Cut A',
      cutNameAr: 'قصّة أ',
      sizeCode: 'M',
      values: { bust: 96, waist: 78 },
      fields,
    });
    expect(snap.kind).toBe('READY');
    expect(snap.values).toEqual({ bust: 96, waist: 78 });
    expect(snap.fieldLabels.bust).toEqual({ en: 'Bust', ar: 'الصدر' });
  });

  it('drops blank and non-finite values rather than zeroing them', () => {
    const snap = buildCustomMeasurementSnapshot({
      unit: 'cm',
      values: { bust: '', waist: 78, hip: 'abc', length: 140 },
      fields,
    });
    expect(snap.values).toEqual({ waist: 78, length: 140 });
  });

  it('accepts numeric strings from form input', () => {
    const snap = buildCustomMeasurementSnapshot({
      unit: 'inch',
      values: { bust: '37.5' },
      fields,
      profileId: 'p1',
    });
    expect(snap.values.bust).toBe(37.5);
    expect(snap.profileId).toBe('p1');
  });

  it('recognises persisted snapshots', () => {
    expect(isMeasurementSnapshot({ kind: 'READY' })).toBe(true);
    expect(isMeasurementSnapshot({ kind: 'CUSTOM' })).toBe(true);
    expect(isMeasurementSnapshot({ kind: 'OTHER' })).toBe(false);
    expect(isMeasurementSnapshot(null)).toBe(false);
    expect(isMeasurementSnapshot('READY')).toBe(false);
  });
});
