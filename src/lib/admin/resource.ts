import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { adminHandler, AdminActionError } from '../admin-auth';

type AnyDelegate = any;

function delegate(model: string): AnyDelegate {
    return (prisma as any)[model];
}

function idFrom(req: Request): string {
  return new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
}

export interface ResourceConfig {
  /** Prisma model name, e.g. 'coupon'. */
  model: string;
  entity: string;
  createPermission: string;
  updatePermission: string;
  deletePermission: string;
  schema: z.ZodTypeAny;
  /** Fields written only on create (e.g. slug auto-generation happens in route). */
  beforeCreate?: (data: Record<string, unknown>) => Record<string, unknown>;
  beforeUpdate?: (data: Record<string, unknown>, existing: Record<string, unknown>) => Record<string, unknown>;
  /** Refuse hard delete and deactivate instead when this returns > 0. */
  referencedBy?: (id: string) => Promise<number>;
  deletePermissionOverride?: string;
}

function emptyToNull(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = v === '' ? null : v;
  return out;
}

export function makeResource(config: ResourceConfig) {
  const create = adminHandler(config.createPermission as never, async ({ admin, req }) => {
    const body = await req.json().catch(() => null);
    const parsed = config.schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
    }
    const cleaned = emptyToNull(parsed.data as Record<string, unknown>);
    const data = config.beforeCreate ? config.beforeCreate(cleaned) : cleaned;
    const row = await delegate(config.model).create({ data: data as never });
    await prisma.auditLog.create({
      data: { userId: admin.id, action: `${config.entity.toLowerCase()}.create`, entity: config.entity, entityId: row.id, metadata: {} },
    });
    return NextResponse.json({ ok: true, id: row.id });
  });

  const update = adminHandler(config.updatePermission as never, async ({ admin, req }) => {
    const id = idFrom(req);
    const existing = await delegate(config.model).findUnique({ where: { id } });
    if (!existing) throw new AdminActionError('Record not found', 'NOT_FOUND', 404);
    const body = await req.json().catch(() => null);
    const parsed = config.schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
    }
    const cleaned = emptyToNull(parsed.data as Record<string, unknown>);
    const data = config.beforeUpdate ? config.beforeUpdate(cleaned, existing) : cleaned;
    await delegate(config.model).update({ where: { id }, data: data as never });
    await prisma.auditLog.create({
      data: { userId: admin.id, action: `${config.entity.toLowerCase()}.update`, entity: config.entity, entityId: id, metadata: {} },
    });
    return NextResponse.json({ ok: true, id });
  });

  const remove = adminHandler((config.deletePermissionOverride ?? config.deletePermission) as never, async ({ admin, req }) => {
    const id = idFrom(req);
    if (config.referencedBy && (await config.referencedBy(id)) > 0) {
      await delegate(config.model).update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ ok: true, deactivated: true });
    }
    await delegate(config.model).delete({ where: { id } });
    await prisma.auditLog.create({
      data: { userId: admin.id, action: `${config.entity.toLowerCase()}.delete`, entity: config.entity, entityId: id, metadata: {} },
    });
    return NextResponse.json({ ok: true });
  });

  return { create, update, remove };
}

export { emptyToNull };
export type { Prisma };
