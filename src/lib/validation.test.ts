import { describe, expect, it } from 'vitest';
import {
  addressSchema,
  cartLineSchema,
  checkoutSchema,
  contactSchema,
  measurementSchema,
  newsletterSchema,
  passwordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validation';

const validCheckout = {
  fullName: 'Fatima Al Noor',
  email: 'Fatima@Example.com',
  phone: '+973 3225 0467',
  country: 'Bahrain',
  city: 'Manama',
  area: 'Juffair',
  address: 'Building 120, Road 4',
  building: '120',
  unit: '3',
  notes: '',
  paymentMethod: 'COD',
  shippingMethodCode: 'standard',
  couponCode: '',
  acceptsTerms: true,
};

describe('checkoutSchema', () => {
  it('accepts a valid guest checkout and normalises the email', () => {
    const parsed = checkoutSchema.parse(validCheckout);
    expect(parsed.email).toBe('fatima@example.com');
  });

  it('rejects an invalid email', () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, email: 'nope' }).success).toBe(false);
  });

  it('rejects an invalid phone number', () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, phone: 'abc' }).success).toBe(false);
  });

  it('rejects an unknown payment method', () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, paymentMethod: 'CRYPTO' }).success).toBe(false);
  });

  it('requires terms acceptance', () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, acceptsTerms: false }).success).toBe(false);
  });
});

describe('signUpSchema', () => {
  const base = {
    firstName: 'Fatima',
    lastName: 'Al Noor',
    email: 'fatima@example.com',
    password: 'supersecret',
    confirmPassword: 'supersecret',
  };

  it('accepts matching passwords', () => {
    expect(signUpSchema.safeParse(base).success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = signUpSchema.safeParse({ ...base, confirmPassword: 'different' });
    expect(result.success).toBe(false);
  });

  it('rejects short passwords', () => {
    expect(signUpSchema.safeParse({ ...base, password: 'short', confirmPassword: 'short' }).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('enforces an 8-character minimum', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(true);
  });
});

describe('signInSchema', () => {
  it('accepts an email and any non-empty password', () => {
    expect(signInSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});

describe('measurementSchema', () => {
  it('coerces numeric strings and defaults the unit to cm', () => {
    const parsed = measurementSchema.parse({ bust: '88', waist: '70' });
    expect(parsed.bust).toBe(88);
    expect(parsed.waist).toBe(70);
    expect(parsed.unit).toBe('cm');
  });

  it('rejects negative measurements', () => {
    expect(measurementSchema.safeParse({ bust: -1 }).success).toBe(false);
  });

  it('rejects an unsupported unit', () => {
    expect(measurementSchema.safeParse({ unit: 'ft' }).success).toBe(false);
  });
});

describe('addressSchema', () => {
  it('accepts a complete address', () => {
    expect(
      addressSchema.safeParse({
        fullName: 'Fatima Al Noor',
        phone: '+97332250467',
        country: 'Bahrain',
        city: 'Manama',
        address: 'Building 120, Road 4',
      }).success,
    ).toBe(true);
  });

  it('rejects a too-short address', () => {
    expect(
      addressSchema.safeParse({ fullName: 'F A', phone: '+97332250467', country: 'Bahrain', city: 'Manama', address: 'x' }).success,
    ).toBe(false);
  });
});

describe('cartLineSchema', () => {
  it('accepts a valid line', () => {
    expect(cartLineSchema.safeParse({ productId: 'p1', quantity: 2 }).success).toBe(true);
  });

  it('rejects a zero or oversized quantity', () => {
    expect(cartLineSchema.safeParse({ productId: 'p1', quantity: 0 }).success).toBe(false);
    expect(cartLineSchema.safeParse({ productId: 'p1', quantity: 999 }).success).toBe(false);
  });
});

describe('newsletterSchema', () => {
  it('defaults the locale to en', () => {
    expect(newsletterSchema.parse({ email: 'a@b.com' }).locale).toBe('en');
  });
});

describe('contactSchema', () => {
  it('requires a message of at least five characters', () => {
    expect(contactSchema.safeParse({ name: 'Fatima', email: 'a@b.com', message: 'hi' }).success).toBe(false);
    expect(contactSchema.safeParse({ name: 'Fatima', email: 'a@b.com', message: 'Hello there' }).success).toBe(true);
  });
});
