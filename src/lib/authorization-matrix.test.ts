import { describe, it, expect, beforeAll } from 'vitest';
import {
  resolveEffectivePermissions,
  canAdministerPermission,
  forbiddenGrants,
  productStatusChangeRequiresApproval,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type Permission,
} from './permissions';

/**
 * Phase 2 — authorization matrix (pure policy layer).
 *
 * These tests encode the rule that authorization is derived from an employee's
 * *effective* permissions, never from a job title or role name, and that a
 * permission only becomes an enforced boundary when a route actually consults
 * it. The HTTP-level proof of the server-side checks lives in the live smoke
 * tests described in the Phase 2 report; here we lock the decision functions
 * that those routes call.
 */

describe('employee-specific effective permissions', () => {
  it('gives two employees with the same role/title different effective sets', () => {
    // Two "Sales Employee" staff on the same role template.
    const role = DEFAULT_ROLE_PERMISSIONS.SUPPORT;
    const alice = resolveEffectivePermissions(role, []);
    const bob = resolveEffectivePermissions(role, [
      { permission: 'orders.refund', effect: 'ALLOW' }, // trusted with refunds
      { permission: 'customers.view', effect: 'DENY' }, // not trusted with PII
    ]);

    // Same title, different authority.
    expect(alice.has('orders.refund')).toBe(false);
    expect(bob.has('orders.refund')).toBe(true);
    expect(alice.has('customers.view')).toBe(true);
    expect(bob.has('customers.view')).toBe(false);
    expect(alice.has('orders.view')).toBe(bob.has('orders.view')); // shared baseline
  });

  it('denies by default — a permission absent from role and overrides is off', () => {
    const eff = resolveEffectivePermissions(['orders.view'], []);
    expect(eff.has('settlements.manage')).toBe(false);
    expect(eff.has('settings.edit')).toBe(false);
    expect(eff.has('users.manage')).toBe(false);
  });

  it('lets DENY override beat a role grant and an ALLOW override', () => {
    const eff = resolveEffectivePermissions(
      ['expenses.view', 'expenses.manage'],
      [
        { permission: 'expenses.manage', effect: 'DENY' },
        { permission: 'expenses.approve', effect: 'ALLOW' },
        { permission: 'expenses.approve', effect: 'DENY' },
      ],
    );
    expect(eff.has('expenses.manage')).toBe(false);
    expect(eff.has('expenses.approve')).toBe(false);
    expect(eff.has('expenses.view')).toBe(true);
  });
});

describe('privilege escalation guard', () => {
  it('stops a manager from granting themselves a permission they lack', () => {
    const manager = { role: 'MANAGER', permissions: new Set<Permission>(['orders.view', 'users.manage']) };
    // Attempting to grant a permission the manager does not hold is refused.
    expect(forbiddenGrants(manager, ['settings.edit'])).toEqual(['settings.edit']);
    expect(canAdministerPermission(manager, 'settings.edit')).toBe(false);
  });

  it('stops a manager from escalating a peer beyond their own authority', () => {
    const manager = { role: 'MANAGER', permissions: new Set<Permission>(['orders.view']) };
    const attempted = ['orders.view', 'roles.manage', 'audit.view'];
    expect(forbiddenGrants(manager, attempted)).toEqual(['roles.manage', 'audit.view']);
  });

  it('lets a super-admin administer any permission', () => {
    const admin = { role: 'ADMIN', permissions: new Set<Permission>([]) };
    expect(forbiddenGrants(admin, ALL_PERMISSIONS)).toEqual([]);
  });

  it('does not treat role name alone as authority for a non-admin', () => {
    // A MANAGER-role user without the permission cannot administer it.
    const manager = { role: 'MANAGER', permissions: new Set<Permission>() };
    expect(canAdministerPermission(manager, 'users.manage')).toBe(false);
  });
});

describe('product approval gate', () => {
  it('flags any change of publish status as approval-level', () => {
    expect(productStatusChangeRequiresApproval('DRAFT', 'ACTIVE')).toBe(true);
    expect(productStatusChangeRequiresApproval('ACTIVE', 'ARCHIVED')).toBe(true);
    expect(productStatusChangeRequiresApproval('ARCHIVED', 'DRAFT')).toBe(true);
  });

  it('does not flag an edit that keeps the current status', () => {
    expect(productStatusChangeRequiresApproval('ACTIVE', 'ACTIVE')).toBe(false);
    expect(productStatusChangeRequiresApproval('DRAFT', 'DRAFT')).toBe(false);
  });
});

describe('operating-specification permission coverage', () => {
  const required: Record<string, Permission[]> = {
    'dashboard / orders': ['dashboard.view', 'orders.view', 'orders.edit', 'orders.assign', 'orders.create'],
    customers: ['customers.view', 'customers.edit'],
    products: ['products.view', 'products.edit', 'products.approve'],
    tailors: ['tailors.manage'],
    quality: ['qc.manage'],
    payments: ['payments.view', 'payments.send', 'orders.refund'],
    settlements: ['settlements.view', 'settlements.manage'],
    expenses: ['expenses.view', 'expenses.manage', 'expenses.approve', 'expenses.delete'],
    reports: ['reports.view', 'reports.profits'],
    promotions: ['promotions.view', 'promotions.create', 'promotions.edit', 'promotions.toggle', 'promotions.usage'],
    employees: ['users.manage'],
    notifications: ['notifications.manage'],
    audit: ['audit.view'],
    website: ['website.manage'],
    settings: ['settings.edit'],
  };

  it('maps every specification area to a canonical, registered key', () => {
    const registered = new Set<string>(ALL_PERMISSIONS);
    for (const [area, keys] of Object.entries(required)) {
      for (const k of keys) expect(registered.has(k), `${area} → ${k}`).toBe(true);
    }
  });

  it('exceeds the specification’s ~35 operational permissions without dropping security keys', () => {
    // The spec expects ~35; we keep the extra security-sensitive keys rather
    // than force the count down.
    expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(35);
  });
});

describe('session revocation is policy, not expiry', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-value-at-least-24-chars-long';
  });

  it('a stale session version is distinguishable from a current one', async () => {
    const { createSessionToken, readSessionToken } = await import('./auth');
    const token = await createSessionToken({ userId: 'u1', email: 'a@b.c', role: 'MANAGER', kind: 'staff', sessionVersion: 3 });
    const payload = await readSessionToken(token);
    // The guard compares this to the DB value; a bump makes them differ.
    expect(payload?.sessionVersion).toBe(3);
    expect(payload?.sessionVersion).not.toBe(4);
  });
});
