import { describe, it, expect } from 'vitest';
import { safeRedirect } from './redirect-safety';

describe('safeRedirect', () => {
  it('accepts valid internal absolute paths', () => {
    expect(safeRedirect('/en/account')).toBe('/en/account');
    expect(safeRedirect('/en/admin/production/qc?status=REWORK')).toBe('/en/admin/production/qc?status=REWORK');
    expect(safeRedirect('/ar/account/orders/ATT-2610-0001')).toBe('/ar/account/orders/ATT-2610-0001');
    expect(safeRedirect('/')).toBe('/');
  });

  it('refuses external URLs with a scheme', () => {
    expect(safeRedirect('https://evil.example/steal')).toBeNull();
    expect(safeRedirect('http://evil.example')).toBeNull();
    expect(safeRedirect('javascript:alert(1)')).toBeNull();
    expect(safeRedirect('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeRedirect('mailto:x@evil.example')).toBeNull();
  });

  it('refuses protocol-relative URLs', () => {
    expect(safeRedirect('//evil.example/x')).toBeNull();
    expect(safeRedirect('///evil.example')).toBeNull();
    expect(safeRedirect('//user@evil.example')).toBeNull();
  });

  it('refuses backslash variants that browsers normalise to a slash', () => {
    expect(safeRedirect('/\\evil.example')).toBeNull();
    expect(safeRedirect('/\\/evil.example')).toBeNull();
    expect(safeRedirect('\\\\evil.example')).toBeNull();
  });

  it('refuses percent-encoded protocol-relative variants', () => {
    expect(safeRedirect('/%2F%2Fevil.example')).toBeNull();
    expect(safeRedirect('/%5Cevil.example')).toBeNull();
    expect(safeRedirect('/%2f%2fevil.example')).toBeNull();
  });

  it('refuses control characters and empty input', () => {
    expect(safeRedirect('\u0000/evil')).toBeNull();
    expect(safeRedirect('/en\n/evil')).toBeNull();
    expect(safeRedirect('')).toBeNull();
    expect(safeRedirect(undefined)).toBeNull();
    expect(safeRedirect(null)).toBeNull();
  });

  it('refuses non-absolute and relative targets', () => {
    expect(safeRedirect('en/account')).toBeNull();
    expect(safeRedirect('account')).toBeNull();
    expect(safeRedirect('./account')).toBeNull();
    expect(safeRedirect('../account')).toBeNull();
  });
});
