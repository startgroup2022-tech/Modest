'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS, PERMISSION_GROUPS } from '@/lib/permission-defs';

type Effect = 'ALLOW' | 'DENY';
interface Override {
  permission: string;
  effect: Effect;
}

/**
 * Per-employee permission editor.
 *
 * Each permission shows a tri-state derived from the role template and the
 * employee's individual overrides:
 *   - role grants it, no override        → on, inherited
 *   - role grants it, DENY override      → off, revoked for this employee
 *   - role does not grant it, ALLOW      → on, granted individually
 *   - role does not grant it, no override→ off
 * Toggling only writes an override when the choice differs from the role, so
 * the override list stays minimal and role changes keep flowing through.
 */
export function EmployeePermissions({
  employeeId,
  rolePermissions,
  overrides: initialOverrides,
  actorPermissions,
  isSuperAdmin,
  locale,
}: {
  employeeId: string;
  rolePermissions: string[];
  overrides: Override[];
  actorPermissions: string[];
  isSuperAdmin: boolean;
  locale: 'en' | 'ar';
}) {
  const router = useRouter();
  const ar = locale === 'ar';
  const roleSet = useMemo(() => new Set(rolePermissions), [rolePermissions]);
  const actorSet = useMemo(() => new Set(actorPermissions), [actorPermissions]);

  const [overrides, setOverrides] = useState<Map<string, Effect>>(
    () => new Map(initialOverrides.map((o) => [o.permission, o.effect])),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOn = (p: string) => {
    const o = overrides.get(p);
    if (o === 'DENY') return false;
    if (o === 'ALLOW') return true;
    return roleSet.has(p);
  };

  const canEdit = (p: string) => isSuperAdmin || actorSet.has(p);

  const total = Object.keys(PERMISSIONS).length;
  const enabled = Object.keys(PERMISSIONS).filter((p) => isOn(p)).length;

  function toggle(p: string) {
    if (!canEdit(p)) return;
    setSaved(false);
    setOverrides((prev) => {
      const next = new Map(prev);
      const base = roleSet.has(p);
      const current = isOn(p);
      const desired = !current;
      // No override needed when the desired state matches the role template.
      if (desired === base) next.delete(p);
      else next.set(p, desired ? 'ALLOW' : 'DENY');
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = [...overrides.entries()].map(([permission, effect]) => ({ permission, effect }));
      const res = await fetch(`/api/admin/employees/${employeeId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: payload }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Save failed');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-ink-muted">
          {ar ? 'الصلاحيات المفعّلة' : 'Enabled permissions'}:{' '}
          <span className="font-medium text-ink">{enabled}</span> / {total}
        </p>
        <div className="flex items-center gap-3">
          {saved && <span className="text-caption text-success">{ar ? 'تم الحفظ' : 'Saved'}</span>}
          <button type="button" onClick={save} disabled={busy} className="adm-btn-primary adm-btn-sm">
            {busy ? (ar ? 'جارٍ الحفظ' : 'Saving') : ar ? 'حفظ الصلاحيات' : 'Save permissions'}
          </button>
        </div>
      </div>
      {error && <p className="mb-3 text-caption text-danger">{error}</p>}

      <div className="grid gap-5 sm:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => {
          const perms = Object.entries(PERMISSIONS).filter(([, def]) => def.group === group.key);
          if (perms.length === 0) return null;
          return (
            <fieldset key={group.key} className="border border-line p-4">
              <legend className="px-1 text-[0.625rem] font-medium uppercase tracking-[0.16em] text-ink-faint">
                {ar ? group.ar : group.en}
              </legend>
              <ul className="space-y-2">
                {perms.map(([key, def]) => {
                  const override = overrides.get(key);
                  const editable = canEdit(key);
                  return (
                    <li key={key}>
                      <label className="flex items-start gap-2.5 text-small text-ink">
                        <input
                          type="checkbox"
                          checked={isOn(key)}
                          onChange={() => toggle(key)}
                          disabled={!editable}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-ink disabled:opacity-40"
                        />
                        <span className="flex flex-wrap items-center gap-1.5">
                          {ar ? def.ar : def.en}
                          {override && (
                            <span
                              className={
                                override === 'DENY'
                                  ? 'text-[0.625rem] uppercase tracking-wide text-danger'
                                  : 'text-[0.625rem] uppercase tracking-wide text-success'
                              }
                            >
                              {override === 'DENY'
                                ? ar
                                  ? 'مسحوبة'
                                  : 'revoked'
                                : ar
                                  ? 'ممنوحة'
                                  : 'granted'}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>
      {!isSuperAdmin && (
        <p className="mt-4 text-caption text-ink-faint">
          {ar
            ? 'لا يمكنك منح أو سحب صلاحية لا تملكها.'
            : 'You can only grant or revoke permissions you hold yourself.'}
        </p>
      )}
    </div>
  );
}
