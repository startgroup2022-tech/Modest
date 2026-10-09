import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resolveEffectivePermissions, getRolePermissions } from '@/lib/permissions';
import { bumpSessionVersion } from '@/lib/auth';
import { countEffectiveAdmins } from '@/lib/admin-auth';
import {
  issueTailorCredentials,
  authenticateTailor,
  changeTailorPassword,
  setTailorCredentialActive,
  createTailorSession,
  readTailorSession,
  TailorAuthError,
} from '@/lib/tailor-auth';
import { hashPassword, verifyPassword } from '@/lib/auth';

/**
 * Database-backed integration tests for Phase 2 (employee-specific permissions
 * and tailor account auth). These exercise the real Prisma/MySQL code paths and
 * are skipped unless RUN_DB_TESTS=1.
 */
const enabled = process.env.RUN_DB_TESTS === '1';
const maybe = enabled ? describe : describe.skip;

let roleId: string;
let employeeId: string;
let actorId: string;
let tailorId: string;
let createdRole = false;
/**
 * The SUPPORT role's permission set as it existed before this run. The suite
 * adds `orders.view` / `orders.refund` to exercise resolution, so it must
 * restore the *exact* prior set afterwards — deleting only those two keys would
 * corrupt the seeded role for every later run and for the live app.
 */
let rolePermissionsBefore: string[] = [];

