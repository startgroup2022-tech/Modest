'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Admin quality-control form for a single production piece. The inspector ticks
 * the checklist and records PASS or FAIL; a FAIL requires a reason (mirrored by
 * the API). The task's current status is sent as `expectedStatus` so two
 * inspectors cannot record conflicting decisions on the same piece.
 */

const CHECKS = [
  { key: 'measurementsOk', en: 'Measurements', ar: 'القياسات' },
  { key: 'stitchingOk', en: 'Stitching', ar: 'الخياطة' },
  { key: 'fabricOk', en: 'Fabric', ar: 'القماش' },
  { key: 'finishingOk', en: 'Finishing', ar: 'التشطيب' },
  { key: 'accessoriesOk', en: 'Accessories', ar: 'الإكسسوارات' },
  { key: 'packagingOk', en: 'Packaging', ar: 'التغليف' },
] as const;

type CheckKey = (typeof CHECKS)[number]['key'];

export function QcInspectionForm({
  taskId,
  taskStatus,
  locale,
}: {
  taskId: string;
  taskStatus: string;
  locale: 'en' | 'ar';
}) {
  const router = useRouter();
  const ar = locale === 'ar';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    measurementsOk: true,
    stitchingOk: true,
    fabricOk: true,
    finishingOk: true,
    accessoriesOk: true,
    packagingOk: true,
  });
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  async function submit(result: 'PASSED' | 'REWORK_REQUIRED') {
    if (result !== 'PASSED' && !reason.trim()) {
      setError(ar ? 'سبب الرفض مطلوب' : 'A rejection reason is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          status: result,
          ...checks,
          rejectionReason: result === 'PASSED' ? '' : reason.trim(),
          notes: notes || '',
          expectedStatus: taskStatus,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? (ar ? 'فشل الفحص' : 'Inspection failed'));
        return;
      }
      setOpen(false);
      setReason('');
      setNotes('');
      router.refresh();
    } catch {
      setError(ar ? 'خطأ في الشبكة' : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="adm-btn-primary adm-btn-sm">
        {ar ? 'بدء الفحص' : 'Inspect'}
      </button>
    );
  }

  return (
    <div className="grid gap-3 rounded-md border border-line bg-surface-2 p-3 text-start">
      <div className="grid gap-1 sm:grid-cols-2">
        {CHECKS.map((c) => (
          <label key={c.key} className="flex items-center gap-2 text-small">
            <input
              type="checkbox"
              checked={checks[c.key]}
              onChange={(e) => setChecks((s) => ({ ...s, [c.key]: e.target.checked }))}
            />
            {ar ? c.ar : c.en}
          </label>
        ))}
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={ar ? 'سبب الرفض (مطلوب عند الرسوب)' : 'Rejection reason (required on fail)'}
        className="adm-input"
        rows={2}
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={ar ? 'ملاحظات' : 'Notes'}
        className="adm-input"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => submit('PASSED')} className="adm-btn-primary adm-btn-sm">
          {ar ? 'اجتياز' : 'Pass'}
        </button>
        <button type="button" disabled={busy} onClick={() => submit('REWORK_REQUIRED')} className="adm-btn-danger adm-btn-sm">
          {ar ? 'رسوب وإعادة للتصحيح' : 'Fail — send to rework'}
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="adm-btn-outline adm-btn-sm">
          {ar ? 'إلغاء' : 'Cancel'}
        </button>
      </div>
      {error ? <span className="text-caption text-danger">{error}</span> : null}
    </div>
  );
}