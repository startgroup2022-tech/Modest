import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { applyTailorTaskAction, getTailorTask, listTailorTasks, tailorDashboard } from '@/lib/tailor-work';
import {
  createSettlement,
  applySettlementAction,
  confirmSettlementByTailor,
  getTailorSettlement,
  listTailorSettlements,
  SettlementError,
} from '@/lib/settlements';
import { assignTailorToItem, assignTailorToProductionTask, AssignmentError } from '@/lib/assignments';
import { createTailorNotification, notifyTailorQc } from '@/lib/tailor-notifications';

/**
 * Database-backed integration tests for Phase 6A — the Tailor Portal, production
 * work transitions, quality-control visibility and the settlement payout chain.
 * They run against the real Prisma/MySQL schema — no mocks — and are skipped
 * unless RUN_DB_TESTS=1.
 */
const enabled = process.env.RUN_DB_TESTS === '1';
const maybe = enabled ? describe : describe.skip;

let suffix: string;
let tailorId: string;
let otherTailorId: string;
const createdOrderIds: string[] = [];
const createdTailorIds: string[] = [];
const createdSettlementIds: string[] = [];
const createdProductIds: string[] = [];

/** Builds a delivered, paid order with one item, ready for assignment. */
async function makeDeliveredOrder(opts: { withFee?: boolean } = {}) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `IT6-${suffix}-${createdOrderIds.length}`,
      email: `it6-${suffix}@example.com`,
      phone: '+97333000000',
      shippingName: 'IT6 Customer',
      shippingCountry: 'Bahrain',
      shippingCity: 'Manama',
      shippingAddress: 'Test address',
      status: 'DELIVERED',
      subtotalBhd: 80,
      totalBhd: 80,
      deliveredAt: new Date(),
      items: {
        create: [
          {
            productName: 'IT6 Abaya',
            variantLabel: 'M / Black',
            sku: `IT6-SKU-${suffix}-${createdOrderIds.length}`,
            unitPriceBhd: 80,
            quantity: 1,
            lineTotalBhd: 80,
            measurementKind: 'CUSTOM',
            measurementSnapshot: {
              kind: 'CUSTOM',
              unit: 'inch',
              cutCode: null,
              cutNameEn: 'Standard',
              cutNameAr: 'قياسي',
              values: { shoulder: 15, length: 58 },
              fieldLabels: { shoulder: { en: 'Shoulder', ar: 'الكتف' }, length: { en: 'Length', ar: 'الطول' } },
            },
          },
        ],
      },
      payments: {
        create: {
          method: 'BANK_TRANSFER',
          provider: 'bank_transfer',
          status: 'PAID',
          amountBhd: 80,
          currencyCode: 'BHD',
          paidAt: new Date(),
        },
      },
    },
    include: { items: true },
  });
  createdOrderIds.push(order.id);
  return { order, item: order.items[0] };
}

/**
 * Builds a delivered, paid order whose single item's product carries a default
 * tailoring fee — the state the admin queue creates when a task has no tailor
 * yet and the fee must be supplied from the product.
 */
async function makeDeliveredOrderWithProductFee(feeBhd: number) {
  const product = await prisma.product.create({
    data: {
      slug: `it6-prod-${suffix}-${createdProductIds.length}`,
      nameEn: 'IT6 Fee Product',
      nameAr: 'منتج',
      priceBhd: 80,
      tailorFeeBhd: feeBhd,
    },
  });
  createdProductIds.push(product.id);

  const order = await prisma.order.create({
    data: {
      orderNumber: `IT6P-${suffix}-${createdOrderIds.length}`,
      email: `it6p-${suffix}@example.com`,
      phone: '+97333000000',
      shippingName: 'IT6 Customer',
      shippingCountry: 'Bahrain',
      shippingCity: 'Manama',
      shippingAddress: 'Test address',
      status: 'DELIVERED',
      subtotalBhd: 80,
      totalBhd: 80,
      deliveredAt: new Date(),
      items: {
        create: [
          {
            productId: product.id,
            productName: 'IT6 Fee Product',
            sku: `IT6P-SKU-${suffix}-${createdOrderIds.length}`,
            unitPriceBhd: 80,
            quantity: 1,
            lineTotalBhd: 80,
            measurementKind: 'CUSTOM',
            measurementSnapshot: { kind: 'CUSTOM', unit: 'inch', values: {} },
          },
        ],
      },
      payments: {
        create: {
          method: 'BANK_TRANSFER',
          provider: 'bank_transfer',
          status: 'PAID',
          amountBhd: 80,
          currencyCode: 'BHD',
          paidAt: new Date(),
        },
      },
    },
    include: { items: true },
  });
  createdOrderIds.push(order.id);
  return { order, item: order.items[0], product };
}

