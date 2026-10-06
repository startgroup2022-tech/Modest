import { describe, it, expect } from 'vitest';
import {
  buildReadySizeGuide,
  readySizeValues,
  hasReadySize,
  type SizeFieldDefinition,
} from './size-guide';

const fields: SizeFieldDefinition[] = [
  { key: 'bust', labelEn: 'Bust', labelAr: 'الصدر', unit: 'cm', minValue: null, maxValue: null, helperEn: null, helperAr: null, sortOrder: 1 },
  { key: 'waist', labelEn: 'Waist', labelAr: 'الخصر', unit: 'cm', minValue: null, maxValue: null, helperEn: null, helperAr: null, sortOrder: 2 },
];

describe('size guide', () => {
  it('builds a matrix from flat cells', () => {
    const guide = buildReadySizeGuide({
      cutCode: 'A',
      cutNameEn: 'Cut A',
      cutNameAr: 'قصّة أ',
      unit: 'cm',
      sizes: ['S', 'M', 'L'],
      fields,
      cells: [
        { fieldKey: 'bust', sizeCode: 'S', value: 90 },
        { fieldKey: 'bust', sizeCode: 'M', value: 96 },
        { fieldKey: 'waist', sizeCode: 'S', value: 70 },
      ],
    });
    expect(guide.matrix.bust.M).toBe(96);
    expect(guide.matrix.waist.S).toBe(70);
    expect(guide.matrix.bust.L).toBeUndefined();
  });

  it('orders fields by sortOrder regardless of input order', () => {
    const guide = buildReadySizeGuide({
      cutCode: 'A', cutNameEn: 'A', cutNameAr: 'أ', unit: 'cm', sizes: ['S'],
      fields: [...fields].reverse(), cells: [],
    });
    expect(guide.fields.map((f) => f.key)).toEqual(['bust', 'waist']);
  });

  it('reads a size row and reports size membership', () => {
    const guide = buildReadySizeGuide({
      cutCode: 'A', cutNameEn: 'A', cutNameAr: 'أ', unit: 'cm', sizes: ['S', 'M'],
      fields,
      cells: [
        { fieldKey: 'bust', sizeCode: 'S', value: 90 },
        { fieldKey: 'waist', sizeCode: 'S', value: 70 },
      ],
    });
    expect(readySizeValues(guide, 'S')).toEqual({ bust: 90, waist: 70 });
    expect(hasReadySize(guide, 'M')).toBe(true);
    expect(hasReadySize(guide, 'XL')).toBe(false);
  });
});
