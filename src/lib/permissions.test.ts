import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  ALL_PERMISSIONS,
  PERMISSION_COUNT,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  isPermission,
  type Permission,
} from './permission-defs';
import {
  resolveEffectivePermissions,
  canAdministerPermission,
  forbiddenGrants,
} from './permissions';

/**
 * Phase 2 — effective permission model. These are pure-function tests; the
 * DB-backed integration tests live in `phase2-auth.integration.test.ts`.
 */

describe('permission registry', () => {
  it('has a stable, non-empty catalogue with unique keys', () => {
    expect(PERMISSION_COUNT).toBe(ALL_PERMISSIONS.length);
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
    expect(PERMISSION_COUNT).toBeGreaterThanOrEqual(35);
  });

  it('gives every permission an English and Arabic label and a known group', () => {
    const groupKeys = new Set(PERMISSION_GROUPS.map((g) => g.key));
    for (const [key, def] of Object.entries(PERMISSIONS)) {
      expect(def.en.length, key).toBeGreaterThan(0);
      expect(def.ar.length, key).toBeGreaterThan(0);
      expect(groupKeys.has(def.group), `${key} group ${def.group}`).toBe(true);
    }
  });

  it('covers the operating-specification permission areas', () => {
    const required: Permission[] = [
      'dashboard.view',
      'orders.view', 'orders.edit', 'orders.assign', 'orders.create',
      'customers.view', 'customers.edit',
      'products.view', 'products.edit', 'products.approve',
      'tailors.manage',
      'qc.manage',
      'payments.view', 'payments.send', 'orders.refund',
      'settlements.view', 'settlements.manage',
      'expenses.view', 'expenses.manage', 'expenses.approve', 'expenses.delete',
      'reports.view', 'reports.profits',
      'promotions.view', 'promotions.create', 'promotions.edit', 'promotions.toggle', 'promotions.usage',
      'users.manage',
      'notifications.manage',
      'audit.view',
      'website.manage',
      'settings.edit',
    ];
    for (const p of required) expect(isPermission(p), p).toBe(true);
  });

  it('keeps ADMIN as the full set and CUSTOMER/TAILOR empty', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN.length).toBe(PERMISSION_COUNT);
    expect(DEFAULT_ROLE_PERMISSIONS.CUSTOMER).toEqual([]);
    expect(DEFAULT_ROLE_PERMISSIONS.TAILOR).toEqual([]);
  });

  it('never derives authorization from a display label', () => {
    // Keys are machine strings; labels are translations. Renaming a label must
    // not be possible through the key space.
    for (const key of ALL_PERMISSIONS) {
      expect(key).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });
});

describe('resolveEffectivePermissions', () => {
  it('returns the role grants when there are no overrides', () => {
    const eff = resolveEffectivePermissions(['orders.view', 'orders.edit'], []);
    expect([...eff].sort()).toEqual(['orders.edit', 'orders.view']);
  });

  it('adds ALLOW overrides on top of the role', () => {
    const eff = resolveEffectivePermissions(['orders.view'], [{ permission: 'products.edit', effect: 'ALLOW' }]);
    expect(eff.has('products.edit')).toBe(true);
    expect(eff.has('orders.view')).toBe(true);
  });

  it('lets a DENY override beat a role grant', () => {
    const eff = resolveEffectivePermissions(
      ['orders.view', 'orders.edit'],
      [{ permission: 'orders.edit', effect: 'DENY' }],
    );
    expect(eff.has('orders.edit')).toBe(false);
    expect(eff.has('orders.view')).toBe(true);
  });

  it('lets DENY beat an ALLOW override for the same permission', () => {
    const eff = resolveEffectivePermissions(
      [],
      [
        { permission: 'orders.refund', effect: 'ALLOW' },
        { permission: 'orders.refund', effect: 'DENY' },
      ],
    );
    expect(eff.has('orders.refund')).toBe(false);
  });

  it('ignores unknown permission keys', () => {
    const eff = resolveEffectivePermissions(['orders.view'], [{ permission: 'not.a.permission', effect: 'ALLOW' }]);
    expect(eff.size).toBe(1);
    expect(eff.has('not.a.permission' as Permission)).toBe(false);
  });

  it('lets two employees with the same role have different effective permissions', () => {
    const role = ['orders.view', 'orders.edit', 'orders.refund'];
    const employeeA = resolveEffectivePermissions(role, []);
    const employeeB = resolveEffectivePermissions(role, [
      { permission: 'orders.refund', effect: 'DENY' },
      { permission: 'products.edit', effect: 'ALLOW' },
    ]);
    expect(employeeA.has('orders.refund')).toBe(true);
    expect(employeeB.has('orders.refund')).toBe(false);
    expect(employeeB.has('products.edit')).toBe(true);
    expect(employeeA.has('products.edit')).toBe(false);
  });
});

describe('privilege-escalation guard', () => {
  const manager = { role: 'MANAGER', permissions: new Set<Permission>(['orders.view', 'users.manage']) };

  it('lets a super-admin administer any permission', () => {
    const admin = { role: 'ADMIN', permissions: new Set<Permission>([]) };
    expect(canAdministerPermission(admin, 'settings.edit')).toBe(true);
  });

  it('stops a non-super-admin from granting a permission they lack', () => {
    expect(canAdministerPermission(manager, 'orders.view')).toBe(true);
    expect(canAdministerPermission(manager, 'settings.edit')).toBe(false);
  });

  it('lists exactly the forbidden grants', () => {
    expect(forbiddenGrants(manager, ['orders.view', 'settings.edit', 'audit.view'])).toEqual([
      'settings.edit',
      'audit.view',
    ]);
  });
});
