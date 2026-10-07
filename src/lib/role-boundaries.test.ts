import { describe, it, expect } from 'vitest';
import { isStaff } from './admin-auth';
import { isAdminRole } from './auth';
import { DEFAULT_ROLE_PERMISSIONS } from './permission-defs';

/**
 * Phase 2 — role-confusion regression. Staff, tailor and customer are three
 * distinct principals; a session of one kind must never satisfy another kind's
 * guard, and a role name must never be sufficient on its own.
 */

describe('customer cannot reach the admin area', () => {
  it('a customer session is never staff, even if the role is mislabelled', () => {
    expect(isStaff({ role: 'CUSTOMER', sessionKind: 'customer' })).toBe(false);
    expect(isStaff({ role: 'ADMIN', sessionKind: 'customer' })).toBe(false);
    expect(isStaff({ role: 'CUSTOMER', sessionKind: 'staff' })).toBe(false);
  });

  it('customer and tailor role templates carry no staff permissions', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.CUSTOMER).toEqual([]);
    expect(DEFAULT_ROLE_PERMISSIONS.TAILOR).toEqual([]);
  });
});

describe('tailor cannot reach the admin area', () => {
  it('a tailor session is never staff', () => {
    expect(isStaff({ role: 'TAILOR', sessionKind: 'tailor' })).toBe(false);
    expect(isStaff({ role: 'ADMIN', sessionKind: 'tailor' })).toBe(false);
  });

  it('a tailor cannot be signed in through the staff sign-in path', () => {
    // The sign-in route refuses a TAILOR-role user outright; the role helper
    // used by that route must not classify it as admin.
    expect(isAdminRole('TAILOR')).toBe(false);
  });
});

describe('staff classification is role + kind, never kind alone', () => {
  it('accepts the three staff roles with a staff or legacy (undefined) kind', () => {
    for (const role of ['ADMIN', 'MANAGER', 'SUPPORT']) {
      expect(isStaff({ role })).toBe(true);
      expect(isStaff({ role, sessionKind: 'staff' })).toBe(true);
      expect(isAdminRole(role)).toBe(true);
    }
  });

  it('rejects a customer-role session that claims staff kind', () => {
    // Belt and braces: kind says staff but the role is not a staff role.
    expect(isStaff({ role: 'CUSTOMER', sessionKind: 'staff' })).toBe(false);
  });
});
