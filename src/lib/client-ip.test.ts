import { describe, it, expect, afterEach } from 'vitest';
import { clientIp } from './client-ip';

function req(headers: Record<string, string>): Request {
  return new Request('http://localhost/api', { headers });
}

const ORIGINAL = process.env.TRUSTED_PROXY_COUNT;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.TRUSTED_PROXY_COUNT;
  else process.env.TRUSTED_PROXY_COUNT = ORIGINAL;
});

describe('clientIp — no trusted proxy configured (default)', () => {
  it('ignores any attacker-supplied header and returns a single stable key', () => {
    delete process.env.TRUSTED_PROXY_COUNT;
    const a = clientIp(req({ 'x-forwarded-for': '1.2.3.4' }));
    const b = clientIp(req({ 'x-forwarded-for': '9.9.9.9' }));
    const c = clientIp(req({ 'x-real-ip': '5.5.5.5' }));
    expect(a).toBe('unknown');
    expect(b).toBe('unknown');
    expect(c).toBe('unknown');
  });

  it('treats an explicit 0 as no trusted proxy', () => {
    process.env.TRUSTED_PROXY_COUNT = '0';
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4' }))).toBe('unknown');
  });
});

describe('clientIp — one trusted proxy (nginx)', () => {
  it('takes the right-most hop appended by our proxy', () => {
    process.env.TRUSTED_PROXY_COUNT = '1';
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('cannot be spoofed by prepending fake hops', () => {
    process.env.TRUSTED_PROXY_COUNT = '1';
    // Client sends "1.2.3.4"; nginx appends the real peer 203.0.113.7.
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }))).toBe('203.0.113.7');
    // A different spoofed prefix must not move the caller to another bucket.
    expect(clientIp(req({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip when the forwarded chain is absent', () => {
    process.env.TRUSTED_PROXY_COUNT = '1';
    expect(clientIp(req({ 'x-real-ip': '198.51.100.9' }))).toBe('198.51.100.9');
  });

  it('normalises an IPv4 address that carries a port', () => {
    process.env.TRUSTED_PROXY_COUNT = '1';
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7:44321' }))).toBe('203.0.113.7');
  });

  it('returns unknown when the chain is shorter than the trusted count', () => {
    process.env.TRUSTED_PROXY_COUNT = '2';
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7' }))).toBe('unknown');
  });
});

describe('clientIp — two trusted proxies (CDN + nginx)', () => {
  it('takes the address the outermost trusted proxy saw', () => {
    process.env.TRUSTED_PROXY_COUNT = '2';
    // Client spoof "1.2.3.4", CDN appends 198.51.100.1, nginx appends 10.0.0.5.
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 198.51.100.1, 10.0.0.5' }))).toBe('198.51.100.1');
  });
});
