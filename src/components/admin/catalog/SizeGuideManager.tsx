'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CutFieldRow {
  id: string;
  key: string;
  labelEn: string;
  labelAr: string;
  unit: string;
  minValue: number | null;
  maxValue: number | null;
  helperEn: string | null;
  helperAr: string | null;
  isActive: boolean;
  sortOrder: number;
  values: Record<string, number>;
}

export interface CutRow {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  isActive: boolean;
  sortOrder: number;
  sizes: string[];
  fields: CutFieldRow[];
}

const SIZE_CODES = ['XS', 'S', 'M', 'L', 'XL'];

const blankCut = {
  code: '',
  nameEn: '',
  nameAr: '',
  descriptionEn: '',
  descriptionAr: '',
  isActive: true,
  sortOrder: 0,
};

/** Manages the measurement cuts, their ready-size charts and their fields. */
export function SizeGuideManager({
  cuts,
  locale,
  canEdit,
}: {
  cuts: CutRow[];
  locale: 'en' | 'ar';
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<typeof blankCut | null>(null);
  const [newField, setNewField] = useState<Record<string, string>>({});

  const label = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  async function call(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/size-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Save failed');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Network error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createCut() {
    if (!draft) return;
    const ok = await call({ action: 'create_cut', data: draft });
    if (ok) setDraft(null);
  }

  async function addField(cut: CutRow) {
    const prefix = `f_${cut.id}`;
    const key = (newField[`${prefix}_key`] ?? '').trim();
    const labelEn = (newField[`${prefix}_en`] ?? '').trim();
    const labelAr = (newField[`${prefix}_ar`] ?? '').trim();
    if (!key || !labelEn) {
      setError(label('A key and English label are required.', 'يجب إدخال المفتاح والاسم الإنجليزي.'));
      return;
    }
    const sizeValues: Record<string, number> = {};
    for (const size of cut.sizes) {
      const raw = newField[`${prefix}_${size}`];
      if (raw !== undefined && raw !== '' && Number.isFinite(Number(raw))) sizeValues[size] = Number(raw);
    }
    const ok = await call({
      action: 'create_field',
      data: {
        cutId: cut.id,
        key,
        labelEn,
        labelAr: labelAr || labelEn,
        unit: 'inch',
        isActive: true,
        sortOrder: cut.fields.length,
        sizeValues,
      },
    });
    if (ok) {
      setNewField((s) => {
        const next = { ...s };
        for (const k of Object.keys(next)) if (k.startsWith(prefix)) delete next[k];
        return next;
      });
    }
  }

  if (!cuts.length) {
    return (
      <div className="p-6">
        <p className="text-body-sm text-ink-soft">
          {label('No measurement cuts yet. Create the first silhouette below.', 'لا توجد قَصّات قياس بعد. أنشئ أول قَصّة أدناه.')}
        </p>
        {canEdit && <CutDraft draft={draft ?? blankCut} setDraft={(d) => setDraft(d)} busy={busy} onSave={createCut} label={label} error={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5">
      {error && <p className="text-body-sm text-danger">{error}</p>}
      {cuts.map((cut) => (
        <section key={cut.id} className="rounded border border-line">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h3 className="text-body font-medium text-ink">
                {locale === 'ar' ? cut.nameAr : cut.nameEn}
                <span className="ms-2 font-mono text-caption text-ink-faint">{cut.code}</span>
              </h3>
              {!cut.isActive && (
                <span className="text-caption text-warn">{label('Inactive', 'غير مفعّلة')}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-caption text-ink-faint">
                {cut.fields.length} {label('fields', 'حقول')} · {cut.sizes.join(' / ') || label('no sizes', 'بدون مقاسات')}
              </span>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  className="adm-btn-outline adm-btn-sm"
                  onClick={() => call({ action: 'update_cut', data: { id: cut.id, isActive: !cut.isActive } })}
                >
                  {cut.isActive ? label('Deactivate', 'إيقاف') : label('Activate', 'تفعيل')}
                </button>
              )}
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{label('Measurement', 'القياس')}</th>
                  {SIZE_CODES.map((size) => (
                    <th key={size} className="text-center">
                      {size}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cut.fields.map((field) => (
                  <tr key={field.id}>
                    <td data-label={label('Measurement', 'القياس')}>
                      <span className="block text-ink">{locale === 'ar' ? field.labelAr : field.labelEn}</span>
                      <span className="block font-mono text-caption text-ink-faint">{field.key}</span>
                    </td>
                    {SIZE_CODES.map((size) => {
                      const has = cut.sizes.includes(size);
                      return (
                        <td key={size} className="text-center" data-label={size}>
                          {has ? (
                            <input
                              type="number"
                              step="0.1"
                              defaultValue={field.values[size] ?? ''}
                              disabled={!canEdit || busy}
                              className="adm-input w-20 text-center"
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isFinite(v) || v === field.values[size]) return;
                                void call({
                                  action: 'update_field',
                                  data: { id: field.id, cutId: cut.id, sizeValues: { [size]: v } },
                                });
                              }}
                            />
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <div className="border-t border-line px-5 py-4">
              <p className="mb-3 text-caption font-medium text-ink-soft">{label('Add measurement field', 'إضافة حقل قياس')}</p>
              <div className="flex flex-wrap items-end gap-2">
                <input
                  placeholder={label('key (snake_case)', 'المفتاح (snake_case)')}
                  className="adm-input w-40"
                  value={newField[`f_${cut.id}_key`] ?? ''}
                  onChange={(e) => setNewField((s) => ({ ...s, [`f_${cut.id}_key`]: e.target.value }))}
                />
                <input
                  placeholder={label('Label (EN)', 'الاسم (إنجليزي)')}
                  className="adm-input w-40"
                  value={newField[`f_${cut.id}_en`] ?? ''}
                  onChange={(e) => setNewField((s) => ({ ...s, [`f_${cut.id}_en`]: e.target.value }))}
                />
                <input
                  placeholder={label('Label (AR)', 'الاسم (عربي)')}
                  className="adm-input w-40"
                  value={newField[`f_${cut.id}_ar`] ?? ''}
                  onChange={(e) => setNewField((s) => ({ ...s, [`f_${cut.id}_ar`]: e.target.value }))}
                />
                {cut.sizes.map((size) => (
                  <input
                    key={size}
                    type="number"
                    step="0.1"
                    placeholder={size}
                    className="adm-input w-20 text-center"
                    value={newField[`f_${cut.id}_${size}`] ?? ''}
                    onChange={(e) => setNewField((s) => ({ ...s, [`f_${cut.id}_${size}`]: e.target.value }))}
                  />
                ))}
                <button type="button" disabled={busy} className="adm-btn-outline adm-btn-sm" onClick={() => addField(cut)}>
                  {label('Add', 'إضافة')}
                </button>
              </div>
            </div>
          )}
        </section>
      ))}

      {canEdit && <CutDraft draft={draft ?? blankCut} setDraft={setDraft} busy={busy} onSave={createCut} label={label} error={null} />}
    </div>
  );
}

function CutDraft({
  draft,
  setDraft,
  busy,
  onSave,
  label,
  error,
}: {
  draft: typeof blankCut;
  setDraft: (d: typeof blankCut) => void;
  busy: boolean;
  onSave: () => void;
  label: (en: string, ar: string) => string;
  error: string | null;
}) {
  return (
    <section className="rounded border border-dashed border-line px-5 py-4">
      <p className="mb-3 text-caption font-medium text-ink-soft">{label('New silhouette / cut', 'قَصّة / قوام جديد')}</p>
      {error && <p className="mb-2 text-body-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <input
          placeholder={label('CODE (e.g. BISHT)', 'الرمز (مثال BISHT)')}
          className="adm-input w-40 font-mono uppercase"
          value={draft.code}
          onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
        />
        <input
          placeholder={label('Name (EN)', 'الاسم (إنجليزي)')}
          className="adm-input w-44"
          value={draft.nameEn}
          onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}
        />
        <input
          placeholder={label('Name (AR)', 'الاسم (عربي)')}
          className="adm-input w-44"
          value={draft.nameAr}
          onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}
        />
        <button type="button" disabled={busy} className="adm-btn-outline adm-btn-sm" onClick={onSave}>
          {label('Create cut', 'إنشاء القَصّة')}
        </button>
      </div>
    </section>
  );
}