/** Counts `production.assigned` notifications for a tailor scoped to one task. */
function assignedNoticeCount(tailor: string, taskId: string) {
  return prisma.tailorNotification.count({
    where: { tailorId: tailor, eventKey: 'production.assigned', href: `/tailor/tasks/${taskId}` },
  });
}

maybe('phase 6a tailor portal (database)', () => {
  beforeAll(async () => {
    suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const [t1, t2] = await Promise.all([
      prisma.tailor.create({ data: { nameEn: `IT6 Tailor A ${suffix}`, nameAr: 'خياط أ', code: `IT6A-${suffix}`, status: 'ACTIVE' } }),
      prisma.tailor.create({ data: { nameEn: `IT6 Tailor B ${suffix}`, nameAr: 'خياط ب', code: `IT6B-${suffix}`, status: 'ACTIVE' } }),
    ]);
    tailorId = t1.id;
    otherTailorId = t2.id;
    createdTailorIds.push(t1.id, t2.id);
  });

  afterAll(async () => {
    // Settlements must go first: TailorSettlementItem.orderItemId is Restrict, so
    // an order cannot be removed while one of its pieces is still settled.
    if (createdSettlementIds.length) {
      const settlements = await prisma.tailorSettlement.findMany({
        where: { id: { in: createdSettlementIds } },
        select: { expenseId: true },
      });
      const expenseIds = settlements.map((s) => s.expenseId).filter((id): id is string => Boolean(id));
      await prisma.tailorSettlement.deleteMany({ where: { id: { in: createdSettlementIds } } });
      if (expenseIds.length) await prisma.expense.deleteMany({ where: { id: { in: expenseIds } } });
    }
    if (createdOrderIds.length) {
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    await prisma.tailorNotification.deleteMany({ where: { tailorId: { in: createdTailorIds } } });
    await prisma.tailor.deleteMany({ where: { id: { in: createdTailorIds } } });
    if (createdProductIds.length) {
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
  });

  async function assign(opts: { tailor?: string; fee?: number } = {}) {
    const { item } = await makeDeliveredOrder();
    const res = await assignTailorToItem({
      orderItemId: item.id,
      tailorId: opts.tailor ?? tailorId,
      suppliedFeeBhd: opts.fee ?? 12.5,
      actorId: null as never,
    });
    return { item, taskId: res.taskId };
  }

  describe('assignment and tailor work', () => {
    it('freezes the fee and tells the tailor they have new work', async () => {
      const { taskId } = await assign({ fee: 15 });
      const task = await prisma.productionTask.findUnique({ where: { id: taskId } });
      expect(Number(task!.feeBhd)).toBe(15);
      expect(task!.status).toBe('ASSIGNED');
      const note = await prisma.tailorNotification.findFirst({
        where: { tailorId, eventKey: 'production.assigned', bodyEn: { contains: task!.code } },
      });
      expect(note).not.toBeNull();
    });

    it('walks a piece through accept → start → submit for QC', async () => {
      const { taskId } = await assign();
      await applyTailorTaskAction({ tailorId, taskId, action: 'accept', actorLabel: 'tailor' });
      await applyTailorTaskAction({ tailorId, taskId, action: 'start', actorLabel: 'tailor' });
      const submitted = await applyTailorTaskAction({ tailorId, taskId, action: 'submit_for_qc', actorLabel: 'tailor' });
      expect(submitted.status).toBe('SUBMITTED_FOR_QC');

      const detail = await getTailorTask(tailorId, taskId);
      expect(detail!.status).toBe('SUBMITTED_FOR_QC');
      expect(detail!.measurement?.kind).toBe('CUSTOM');
      expect(detail!.measurement?.fields.map((f) => f.key)).toEqual(['shoulder', 'length']);
    });

    it('refuses a transition the workflow does not allow (start before accept)', async () => {
      const { taskId } = await assign();
      await expect(
        applyTailorTaskAction({ tailorId, taskId, action: 'start', actorLabel: 'tailor' }),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('hides a task from a tailor who does not own it', async () => {
      const { taskId } = await assign({ tailor: otherTailorId });
      const mine = await getTailorTask(tailorId, taskId);
      expect(mine).toBeNull();
      const theirs = await getTailorTask(otherTailorId, taskId);
      expect(theirs).not.toBeNull();
    });

    it('never selects customer money into the tailor list projection', async () => {
      await assign();
      const rows = await listTailorTasks(tailorId);
      for (const row of rows) {
        expect(row).not.toHaveProperty('unitPriceBhd');
        expect(row).not.toHaveProperty('lineTotalBhd');
        expect(row).not.toHaveProperty('totalBhd');
      }
    });

    it('reports dashboard counts for the tailor only', async () => {
      const stats = await tailorDashboard(tailorId);
      expect(stats.open).toBeGreaterThan(0);
      expect(typeof stats.overdue).toBe('number');
    });
  });

  describe('quality control visibility', () => {
    it('records a failed attempt with its reason and surfaces it to the tailor', async () => {
      const { taskId } = await assign();
      await applyTailorTaskAction({ tailorId, taskId, action: 'accept', actorLabel: 'tailor' });
      await applyTailorTaskAction({ tailorId, taskId, action: 'start', actorLabel: 'tailor' });
      await applyTailorTaskAction({ tailorId, taskId, action: 'submit_for_qc', actorLabel: 'tailor' });

      const task = await prisma.productionTask.findUnique({ where: { id: taskId } });
      await prisma.qcRecord.create({
        data: {
          taskId,
          orderItemId: task!.orderItemId,
          tailorId,
          attempt: 1,
          status: 'REWORK_REQUIRED',
          measurementsOk: true,
          stitchingOk: false,
          rejectionReason: 'Uneven hem',
          checkedAt: new Date(),
        },
      });
      await prisma.productionTask.update({ where: { id: taskId }, data: { status: 'REWORK' } });

      const detail = await getTailorTask(tailorId, taskId);
      expect(detail!.status).toBe('REWORK');
      expect(detail!.qcHistory[0].rejectionReason).toBe('Uneven hem');
      expect(detail!.actions).toContain('start');
    });

    it('records a PASSED attempt, completes the task and tells the tailor', async () => {
      const { taskId } = await assign();
      await applyTailorTaskAction({ tailorId, taskId, action: 'accept', actorLabel: 'tailor' });
      await applyTailorTaskAction({ tailorId, taskId, action: 'start', actorLabel: 'tailor' });
      await applyTailorTaskAction({ tailorId, taskId, action: 'submit_for_qc', actorLabel: 'tailor' });

      const task = await prisma.productionTask.findUnique({ where: { id: taskId } });
      await prisma.qcRecord.create({
        data: {
          taskId,
          orderItemId: task!.orderItemId,
          tailorId,
          attempt: 1,
          status: 'PASSED',
          measurementsOk: true,
          stitchingOk: true,
          fabricOk: true,
          finishingOk: true,
          accessoriesOk: true,
          packagingOk: true,
          checkedAt: new Date(),
        },
      });
      await prisma.productionTask.update({ where: { id: taskId }, data: { status: 'COMPLETED', completedAt: new Date() } });

      // The tailor is told the outcome through the dedicated model, using the
      // `qc.passed` event key — distinct from the failure path.
      const written = await notifyTailorQc(
        { tailorId, taskId, taskCode: task!.code, passed: true, reason: null },
        prisma,
      );
      expect(written).toBe(true);
      const note = await prisma.tailorNotification.findFirst({
        where: { tailorId, eventKey: 'qc.passed', href: `/tailor/tasks/${taskId}` },
      });
      expect(note).not.toBeNull();
      expect(note!.bodyEn).toBe(task!.code);

      const detail = await getTailorTask(tailorId, taskId);
      expect(detail!.status).toBe('COMPLETED');
      expect(detail!.qcHistory[0].status).toBe('PASSED');
    });
  });

  describe('assignment notifications', () => {
    it('emits exactly one production.assigned notification, to the assigned tailor only', async () => {
      const { item } = await makeDeliveredOrder();
      const res = await assignTailorToItem({
        orderItemId: item.id,
        tailorId,
        suppliedFeeBhd: 11,
        actorId: null as never,
      });
      expect(await assignedNoticeCount(tailorId, res.taskId)).toBe(1);
      expect(await assignedNoticeCount(otherTailorId, res.taskId)).toBe(0);
    });

    it('does not re-notify when the same tailor is re-assigned to the same task', async () => {
      const { item } = await makeDeliveredOrder();
      const res = await assignTailorToItem({
        orderItemId: item.id,
        tailorId,
        suppliedFeeBhd: 11,
        actorId: null as never,
      });
      expect(await assignedNoticeCount(tailorId, res.taskId)).toBe(1);

      // Re-assigning the same piece to the same tailor is not new work.
      await assignTailorToItem({
        orderItemId: item.id,
        tailorId,
        suppliedFeeBhd: 11,
        actorId: null as never,
      });
      expect(await assignedNoticeCount(tailorId, res.taskId)).toBe(1);
    });

    it('notifies only the new tailor on reassignment and re-points the order item', async () => {
      const { item } = await makeDeliveredOrder();
      const res = await assignTailorToItem({
        orderItemId: item.id,
        tailorId,
        suppliedFeeBhd: 11,
        actorId: null as never,
      });
      expect(await assignedNoticeCount(tailorId, res.taskId)).toBe(1);

      // Reassign to the other tailor through the queue path.
      await assignTailorToProductionTask({ taskId: res.taskId, tailorId: otherTailorId, actorId: null as never });

      // The previous tailor gets nothing new; the new tailor gets exactly one.
      expect(await assignedNoticeCount(tailorId, res.taskId)).toBe(1);
      expect(await assignedNoticeCount(otherTailorId, res.taskId)).toBe(1);

      // The order item must follow the task, or settlement would pay the wrong
      // tailor for the piece.
      const after = await prisma.orderItem.findUnique({ where: { id: item.id } });
      expect(after!.assignedTailorId).toBe(otherTailorId);
    });

    it('resolves and freezes the fee from the product when the queue assigns an unassigned task', async () => {
      const { order, item } = await makeDeliveredOrderWithProductFee(13.5);

      // A queue task created before any tailor is named: PENDING, no frozen fee.
      const task = await prisma.productionTask.create({
        data: {
          code: `IT6-Q-${suffix}-${item.id.slice(-4)}`,
          orderId: order.id,
          orderItemId: item.id,
          productId: item.productId,
          titleEn: 'IT6 Fee Product',
          status: 'PENDING',
          feeBhd: null,
        },
      });

      await assignTailorToProductionTask({ taskId: task.id, tailorId, actorId: null as never });

      const reloaded = await prisma.productionTask.findUnique({ where: { id: task.id } });
      expect(Number(reloaded!.feeBhd)).toBe(13.5);
      const after = await prisma.orderItem.findUnique({ where: { id: item.id } });
      expect(after!.assignedTailorId).toBe(tailorId);
      expect(Number(after!.tailorFeeBhd)).toBe(13.5);
      expect(await assignedNoticeCount(tailorId, task.id)).toBe(1);
    });

    it('emits no notification for an un-assignment', async () => {
      const { item } = await makeDeliveredOrder();
      const res = await assignTailorToItem({
        orderItemId: item.id,
        tailorId,
        suppliedFeeBhd: 11,
        actorId: null as never,
      });
      const before = await assignedNoticeCount(tailorId, res.taskId);

      // Move the task back to ASSIGNED first (queue unassign needs a legal edge).
      await prisma.productionTask.update({ where: { id: res.taskId }, data: { status: 'ASSIGNED' } });
      await assignTailorToProductionTask({ taskId: res.taskId, tailorId: null, actorId: null as never });

      expect(await assignedNoticeCount(tailorId, res.taskId)).toBe(before);
      const after = await prisma.orderItem.findUnique({ where: { id: item.id } });
      expect(after!.assignedTailorId).toBeNull();
    });

    it('honours an inactive NotificationRule for production.assigned', async () => {
      await prisma.notificationRule.deleteMany({ where: { eventKey: 'production.assigned', targetType: 'TAILOR' } });
      await prisma.notificationRule.create({
        data: {
          eventKey: 'production.assigned',
          nameEn: 'Assignments off',
          nameAr: 'إيقاف الإسناد',
          targetType: 'TAILOR',
          isActive: false,
        },
      });
      try {
        const { item } = await makeDeliveredOrder();
        const res = await assignTailorToItem({
          orderItemId: item.id,
          tailorId,
          suppliedFeeBhd: 11,
          actorId: null as never,
        });
        expect(await assignedNoticeCount(tailorId, res.taskId)).toBe(0);
      } finally {
        await prisma.notificationRule.deleteMany({ where: { eventKey: 'production.assigned', targetType: 'TAILOR' } });
      }
    });
  });

  describe('settlement payout chain', () => {
    async function deliveredAndAssigned() {
      const { item, taskId } = await assign({ fee: 20 });
      // Mark the task delivered/complete so the piece is eligible.
      await prisma.productionTask.update({ where: { id: taskId }, data: { status: 'COMPLETED', completedAt: new Date() } });
      return item;
    }

    it('requires approval, then a transfer with proof, before any payout', async () => {
      const item = await deliveredAndAssigned();
      const settlement = await createSettlement({ tailorId, orderItemIds: [item.id], actorId: null as never });
      createdSettlementIds.push(settlement.id);

      // Cannot jump straight to pay.
      await expect(
        applySettlementAction({ settlementId: settlement.id, action: 'pay', actorId: null as never }),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

      await applySettlementAction({ settlementId: settlement.id, action: 'approve', actorId: null as never });

      // Approved, but no transfer proof yet — transfer itself must be refused.
      await expect(
        applySettlementAction({ settlementId: settlement.id, action: 'transfer', actorId: null as never }),
      ).rejects.toMatchObject({ code: 'PROOF_REQUIRED' });

      // Nor may it be paid directly from APPROVED.
      await expect(
        applySettlementAction({ settlementId: settlement.id, action: 'pay', actorId: null as never }),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

      const transferred = await applySettlementAction({
        settlementId: settlement.id,
        action: 'transfer',
        actorId: null as never,
        transferReference: 'BANK-REF-1',
      });
      expect(transferred.status).toBe('TRANSFERRED');

      const paid = await applySettlementAction({ settlementId: settlement.id, action: 'pay', actorId: null as never });
      expect(paid.status).toBe('PAID');

      const expense = await prisma.expense.findFirst({ where: { settlementId: settlement.id } });
      expect(expense).not.toBeNull();
      expect(expense!.status).toBe('PAID');
      expect(Number(expense!.amountBhd)).toBe(20);
    });

    it('creates exactly one expense even if the payout is retried', async () => {
      const item = await deliveredAndAssigned();
      const settlement = await createSettlement({ tailorId, orderItemIds: [item.id], actorId: null as never });
      createdSettlementIds.push(settlement.id);
      await applySettlementAction({ settlementId: settlement.id, action: 'approve', actorId: null as never });
      await applySettlementAction({ settlementId: settlement.id, action: 'transfer', actorId: null as never, transferProofUrl: 'https://x/proof.pdf' });
      await applySettlementAction({ settlementId: settlement.id, action: 'pay', actorId: null as never });

      // A second pay attempt is refused by the state machine, so no second expense.
      await expect(
        applySettlementAction({ settlementId: settlement.id, action: 'pay', actorId: null as never }),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
      const count = await prisma.expense.count({ where: { settlementId: settlement.id } });
      expect(count).toBe(1);
    });

    it('lets only the owning tailor confirm, and only after payment', async () => {
      const item = await deliveredAndAssigned();
      const settlement = await createSettlement({ tailorId, orderItemIds: [item.id], actorId: null as never });
      createdSettlementIds.push(settlement.id);
      await applySettlementAction({ settlementId: settlement.id, action: 'approve', actorId: null as never });
      await applySettlementAction({ settlementId: settlement.id, action: 'transfer', actorId: null as never, transferReference: 'R2' });

      // Not yet paid — confirmation refused.
      await expect(
        confirmSettlementByTailor({ settlementId: settlement.id, tailorId }),
      ).rejects.toBeInstanceOf(SettlementError);

      // Another tailor cannot confirm someone else's settlement.
      await expect(
        confirmSettlementByTailor({ settlementId: settlement.id, tailorId: otherTailorId }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      await applySettlementAction({ settlementId: settlement.id, action: 'pay', actorId: null as never });
      const confirmed = await confirmSettlementByTailor({ settlementId: settlement.id, tailorId });
      expect(confirmed.status).toBe('CONFIRMED');
      expect(confirmed.confirmedByTailorAt).not.toBeNull();
    });

    it('scopes settlement reads to the owning tailor', async () => {
      const item = await deliveredAndAssigned();
      const settlement = await createSettlement({ tailorId, orderItemIds: [item.id], actorId: null as never });
      createdSettlementIds.push(settlement.id);
      expect(await getTailorSettlement(tailorId, settlement.id)).not.toBeNull();
      expect(await getTailorSettlement(otherTailorId, settlement.id)).toBeNull();
      const list = await listTailorSettlements(otherTailorId);
      expect(list.find((s) => s.id === settlement.id)).toBeUndefined();
    });

    it('refuses to settle the same piece twice', async () => {
      const item = await deliveredAndAssigned();
      const settlement = await createSettlement({ tailorId, orderItemIds: [item.id], actorId: null as never });
      createdSettlementIds.push(settlement.id);
      await expect(
        createSettlement({ tailorId, orderItemIds: [item.id], actorId: null as never }),
      ).rejects.toMatchObject({ code: 'ALREADY_SETTLED' });
    });
  });

  describe('tailor notification rules', () => {
    it('suppresses a tailor event when its NotificationRule is disabled', async () => {
      const eventKey = `it6.disabled.${suffix}`;
      await prisma.notificationRule.create({
        data: { eventKey, nameEn: 'IT6 disabled', nameAr: 'معطل', targetType: 'TAILOR', isActive: false },
      });
      const written = await createTailorNotification(
        { tailorId, eventKey: eventKey as never, titleEn: 't', titleAr: 'ت' },
        prisma,
      );
      expect(written).toBe(false);
      const row = await prisma.tailorNotification.findFirst({ where: { tailorId, eventKey } });
      expect(row).toBeNull();
      await prisma.notificationRule.deleteMany({ where: { eventKey, targetType: 'TAILOR' } });
    });

    it('delivers by default when no rule exists', async () => {
      const eventKey = `it6.default.${suffix}`;
      const written = await createTailorNotification(
        { tailorId, eventKey: eventKey as never, titleEn: 't', titleAr: 'ت' },
        prisma,
      );
      expect(written).toBe(true);
    });
  });
});
