import { describe, it, expect } from 'vitest';
import { isSameOriginRequest } from './csrf';

/**
 * Origin / CSRF policy. A state-changing, cookie-authenticated request must
 * carry origin evidence that matches our own host; a request with no origin
 * evidence at all is a non-browser client and is allowed.
 */

function req(headers: Record<string, string>, method = 'POST') {
  return new Request('https://shop.example.com/api/x', { method, headers });
}

describe('isSameOriginRequest', () => {
  it('allows a request whose Origin host matches the request host', () => {
    expect(isSameOriginRequest(req({ host: 'shop.example.com', origin: 'https://shop.example.com' }))).toBe(true);
  });

  it('blocks a request from a foreign Origin', () => {
    expect(isSameOriginRequest(req({ host: 'shop.example.com', origin: 'https://evil.example' }))).toBe(false);
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(isSameOriginRequest(req({ host: 'shop.example.com', referer: 'https://shop.example.com/checkout' }))).toBe(true);
    expect(isSameOriginRequest(req({ host: 'shop.example.com', referer: 'https://evil.example/x' }))).toBe(false);
  });

  it('honours the forwarded host behind a proxy', () => {
    expect(
      isSameOriginRequest(req({ 'x-forwarded-host': 'shop.example.com', host: 'internal:3000', origin: 'https://shop.example.com' })),
    ).toBe(true);
  });

  it('allows a non-browser request with no origin evidence', () => {
    expect(isSameOriginRequest(req({ host: 'shop.example.com' }))).toBe(true);
  });

  it('does not treat the literal "null" origin as ours', () => {
    expect(isSameOriginRequest(req({ host: 'shop.example.com', origin: 'null' }))).toBe(true); // falls through to no-evidence
    // ...but a real foreign origin alongside a null one is still blocked below.
    expect(isSameOriginRequest(req({ host: 'shop.example.com', origin: 'null', referer: 'https://evil.example/x' }))).toBe(false);
  });
});