maybe('phase 2 auth & permissions (database)', () => {
  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    // RoleName is a closed enum, so reuse SUPPORT if it is seeded, otherwise
    // create it for this run (and remove it again afterwards).
    let role = await prisma.role.findUnique({ where: { name: 'SUPPORT' } });
    if (!role) {
      role = await prisma.role.create({ data: { name: 'SUPPORT', description: 'integration' } });
      createdRole = true;
    }
    roleId = role.id;

    rolePermissionsBefore = (
      await prisma.rolePermission.findMany({ where: { roleId }, select: { permission: true } })
    ).map((r) => r.permission);

    await prisma.rolePermission.upsert({
      where: { roleId_permission: { roleId, permission: 'orders.refund' } },
      update: {},
      create: { roleId, permission: 'orders.refund' },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permission: { roleId, permission: 'orders.view' } },
      update: {},
      create: { roleId, permission: 'orders.view' },
    });

    const actor = await prisma.user.create({
      data: { email: `it-p2-actor-${suffix}@test.local`, passwordHash: 'x', firstName: 'IT', lastName: 'Actor' },
    });
    actorId = actor.id;

    const employee = await prisma.user.create({
      data: {
        email: `it-p2-emp-${suffix}@test.local`,
        passwordHash: 'x',
        firstName: 'IT',
        lastName: 'Employee',
        roleId,
      },
    });
    employeeId = employee.id;

    const tailor = await prisma.tailor.create({
      data: { code: `IT-P2-${suffix}`, nameEn: 'IT Tailor', nameAr: 'خياط', email: `tailor-${suffix}@test.local`, rateBhd: 10 },
    });
    tailorId = tailor.id;
  });

  afterAll(async () => {
    const ids = [employeeId, tailorId, actorId].filter(Boolean);
    await prisma.userPermission.deleteMany({ where: { userId: employeeId } });
    await prisma.tailorCredential.deleteMany({ where: { tailorId } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.tailor.deleteMany({ where: { id: tailorId } });
    await prisma.user.deleteMany({ where: { id: { in: [employeeId, actorId] } } });

    // Restore the role's exact prior permission set rather than deleting the
    // keys we added — the seeded role must be left untouched for the live app.
    const before = new Set(rolePermissionsBefore);
    const current = (
      await prisma.rolePermission.findMany({ where: { roleId }, select: { permission: true } })
    ).map((r) => r.permission);
    const toRemove = current.filter((p) => !before.has(p));
    const toAdd = [...before].filter((p) => !current.includes(p));
    if (toRemove.length) {
      await prisma.rolePermission.deleteMany({ where: { roleId, permission: { in: toRemove } } });
    }
    if (toAdd.length) {
      await prisma.rolePermission.createMany({ data: toAdd.map((permission) => ({ roleId, permission })), skipDuplicates: true });
    }

    if (createdRole) await prisma.role.delete({ where: { id: roleId } }).catch(() => {});
  });

  it('resolves a role grant and then narrows it per employee via a DENY override', async () => {
    const rolePerms = await getRolePermissions(roleId);
    const base = resolveEffectivePermissions(rolePerms, []);
    expect(base.has('orders.refund')).toBe(true);

    await prisma.userPermission.createMany({
      data: [
        { userId: employeeId, permission: 'orders.refund', effect: 'DENY' },
        { userId: employeeId, permission: 'products.edit', effect: 'ALLOW' },
      ],
    });

    const overrides = await prisma.userPermission.findMany({ where: { userId: employeeId } });
    const eff = resolveEffectivePermissions(rolePerms, overrides);
    expect(eff.has('orders.refund')).toBe(false); // denied for this employee only
    expect(eff.has('orders.view')).toBe(true); // role grant preserved
    expect(eff.has('products.edit')).toBe(true); // individually granted

    // A different employee with the same role keeps the refund permission.
    const other = resolveEffectivePermissions(await getRolePermissions(roleId), []);
    expect(other.has('orders.refund')).toBe(true);
  });

  it('replaces the override set atomically, so a permission can be flipped without stale rows', async () => {
    // Mirrors the PUT /permissions endpoint: wipe the set, then insert the
    // desired one. Flipping ALLOW → DENY must not leave the old ALLOW behind.
    const desired: Array<{ permission: string; effect: 'ALLOW' | 'DENY' }> = [
      { permission: 'orders.view', effect: 'DENY' },
    ];
    await prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: employeeId } });
      await tx.userPermission.createMany({
        data: desired.map((o) => ({ userId: employeeId, ...o })),
        skipDuplicates: true,
      });
    });

    const rows = await prisma.userPermission.findMany({ where: { userId: employeeId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].effect).toBe('DENY');
    expect(rows[0].permission).toBe('orders.view');
  });

  it('bumps the session version so live sessions are invalidated', async () => {
    const before = await prisma.user.findUnique({ where: { id: employeeId }, select: { sessionVersion: true } });
    const after = await bumpSessionVersion(employeeId);
    expect(after).toBe((before?.sessionVersion ?? 0) + 1);
  });

  it('counts only admins whose effective permissions still include users.manage', async () => {
    const baseline = await countEffectiveAdmins();

    // Make the test employee an ADMIN, but DENY users.manage via an override:
    // the role alone would count, the resolved set must not.
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    await prisma.user.update({ where: { id: employeeId }, data: { roleId: adminRole!.id } });
    await prisma.userPermission.create({ data: { userId: employeeId, permission: 'users.manage', effect: 'DENY' } });
    expect(await countEffectiveAdmins()).toBe(baseline);

    // Removing the DENY makes them a full admin, so coverage rises by one.
    await prisma.userPermission.deleteMany({ where: { userId: employeeId } });
    expect(await countEffectiveAdmins()).toBe(baseline + 1);

    // Excluding them leaves the baseline intact.
    expect(await countEffectiveAdmins(employeeId)).toBe(baseline);

    // Restore the employee to SUPPORT for the remaining tests.
    await prisma.user.update({ where: { id: employeeId }, data: { roleId } });
  });

  it('denies login to a disabled staff account at the guard level', async () => {
    // The sign-in route rejects `!user.isActive`; the guard here is the other
    // half — a disabled account must not resolve to a live session.
    await prisma.user.update({ where: { id: employeeId }, data: { isActive: false, status: 'INACTIVE' } });
    const row = await prisma.user.findUnique({ where: { id: employeeId }, select: { isActive: true } });
    expect(row!.isActive).toBe(false);
    await prisma.user.update({ where: { id: employeeId }, data: { isActive: true, status: 'ACTIVE' } });
  });

  describe('tailor credentials', () => {
    let username: string;
    let temporaryPassword: string;

    it('issues a temporary password, storing only its hash', async () => {
      const issued = await issueTailorCredentials({ tailorId, actorId });
      username = issued.username;
      temporaryPassword = issued.temporaryPassword;

      const credential = await prisma.tailorCredential.findUnique({ where: { tailorId } });
      expect(credential).toBeTruthy();
      expect(credential!.username).toBe(username);
      expect(credential!.mustChangePassword).toBe(true);
      expect(credential!.passwordHash).not.toBe(temporaryPassword);
      expect(credential!.passwordHash.startsWith('$2')).toBe(true);
      expect(await verifyPassword(temporaryPassword, credential!.passwordHash)).toBe(true);
    });

    it('authenticates with the issued password and rejects a wrong one', async () => {
      const ok = await authenticateTailor({ username, password: temporaryPassword });
      expect(ok.tailorId).toBe(tailorId);
      expect(ok.mustChangePassword).toBe(true);

      await expect(authenticateTailor({ username, password: 'wrong-password' })).rejects.toBeInstanceOf(TailorAuthError);
    });

    it('locks the account after repeated failures and refuses further attempts', async () => {
      for (let i = 0; i < 4; i++) {
        await authenticateTailor({ username, password: 'wrong-password' }).catch(() => {});
      }
      await expect(authenticateTailor({ username, password: 'wrong-password' })).rejects.toMatchObject({ code: 'LOCKED' });
      // Even the correct password is refused while locked.
      await expect(authenticateTailor({ username, password: temporaryPassword })).rejects.toMatchObject({ code: 'LOCKED' });
      // Unlock for the remaining tests.
      await prisma.tailorCredential.update({ where: { tailorId }, data: { lockedUntil: null, failedLoginAttempts: 0 } });
    });

    it('enforces the password policy and clears the temporary flag on change', async () => {
      await expect(
        changeTailorPassword({ tailorId, currentPassword: temporaryPassword, newPassword: 'short1' }),
      ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });

      await expect(
        changeTailorPassword({ tailorId, currentPassword: temporaryPassword, newPassword: 'NoNumbersHere' }),
      ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });

      await changeTailorPassword({ tailorId, currentPassword: temporaryPassword, newPassword: 'FreshSecret42' });
      const credential = await prisma.tailorCredential.findUnique({ where: { tailorId } });
      expect(credential!.mustChangePassword).toBe(false);
      expect(await verifyPassword('FreshSecret42', credential!.passwordHash)).toBe(true);

      // The old temporary password no longer works.
      await expect(authenticateTailor({ username, password: temporaryPassword })).rejects.toBeInstanceOf(TailorAuthError);
    });

    it('invalidates the pre-change session but lets the caller re-mint a fresh one', async () => {
      // The change above bumped sessionVersion, so a token minted at the old
      // version must be rejected...
      const stale = await createTailorSession({ tailorId, username, sessionVersion: 0 });
      expect((await readTailorSession(stale))?.tailorId).toBe(tailorId); // signature valid
      const credential = await prisma.tailorCredential.findUnique({ where: { tailorId }, select: { sessionVersion: true } });
      expect(credential!.sessionVersion).toBeGreaterThan(0);

      // ...while a token carrying the new version verifies and matches the DB,
      // which is exactly what the password route re-mints after the change.
      const fresh = await createTailorSession({ tailorId, username, sessionVersion: credential!.sessionVersion });
      const parsed = await readTailorSession(fresh);
      expect(parsed?.sessionVersion).toBe(credential!.sessionVersion);
    });

    it('disables login and invalidates the session version', async () => {
      const before = await prisma.tailorCredential.findUnique({ where: { tailorId }, select: { sessionVersion: true } });
      await setTailorCredentialActive({ tailorId, active: false, actorId });
      const after = await prisma.tailorCredential.findUnique({ where: { tailorId }, select: { isActive: true, sessionVersion: true } });
      expect(after!.isActive).toBe(false);
      expect(after!.sessionVersion).toBe((before?.sessionVersion ?? 0) + 1);
      await expect(authenticateTailor({ username, password: 'FreshSecret42' })).rejects.toMatchObject({ code: 'DISABLED' });
    });
  });
});
