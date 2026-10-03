'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSION_GROUPS, PERMISSIONS } from '@/lib/permission-defs';

/** Role permission matrix. Admin role is shown read-only (always full access). */
export function RoleMatrix({
  roleId,
  roleName,
  label,
  selected,
  locale,
  dict,
}: {
  roleId: string;
  roleName: string;
  label: string;
  selected: string[];
  locale: 'en' | 'ar';
  dict: { common: Record<string, string>; system: Record<string, string> };
}) {
  const router = useRouter();
  const c = dict.common;
  const locked = roleName === 'ADMIN';
  const [chosen, setChosen] = useState<Set<string>>(new Set(selected));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(permission: string) {
    if (locked) return;
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: [...chosen] }),
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="adm-title">{label}</h3>
        {!locked && (
          <div className="flex items-center gap-3">
            {saved && <span className="text-caption text-success">{c.saved}</span>}
            <button type="button" onClick={save} disabled={busy} className="adm-btn-primary adm-btn-sm">
              {busy ? c.saving : c.save}
            </button>
          </div>
        )}
      </div>
      {error && <p className="mb-3 text-caption text-danger">{error}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => {
          const perms = Object.entries(PERMISSIONS).filter(([, def]) => def.group === group.key);
          if (perms.length === 0) return null;
          return (
            <fieldset key={group.key} className="border border-line p-4">
              <legend className="px-1 text-[0.625rem] font-medium uppercase tracking-[0.16em] text-ink-faint">
                {locale === 'ar' ? group.ar : group.en}
              </legend>
              <ul className="space-y-2">
                {perms.map(([key, def]) => (
                  <li key={key}>
                    <label className="flex items-start gap-2.5 text-small text-ink">
                      <input
                        type="checkbox"
                        checked={chosen.has(key)}
                        onChange={() => toggle(key)}
                        disabled={locked}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-ink disabled:opacity-50"
                      />
                      <span>{locale === 'ar' ? def.ar : def.en}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
