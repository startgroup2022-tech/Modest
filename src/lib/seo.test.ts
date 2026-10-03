import { describe, it, expect } from 'vitest';
import { seoTitle } from './seo';
import { jsonLdHtml } from './seo';

describe('seoTitle', () => {
  it('appends the brand to an auto-derived title', () => {
    expect(seoTitle(null, 'Shop All')).toEqual({ absolute: 'Shop All | Attention Modest Fashion' });
    expect(seoTitle(undefined, 'Shop All')).toEqual({ absolute: 'Shop All | Attention Modest Fashion' });
    expect(seoTitle('   ', 'Shop All')).toEqual({ absolute: 'Shop All | Attention Modest Fashion' });
  });

  it('uses the Arabic brand for the ar locale', () => {
    expect(seoTitle(null, 'المتجر', 'ar')).toEqual({ absolute: 'المتجر | أتنشن' });
  });

  it('treats an explicit admin meta title as absolute', () => {
    // A title the owner already wrote is not branded a second time.
    expect(seoTitle('Midnight Garden Kimono II | Attention Modest Fashion', 'Fallback')).toEqual({
      absolute: 'Midnight Garden Kimono II | Attention Modest Fashion',
    });
  });

  it('never returns the fallback when an explicit title is present', () => {
    const result = seoTitle('Custom Title', 'Ignored');
    expect(result.absolute).toBe('Custom Title');
    expect(result.absolute).not.toContain('Ignored');
  });
});

describe('jsonLdHtml', () => {
  it('escapes a closing script tag so it cannot break out of the JSON-LD block', () => {
    const out = jsonLdHtml({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('\\u003c');
  });

  it('escapes angle brackets and ampersands in nested values', () => {
    const out = jsonLdHtml({ a: '<b>&', c: [{ d: '5 < 6' }] });
    expect(out).not.toMatch(/[<>&]/);
  });

  it('round-trips to the original structured data after decoding', () => {
    const data = { '@type': 'Product', name: 'Kimono', offers: { price: 95 } };
    const decoded = JSON.parse(
      jsonLdHtml(data)
        .replace(/\\u003c/g, '<')
        .replace(/\\u003e/g, '>')
        .replace(/\\u0026/g, '&'),
    );
    expect(decoded).toEqual(data);
  });
});
