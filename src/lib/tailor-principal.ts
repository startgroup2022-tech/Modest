import 'server-only';
import { NextResponse } from 'next/server';
import { getCurrentTailor, buildSupervisorContext, type CurrentTailor, type TailorPrincipal } from './tailor-auth';
import { getAdminUser, type AdminUser } from './admin-auth';
import { isSameOriginRequest, CSRF_ERROR } from './csrf';
import { TailorWorkError } from './tailor-work';
import { SettlementError } from './settlements';
import type { Permission } from './permissions';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Resolves *who* is asking to see the Tailor Portal, and under what authority.
 *
 * Two principals may reach the portal:
 *  - the tailor themselves (read + write, own work only);
 *  - an authorised staff member acting as a read-only supervisor (read only).
 *
 * A supervisor is never represented as the tailor. The identity stays with the
 * staff user and the `readOnly` flag is carried separately, so every write path
 * is refused structurally rather than by a screen-level check.
 *
 * This is the single place the portal resolves scope; the API and the pages
 * both go through it so the rule cannot drift between them.
 */

export interface TailorAccess {
  principal: TailorPrincipal;
  /** The tailor whose data this request may touch. */
  tailorId: string;
  /** Display name for the portal header. */
  nameEn: string;
  nameAr: string;
  code: string | null;
  /** True when the visitor is a tailor (may write); false for a supervisor. */
  canWrite: boolean;
  supervisor: AdminUser | null;
  mustChangePassword: boolean;
}

/** Permission a staff member needs to open the read-only supervisor view. */
export const SUPERVISOR_PERMISSION: Permission = 'tailors.view';

function fromTailor(tailor: CurrentTailor): TailorAccess {
  return {
    principal: { tailorId: tailor.id },
    tailorId: tailor.id,
    nameEn: tailor.nameEn,
    nameAr: tailor.nameAr,
    code: tailor.code,
    canWrite: true,
    supervisor: null,
    mustChangePassword: tailor.mustChangePassword,
  };
}

async function fromSupervisor(admin: AdminUser, viewingTailorId: string): Promise<TailorAccess | null> {
  if (!admin.permissions.has(SUPERVISOR_PERMISSION)) return null;
  const tailor = await getTailorSummary(viewingTailorId);
  if (!tailor) return null;
  return {
    principal: {
      tailorId: viewingTailorId,
      supervisor: buildSupervisorContext({
        supervisorId: admin.id,
        supervisorName: [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email,
        viewingTailorId,
      }),
    },
    tailorId: viewingTailorId,
    nameEn: tailor.nameEn,
    nameAr: tailor.nameAr,
    code: tailor.code,
    canWrite: false,
    supervisor: admin,
    mustChangePassword: false,
  };
}

async function getTailorSummary(tailorId: string) {
  const { prisma } = await import('./prisma');
  return prisma.tailor.findUnique({
    where: { id: tailorId },
    select: { nameEn: true, nameAr: true, code: true, status: true },
  });
}

/**
 * Resolves portal access for a page/route. `requestedTailorId` is only honoured
 * for supervisors; a tailor is always pinned to their own id.
 *
 * Returns null when the visitor is neither a signed-in tailor nor an authorised
 * supervisor — callers redirect to sign-in.
 */
export async function resolveTailorAccess(requestedTailorId?: string | null): Promise<TailorAccess | null> {
  const tailor = await getCurrentTailor();
  if (tailor) return fromTailor(tailor);

  const admin = await getAdminUser();
  if (admin && requestedTailorId) return fromSupervisor(admin, requestedTailorId);

  return null;
}

export type ApiPrincipal =
  | { ok: true; access: TailorAccess }
  | { ok: false; error: NextResponse };

/**
 * API-level resolution. Tailors resolve to themselves; a supervisor must name
 * the tailor they are viewing. Anonymous callers get 401.
 */
export async function resolveTailorApiPrincipal(requestedTailorId?: string | null): Promise<ApiPrincipal> {
  const access = await resolveTailorAccess(requestedTailorId);
  if (!access) {
    const tailor = await getCurrentTailor();
    const admin = await getAdminUser();
    if (!tailor && !admin) return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    return { ok: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, access };
}

/** Refuses a write action attempted by a read-only supervisor. */
export function supervisorWriteRefusal(access: TailorAccess): NextResponse | null {
  if (access.canWrite) return null;
  return NextResponse.json(
    { error: 'Supervisors have read-only access to the Tailor Portal', code: 'SUPERVISOR_READ_ONLY' },
    { status: 403 },
  );
}

/**
 * Shared entry point for Tailor Portal write endpoints: enforces the CSRF
 * origin check, resolves the principal, and refuses read-only supervisors.
 * Returns the resolved access on success, or a ready-made error response.
 */
export async function guardTailorWrite(
  req: Request,
  requestedTailorId?: string | null,
): Promise<{ access: TailorAccess } | { error: NextResponse }> {
  if (!SAFE_METHODS.has(req.method.toUpperCase()) && !isSameOriginRequest(req)) {
    return { error: NextResponse.json({ error: CSRF_ERROR, code: 'CSRF_BLOCKED' }, { status: 403 }) };
  }
  const resolved = await resolveTailorApiPrincipal(requestedTailorId);
  if (!resolved.ok) return { error: resolved.error };
  const refusal = supervisorWriteRefusal(resolved.access);
  if (refusal) return { error: refusal };
  return { access: resolved.access };
}

/** Maps domain errors to JSON responses; rethrows anything unrecognised. */
export function tailorErrorResponse(err: unknown): NextResponse {
  if (err instanceof TailorWorkError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof SettlementError) {
    const status = err.status || (err.code === 'INVALID_TRANSITION' ? 409 : 422);
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  throw err;
}
