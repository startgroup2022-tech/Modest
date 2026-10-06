import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Concurrency-safe human-readable identifiers.
 *
 * Numbers are drawn from a counter row incremented with a native MySQL
 * `INSERT … ON DUPLICATE KEY UPDATE value = value + 1`, which is atomic: the
 * first writer inserts the row and every concurrent writer blocks on the row
 * lock until the holder commits, then increments. Two callers therefore can
 * never receive the same number.
 *
 * Note: Prisma's `upsert` cannot be used here. It is implemented as a
 * `findUnique` followed by a `create`/`update`, so concurrent first-time
 * callers race on the insert and one fails with a unique-constraint error. The
 * raw statement below is a single atomic operation and has no such race.
 */

export interface SequenceSpec {
  /** Counter identity, e.g. `order:2609`, `expense`, `settlement`, `quick_order`. */
  key: string;
  /** Leading token, e.g. `ATT`, `EXP`, `STL`, `QOL`. */
  prefix: string;
  /** Optional scope segment inserted after the prefix (e.g. `2609`). */
  scope?: string | null;
  /** Zero-padded width of the numeric part. Defaults to 6. */
  pad?: number;
}

export function formatSequence(spec: SequenceSpec, value: number): string {
  const pad = spec.pad ?? 6;
  const num = String(value).padStart(pad, '0');
  return spec.scope ? `${spec.prefix}-${spec.scope}-${num}` : `${spec.prefix}-${num}`;
}

/** Allocates the next number inside an existing transaction. */
export async function nextSequence(
  tx: Prisma.TransactionClient,
  spec: SequenceSpec,
): Promise<string> {
  // `id` mirrors `key` so the counter row is addressable by a deterministic
  // primary key and the ON DUPLICATE KEY clause cannot be ambiguous.
  await tx.$executeRaw`
    INSERT INTO \`SequenceCounter\` (\`id\`, \`key\`, \`prefix\`, \`scope\`, \`value\`, \`createdAt\`, \`updatedAt\`)
    VALUES (${spec.key}, ${spec.key}, ${spec.prefix}, ${spec.scope ?? null}, 1, NOW(3), NOW(3))
    ON DUPLICATE KEY UPDATE \`value\` = \`value\` + 1, \`updatedAt\` = NOW(3)`;
  const row = await tx.sequenceCounter.findUnique({ where: { key: spec.key } });
  if (!row) throw new Error(`Sequence counter ${spec.key} could not be read after increment`);
  return formatSequence(spec, row.value);
}

/** Allocates the next number in its own transaction (standalone call sites). */
export async function nextSequenceStandalone(spec: SequenceSpec): Promise<string> {
  return prisma.$transaction((tx) => nextSequence(tx, spec));
}

/** `YYMM` in Bahrain time — the monthly scope used by order numbers. */
export function monthlyScope(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bahrain',
    year: '2-digit',
    month: '2-digit',
    numberingSystem: 'latn',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '00';
  const m = parts.find((p) => p.type === 'month')?.value ?? '00';
  return `${y}${m}`;
}
