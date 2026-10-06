import { describe, it, expect } from 'vitest';
import { sanitizeHtml, htmlToText } from './sanitize';

describe('html sanitizer (stored-XSS defence)', () => {
  it('keeps ordinary formatting', () => {
    expect(sanitizeHtml('<p>Hello <strong>world</strong></p>')).toBe('<p>Hello <strong>world</strong></p>');
  });

  it('removes script elements and their content', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).toBe('<p>ok</p>');
    expect(out).not.toContain('alert');
  });

  it('strips inline event handlers', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">text</p>');
    expect(out).toBe('<p>text</p>');
  });

  it('blocks javascript: URLs but keeps safe links', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml('<a href="https://example.com">x</a>')).toBe('<a href="https://example.com">x</a>');
    expect(sanitizeHtml('<a href="/en/shop">x</a>')).toBe('<a href="/en/shop">x</a>');
  });

  it('drops iframes, objects and style blocks', () => {
    expect(sanitizeHtml('<iframe src="https://evil.test"></iframe>')).toBe('');
    expect(sanitizeHtml('<style>body{display:none}</style><p>ok</p>')).toBe('<p>ok</p>');
    expect(sanitizeHtml('<object data="x"></object>')).toBe('');
  });

  it('unwraps disallowed tags but keeps their text', () => {
    expect(sanitizeHtml('<div>hello</div>')).toBe('hello');
    expect(sanitizeHtml('<marquee>hi</marquee>')).toBe('hi');
  });

  it('handles img with onerror injection', () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)">');
    expect(out).toBe('');
    expect(out).not.toContain('onerror');
  });

  it('preserves tables and lists', () => {
    const html = '<ul><li>a</li></ul><table><tr><td>1</td></tr></table>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('produces plain text for metadata', () => {
    expect(htmlToText('<p>Hello &nbsp; <strong>world</strong></p>')).toBe('Hello world');
    expect(htmlToText('<script>alert(1)</script>Safe')).toBe('Safe');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });
});
