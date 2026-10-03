import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { adminHandler, AdminActionError, type AdminUser } from '../admin-auth';

/**
 * Generic CRUD plumbing shared by the catalogue, CRM, production, finance and
 * content modules. Keeping one implementation means every module inherits the
 * same validation, permission checks and audit behaviour.
 */

export interface CrudConfig {
  model: string;
  entity: string;
  /** Permission required to read. */
  viewPermission?: string;
  createPermission?: string;
  updatePermission?: string;
  deletePermission?: string;
  createSchema?: z.ZodTypeAny;
  updateSchema?: z.ZodTypeAny;
  /** Fields that must never be written from a client payload. */
  protectedFields?: string[];
}

function stripProtected(data: Record<string, unknown>, protectedFields: string[] = []) {
  const out = { ...data };
  for (const f of protectedFields) delete out[f];
  delete out.id;
  delete out.createdAt;
  delete out.updatedAt;
  return out;
}

type AnyDelegate = any;

function delegate(model: string): AnyDelegate {
    return (prisma as any)[model];
}

/**
 * Builds POST/PATCH/DELETE handlers for a resource. `idFromRequest` extracts
 * the record id from the URL for PATCH and DELETE.
 */
export function crudHandlers(config: CrudConfig) {
  const { model, entity } = config;
  const protectedFields = config.protectedFields ?? [];

  const create = adminHandler(config.createPermission as never, async ({ admin, req }) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const schema = config.createSchema ?? z.record(z.string(), z.unknown());
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
    }
    const data = stripProtected(parsed.data as Record<string, unknown>, protectedFields);
    const row = await delegate(model).create({ data });
    await audit(admin, `${entity.toLowerCase()}.create`, entity, row.id, data);
    return NextResponse.json({ ok: true, id: row.id, row });
  });

  const update = adminHandler(config.updatePermission as never, async ({ admin, req }) => {
    const id = idFromRequest(req);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const schema = config.updateSchema ?? config.createSchema ?? z.record(z.string(), z.unknown());
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
    }
    const data = stripProtected(parsed.data as Record<string, unknown>, protectedFields);
    const row = await delegate(model).update({ where: { id }, data });
    await audit(admin, `${entity.toLowerCase()}.update`, entity, id, data);
    return NextResponse.json({ ok: true, id, row });
  });

  const remove = adminHandler(config.deletePermission as never, async ({ admin, req }) => {
    const id = idFromRequest(req);
    const existing = await delegate(model).findUnique({ where: { id } });
    if (!existing) throw new AdminActionError('Record not found', 'NOT_FOUND', 404);
    await delegate(model).delete({ where: { id } });
    await audit(admin, `${entity.toLowerCase()}.delete`, entity, id, {});
    return NextResponse.json({ ok: true });
  });

  return { create, update, remove };
}

function idFromRequest(req: Request): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

async function audit(admin: AdminUser, action: string, entity: string, entityId: string, metadata: unknown) {
  await prisma.auditLog.create({
    data: { userId: admin.id, action, entity, entityId, metadata: metadata as Prisma.InputJsonValue },
  });
}

/** Re-exported so resource routes can share the id extraction. */
export { idFromRequest };

/* ── List query helpers ──────────────────────────────────── */

export interface ListParams {
  q?: string | null;
  page?: string | null;
  perPage?: number;
  searchFields?: string[];
  status?: string | null;
  statusField?: string;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export async function listResource(model: string, params: ListParams) {
  const perPage = params.perPage ?? 20;
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const where: Record<string, unknown> = {};
  if (params.q && params.searchFields?.length) {
    where.OR = params.searchFields.map((f) => ({ [f]: { contains: params.q } }));
  }
  if (params.status && params.status !== 'ALL' && params.statusField) {
    where[params.statusField] = params.status;
  }
  const [rows, total] = await Promise.all([
    delegate(model).findMany({
      where,
      orderBy: params.orderBy ?? { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    delegate(model).count({ where }),
  ]);
  return {
    rows,
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}
