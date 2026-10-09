'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Admin-side controls for one production task: reassign a tailor, adjust the
 * deadline/priority, and drive the sewing-floor workflow. Only the transitions
 * legal from the task's current state are offered; the API re-checks them.
 */
export function ProductionTaskActions({
  taskId,
  tailorId,
  priority,
  dueDate,
  taskStatus,
  tailors,
  transitions,
  canAssign,
  canManage,
  locale,
}: {
  taskId: string;
  tailorId: string | null;
  priority: string;
  dueDate: string | null;
  taskStatus: string;
  tailors: { id: string; name: string }[];
  transitions: string[];
  canAssign: boolean;
  canManage: boolean;
  locale: 'en' | 'ar';
}) {
  const router = useRouter();
  const ar = locale === 'ar';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tailor, setTailor] = useState(tailorId ?? '');
  const [prio, setPrio] = useState(priority);
  const [due, setDue] = useState(dueDate ? dueDate.slice(0, 10) : '');

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/production/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? (ar ? 'فشل التحديث' : 'Update failed'));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(ar ? 'خطأ في الشبكة' : 'Network error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const LABELS: Record<string, { en: string; ar: string }> = {
    assign: { en: 'Assign', ar: 'إسناد' },
    start: { en: 'Start', ar: 'بدء' },
    complete: { en: 'Complete', ar: 'إنهاء' },
    rework: { en: 'Rework', ar: 'إعادة' },
    cancel: { en: 'Cancel', ar: 'إلغاء' },
  };

  // A cancelled/completed task accepts no cosmetic edits (the API enforces this
  // too); hide the editor rather than offer an action that will 409.
  const locked = taskStatus === 'CANCELLED' || taskStatus === 'COMPLETED';

  if (!canManage) return <span className="text-caption text-ink-faint">—</span>;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-1">
        {transitions.map((to) => {
          const action = { IN_PROGRESS: 'start', COMPLETED: 'complete', REWORK: 'rework', CANCELLED: 'cancel' }[to];
          if (!action) return null;
          return (
            <button
              key={to}
              type="button"
              disabled={busy}
              onClick={() => {
                if (action === 'cancel' && !window.confirm(ar ? 'إلغاء هذه المهمة؟' : 'Cancel this task?')) return;
                void send({ action });
              }}
              className={action === 'cancel' ? 'adm-btn-danger adm-btn-sm' : 'adm-btn-outline adm-btn-sm'}
            >
              {LABELS[action][ar ? 'ar' : 'en']}
            </button>
          );
        })}
        <button type="button" onClick={() => setOpen((v) => !v)} disabled={busy || locked} className="adm-btn-outline adm-btn-sm">
          {ar ? 'تعديل' : 'Edit'}
        </button>
      </div>

      {open && !locked ? (
        <div className="grid gap-2">
          {canAssign ? (
            <select value={tailor} onChange={(e) => setTailor(e.target.value)} className="adm-select">
              <option value="">{ar ? 'بدون خياط' : 'Unassigned'}</option>
              {tailors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : null}
          <select value={prio} onChange={(e) => setPrio(e.target.value)} className="adm-select">
            {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="adm-input" />
          <button
            type="button"
            disabled={busy}
            className="adm-btn-primary adm-btn-sm"
            onClick={async () => {
              let ok = true;
              if (canAssign && (tailor || '') !== (tailorId ?? '')) ok = await send({ action: 'assign', tailorId: tailor || null });
              if (ok && prio !== priority) ok = await send({ action: 'priority', priority: prio });
              if (ok && due !== (dueDate ? dueDate.slice(0, 10) : '')) ok = await send({ action: 'due', dueDate: due || null });
              if (ok) setOpen(false);
            }}
          >
            {ar ? 'حفظ' : 'Save'}
          </button>
        </div>
      ) : null}

      {error ? <span className="text-caption text-danger">{error}</span> : null}
    </div>
  );
}
