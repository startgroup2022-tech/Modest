import { describe, it, expect } from 'vitest';
import {
  generateTemporaryPassword,
  usernameFromTailor,
  checkTailorPassword,
  canActAsTailor,
  buildSupervisorContext,
  resolveReadableTailorId,
  canWriteTailorWork,
  canReadTailorTask,
} from './tailor-auth';

/** Phase 2 — tailor credential and password-policy rules (pure functions). */

describe('generateTemporaryPassword', () => {
  it('is 12 characters and contains at least one digit', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTemporaryPassword();
      expect(pw).toHaveLength(12);
      expect(/\d/.test(pw)).toBe(true);
      expect(/[A-Za-z]/.test(pw)).toBe(true);
    }
  });

  it('is not trivially predictable — consecutive values differ', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(generateTemporaryPassword());
    expect(seen.size).toBe(20);
  });
});

describe('usernameFromTailor', () => {
  it('prefers the email local-part', () => {
    expect(usernameFromTailor({ email: 'Atelier.A@Example.com', nameEn: 'Atelier A' })).toBe('atelier.a');
  });
  it('falls back to the code, slugified', () => {
    expect(usernameFromTailor({ code: 'TL-001', nameEn: 'Atelier A' })).toBe('tl-001');
  });
  it('falls back to the name when neither email nor code is present', () => {
    expect(usernameFromTailor({ nameEn: 'Atelier A — Abayas' })).toBe('atelier-a-abayas');
  });
});

describe('checkTailorPassword policy', () => {
  const current = 'TempPass1234';
  it('rejects a password shorter than 8 characters', () => {
    expect(checkTailorPassword('Ab1', current).ok).toBe(false);
  });
  it('rejects a password with no number', () => {
    const r = checkTailorPassword('abcdefghij', current);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/number/i);
  });
  it('rejects a password identical to the temporary one', () => {
    expect(checkTailorPassword(current, current).ok).toBe(false);
  });
  it('accepts a compliant password', () => {
    expect(checkTailorPassword('NewSecret99', current).ok).toBe(true);
  });
});

describe('supervisor context', () => {
  it('is always read-only and never replaces the tailor identity', () => {
    const ctx = buildSupervisorContext({ supervisorId: 'u1', supervisorName: 'Manager', viewingTailorId: 't1' });
    expect(ctx.readOnly).toBe(true);
    expect(ctx.viewingTailorId).toBe('t1');
    expect(ctx.supervisorId).toBe('u1');
  });

  it('refuses tailor write actions in supervisor mode', () => {
    const ctx = buildSupervisorContext({ supervisorId: 'u1', supervisorName: 'Manager', viewingTailorId: 't1' });
    expect(canActAsTailor(ctx)).toBe(false);
    expect(canActAsTailor(null)).toBe(false);
    // A genuine tailor context (no readOnly flag) may act.
    expect(canActAsTailor({})).toBe(true);
  });
});

describe('tailor work scope', () => {
  const tailor = { tailorId: 't1' };

  it('lets a tailor read their own work but not another tailor’s', () => {
    expect(resolveReadableTailorId(tailor, 't1')).toBe('t1');
    expect(resolveReadableTailorId(tailor, 't2')).toBeNull();
  });

  it('refuses a tailor write on another tailor’s work', () => {
    expect(canWriteTailorWork(tailor, 't1')).toBe(true);
    expect(canWriteTailorWork(tailor, 't2')).toBe(false);
  });

  it('lets a supervisor read the tailor they view but never write', () => {
    const supervisor = {
      tailorId: 'staff-1',
      supervisor: buildSupervisorContext({ supervisorId: 'u1', supervisorName: 'Manager', viewingTailorId: 't1' }),
    };
    expect(resolveReadableTailorId(supervisor, 't1')).toBe('t1');
    expect(resolveReadableTailorId(supervisor, 't2')).toBeNull();
    expect(canWriteTailorWork(supervisor, 't1')).toBe(false);
    expect(canWriteTailorWork(supervisor, 'staff-1')).toBe(false);
  });

  it('refuses a task with no assigned tailor', () => {
    expect(canReadTailorTask(tailor, null)).toBe(false);
    expect(canReadTailorTask(tailor, undefined)).toBe(false);
    expect(canReadTailorTask(tailor, 't1')).toBe(true);
  });
});
