import 'server-only';
import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

/**
 * Tailor notifications.
 *
 * A tailor is a distinct principal (no `User` row), so these live in their own
 * `TailorNotification` table — strictly separate from `StaffNotification`.
 *
 * Delivery is configurable through `NotificationRule` (targetType = TAILOR):
 *  - a rule for the event key that is `isActive: false` suppresses the row;
 *  - a rule that is active, or no rule at all, delivers it.
 * This lets the owner switch a tailor event off from one place without code.
 */

export const TAILOR_EVENTS = {
  productionAssigned: 'production.assigned',
  qcFailed: 'qc.failed',
  qcPassed: 'qc.passed',
  settlementCreated: 'settlement.created',
  settlementTransferred: 'settlement.transferred',
  settlementPaid: 'settlement.paid',
  settlementConfirmed: 'settlement.confirmed',
} as const;

export type TailorEventKey = (typeof TAILOR_EVENTS)[keyof typeof TAILOR_EVENTS];

type Client = Prisma.TransactionClient | typeof prisma;

export interface TailorNotificationInput {
  tailorId: string;
  eventKey?: TailorEventKey | null;
  titleEn: string;
  titleAr: string;
  bodyEn?: string | null;
  bodyAr?: string | null;
  /** Locale-less portal path, e.g. `/tailor/tasks/{id}`. */
  href?: string | null;
}

/** Whether delivery is switched on for an event. Missing rule => delivered. */
export async function isTailorEventEnabled(
  eventKey: string,
  client: Client = prisma,
): Promise<boolean> {
  const rule = await client.notificationRule.findFirst({
    where: { eventKey, targetType: 'TAILOR' },
    select: { isActive: true },
  });
  return rule ? rule.isActive : true;
}

/**
 * Writes a tailor notification, honouring the configured rule. Returns whether
 * a row was written so callers can report delivery.
 */
export async function createTailorNotification(
  input: TailorNotificationInput,
  client: Client = prisma,
): Promise<boolean> {
  if (input.eventKey && !(await isTailorEventEnabled(input.eventKey, client))) return false;

  await client.tailorNotification.create({
    data: {
      tailorId: input.tailorId,
      eventKey: input.eventKey ?? null,
      titleEn: input.titleEn,
      titleAr: input.titleAr,
      bodyEn: input.bodyEn ?? null,
      bodyAr: input.bodyAr ?? null,
      href: input.href ?? null,
    },
  });
  return true;
}

/** A new production task was assigned to the tailor. */
export async function notifyTailorAssigned(
  input: { tailorId: string; taskId: string; taskCode: string; titleEn: string; titleAr?: string | null },
  client: Client = prisma,
): Promise<boolean> {
  return createTailorNotification(
    {
      tailorId: input.tailorId,
      eventKey: TAILOR_EVENTS.productionAssigned,
      titleEn: 'New work assigned',
      titleAr: 'تم إسناد عمل جديد',
      bodyEn: `${input.taskCode} — ${input.titleEn}`,
      bodyAr: input.titleAr ? `${input.taskCode} — ${input.titleAr}` : `${input.taskCode}`,
      href: `/tailor/tasks/${input.taskId}`,
    },
    client,
  );
}

/** Quality control outcome for a piece the tailor worked on. */
export async function notifyTailorQc(
  input: {
    tailorId: string;
    taskId: string;
    taskCode: string;
    passed: boolean;
    reason?: string | null;
  },
  client: Client = prisma,
): Promise<boolean> {
  const reasonEn = input.reason?.trim() ? ` — ${input.reason.trim()}` : '';
  return createTailorNotification(
    {
      tailorId: input.tailorId,
      eventKey: input.passed ? TAILOR_EVENTS.qcPassed : TAILOR_EVENTS.qcFailed,
      titleEn: input.passed ? 'Quality check passed' : 'Quality check failed — rework needed',
      titleAr: input.passed ? 'اجتاز فحص الجودة' : 'لم يجتز فحص الجودة — مطلوب إعادة التصحيح',
      bodyEn: `${input.taskCode}${input.passed ? '' : reasonEn}`,
      bodyAr: `${input.taskCode}${input.passed ? '' : reasonEn}`,
      href: `/tailor/tasks/${input.taskId}`,
    },
    client,
  );
}

/** Settlement lifecycle update the tailor should see. */
export async function notifyTailorSettlement(
  input: {
    tailorId: string;
    settlementId: string;
    number: string;
    event: 'created' | 'transferred' | 'paid' | 'confirmed';
    netBhd?: number;
  },
  client: Client = prisma,
): Promise<boolean> {
  const eventKey = {
    created: TAILOR_EVENTS.settlementCreated,
    transferred: TAILOR_EVENTS.settlementTransferred,
    paid: TAILOR_EVENTS.settlementPaid,
    confirmed: TAILOR_EVENTS.settlementConfirmed,
  }[input.event];

  const copy = {
    created: { en: 'New settlement prepared', ar: 'تم إعداد تسوية جديدة' },
    transferred: { en: 'Settlement transferred', ar: 'تم تحويل التسوية' },
    paid: { en: 'Settlement paid', ar: 'تم دفع التسوية' },
    confirmed: { en: 'Settlement confirmed', ar: 'تم تأكيد التسوية' },
  }[input.event];

  const amount = typeof input.netBhd === 'number' ? ` — ${input.netBhd.toFixed(3)} BHD` : '';

  return createTailorNotification(
    {
      tailorId: input.tailorId,
      eventKey,
      titleEn: copy.en,
      titleAr: copy.ar,
      bodyEn: `${input.number}${amount}`,
      bodyAr: `${input.number}${amount}`,
      href: `/tailor/settlements/${input.settlementId}`,
    },
    client,
  );
}
