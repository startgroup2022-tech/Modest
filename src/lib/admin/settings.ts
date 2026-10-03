import 'server-only';

/**
 * Never return a stored credential to the browser. A masked value is shown as a
 * sentinel; the settings route treats the sentinel as "keep the existing value".
 */
export const SECRET_SENTINEL = '__stored__';

export function maskSecret(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? SECRET_SENTINEL : '';
}

/** Applies the sentinel rule to an incoming settings payload before persisting. */
export function preserveSecrets(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>,
  secretKeys: string[],
): Record<string, unknown> {
  const out = { ...incoming };
  for (const key of secretKeys) {
    if (out[key] === SECRET_SENTINEL) out[key] = existing[key] ?? '';
  }
  return out;
}
