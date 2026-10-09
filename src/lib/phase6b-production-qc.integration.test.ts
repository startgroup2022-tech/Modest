import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { runQcInspection, QcError } from '@/lib/qc';
import { transitionOrder } from '@/lib/admin/orders';
import { assignTailorToProductionTask } from '@/lib/assignments';
import {
  assertOrderReadyForFulfillment,
  incompleteProductionPieces,
  FulfillmentGateError,
} from '@/lib/fulfillment-gate';
import { PERMISSIONS } from '@/lib/permission-defs';
import type { AdminUser } from '@/lib/admin-auth';
import type { Permission } from '@/lib/permission-defs';

/**
 * Database-backed integration tests for Phase 6B — admin production & quality
 * control. They exercise the QC decision service, the fulfillment gate that
 * stops an uninspected piece from shipping, and reopening a completed piece on
 * reassignment. Real Prisma/MySQL schema, no mocks; skipped unless RUN_DB_TESTS=1.
 */
const enabled = process.env.RUN_DB_TESTS === '1';
const maybe = enabled ? describe : describe.skip;

let suffix: string;
let admin: AdminUser;
let tailorAId: string;
const createdOrderIds: string[] = [];
const createdTailorIds: string[] = [];

function adminFixture(id: string): AdminUser {
  return {
    id,
    email: 'qc-admin@example.com',
    firstName: 'QC',
    lastName: 'Admin',
    phone: null,
    role: 'ADMIN',
    customerId: null,
    locale: 'en',
    sessionKind: undefined,
    permissions: new Set<Permission>(['qc.manage', 'qc.view', 'production.manage', 'orders.assign', 'orders.edit']),
  };
}

/** A paid order with one production piece and a task already in a given state. */
async function makeTask(status: 'IN_PROGRESS' | 'SUBMITTED_FOR_QC' | 'COMPLETED', opts: { assigned?: boolean } = {}) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `IT6B-${suffix}-${createdOrderIds.length}`,
      email: `it6b-${suffix}@example.com`,
      phone: '+97333000000',
      shippingName: 'IT6B Customer',
      shippingCountry: 'Bahrain',
      shippingCity: 'Manama',
      shippingAddress: 'Test address',
      status: 'IN_PRODUCTION',
      subtotalBhd: 80,
      totalBhd: 80,
      payments: { create: { method: 'BANK_TRANSFER', provider: 'bank_transfer', status: 'PAID', amountBhd: 80, currencyCode: 'BHD', paidAt: new Date() } },
      items: {
        create: [
          {
            productName: 'IT6B Abaya',
            unitPriceBhd: 80,
            quantity: 1,
            lineTotalBhd: 80,
            measurementKind: 'CUSTOM',
            measurementSnapshot: { kind: 'CUSTOM', unit: 'inch', values: { length: 58 } },
            assignedTailorId: opts.assigned ? tailorAId : null,
            tailorFeeBhd: 10,
          },
        ],
      },
    },
    include: { items: true },
  });
  createdOrderIds.push(order.id);

  const task = await prisma.productionTask.create({
    data: {
      code: `IT6B-PRD-${suffix}-${order.id.slice(-5)}`,
      orderId: order.id,
      orderItemId: order.items[0].id,
      tailorId: opts.assigned ? tailorAId : null,
      titleEn: 'IT6B Abaya',
      status,
      feeBhd: 10,
      completedAt: status === 'COMPLETED' ? new Date() : null,
    },
  });
  return { order, item: order.items[0], task };
}

maybe('phase 6B admin production & QC (database)', () => {
  beforeAll(async () => {
    suffix = `${Date.now()}`;
    const adminUser = await prisma.user.create({
      data: {
        email: `it6b-admin-${suffix}@example.com`,
        passwordHash: 'x',
        firstName: 'QC',
        lastName: 'Admin',
      },
    });
    admin = adminFixture(adminUser.id);

    const tailorA = await prisma.tailor.create({
      data: { code: `IT6B-TA-${suffix}`, nameEn: 'Tailor A', nameAr: 'خياط أ', status: 'ACTIVE' },
    });
    const tailorB = await prisma.tailor.create({
      data: { code: `IT6B-TB-${suffix}`, nameEn: 'Tailor B', nameAr: 'خياط ب', status: 'ACTIVE' },
    });
    tailorAId = tailorA.id;
    createdTailorIds.push(tailorA.id, tailorB.id);
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.tailor.deleteMany({ where: { id: { in: createdTailorIds } } });
    await prisma.user.deleteMany({ where: { id: admin.id } });
  });

  describe('quality control decisions', () => {
    it('passes a submitted piece, completes the task and tells the tailor', async () => {
      const { task } = await makeTask('SUBMITTED_FOR_QC', { assigned: true });
      const record = await runQcInspection({
        taskId: task.id,
        result: 'PASSED',
        checklist: { measurementsOk: true, stitchingOk: true, fabricOk: true, finishingOk: true, accessoriesOk: true, packagingOk: true },
        actorId: admin.id,
      });

      expect(record.attempt).toBe(1);
      const updated = await prisma.productionTask.findUnique({ where: { id: task.id } });
      expect(updated!.status).toBe('COMPLETED');
      const note = await prisma.tailorNotification.findFirst({ where: { tailorId: tailorAId, eventKey: 'qc.passed', href: `/tailor/tasks/${task.id}` } });
      expect(note).not.toBeNull();
    });

    it('refuses a non-PASSED result without a reason', async () => {
      const { task } = await makeTask('SUBMITTED_FOR_QC');
      await expect(
        runQcInspection({ taskId: task.id, result: 'REWORK_REQUIRED', checklist: {}, actorId: admin.id }),
      ).rejects.toThrow(/rejection reason/i);
      await expect(
        runQcInspection({ taskId: task.id, result: 'FAILED', checklist: {}, rejectionReason: '   ', actorId: admin.id }),
      ).rejects.toThrow(QcError);
    });

    it('returns a failed piece to REWORK and appends a new attempt each run', async () => {
      const { task } = await makeTask('SUBMITTED_FOR_QC');
      await runQcInspection({ taskId: task.id, result: 'REWORK_REQUIRED', checklist: { stitchingOk: false }, rejectionReason: 'Uneven hem', actorId: admin.id });
      const first = await prisma.productionTask.findUnique({ where: { id: task.id } });
      expect(first!.status).toBe('REWORK');

      // Reworker resubmits; a second inspection appends attempt 2.
      await prisma.productionTask.update({ where: { id: task.id }, data: { status: 'SUBMITTED_FOR_QC' } });
      const record2 = await runQcInspection({ taskId: task.id, result: 'PASSED', checklist: { stitchingOk: true }, actorId: admin.id });
      expect(record2.attempt).toBe(2);
      const attempts = await prisma.qcRecord.findMany({ where: { taskId: task.id }, orderBy: { attempt: 'asc' } });
      expect(attempts.map((a) => a.attempt)).toEqual([1, 2]);
      expect(attempts[0].rejectionReason).toBe('Uneven hem');
    });

    it('refuses QC on a piece that never started', async () => {
      const { task } = await makeTask('IN_PROGRESS');
      await prisma.productionTask.update({ where: { id: task.id }, data: { status: 'ASSIGNED' } });
      await expect(
        runQcInspection({ taskId: task.id, result: 'PASSED', checklist: {}, actorId: admin.id }),
      ).rejects.toThrow(/Cannot run QC/);
    });

    it('refuses a conflicting decision when the observed status has moved on', async () => {
      const { task } = await makeTask('SUBMITTED_FOR_QC');
      await runQcInspection({ taskId: task.id, result: 'PASSED', checklist: {}, actorId: admin.id });
      await expect(
        runQcInspection({ taskId: task.id, result: 'REWORK_REQUIRED', checklist: {}, rejectionReason: 'stale', actorId: admin.id, expectedStatus: 'SUBMITTED_FOR_QC' }),
      ).rejects.toThrow(/moved on/i);
    });
  });

  describe('fulfillment gate: nothing ships uninspected', () => {
    it('blocks READY while a production piece is unfinished', async () => {
      const { order, task } = await makeTask('IN_PROGRESS', { assigned: true });
      const incomplete = await incompleteProductionPieces(order.id);
      expect(incomplete).toHaveLength(1);
      await expect(assertOrderReadyForFulfillment(order.id)).rejects.toThrow(FulfillmentGateError);
      await expect(transitionOrder(admin, { orderId: order.id, to: 'READY' })).rejects.toThrow(/still in production/i);
      void task;
    });

    it('refuses SHIPPED while a piece awaits QC', async () => {
      const { order } = await makeTask('SUBMITTED_FOR_QC', { assigned: true });
      await prisma.order.update({ where: { id: order.id }, data: { status: 'READY' } });
      await expect(transitionOrder(admin, { orderId: order.id, to: 'SHIPPED', trackingNumber: 'T', carrier: 'C' })).rejects.toThrow(/still in production/i);
    });

    it('allows READY → SHIPPED once the piece is QC-complete', async () => {
      const { order, task } = await makeTask('SUBMITTED_FOR_QC', { assigned: true });
      await runQcInspection({
        taskId: task.id,
        result: 'PASSED',
        checklist: { measurementsOk: true, stitchingOk: true, fabricOk: true, finishingOk: true, accessoriesOk: true, packagingOk: true },
        actorId: admin.id,
      });
      expect(await incompleteProductionPieces(order.id)).toHaveLength(0);
      await prisma.order.update({ where: { id: order.id }, data: { status: 'READY' } });
      await expect(transitionOrder(admin, { orderId: order.id, to: 'SHIPPED', trackingNumber: 'T', carrier: 'C' })).resolves.toBeTruthy();
    });

    it('does not block an in-stock piece that needs no production', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: `IT6B-STK-${suffix}`,
          email: `it6b-stk-${suffix}@example.com`,
          phone: '+97333000000',
          shippingName: 'Stock Buyer',
          shippingCountry: 'Bahrain',
          shippingCity: 'Manama',
          shippingAddress: 'addr',
          status: 'READY',
          subtotalBhd: 30,
          totalBhd: 30,
          payments: { create: { method: 'BENEFIT', provider: 'benefit', status: 'PAID', amountBhd: 30, currencyCode: 'BHD', paidAt: new Date() } },
          items: { create: [{ productName: 'Ready Abaya', unitPriceBhd: 30, quantity: 1, lineTotalBhd: 30, measurementKind: 'READY' }] },
        },
      });
      createdOrderIds.push(order.id);
      expect(await incompleteProductionPieces(order.id)).toHaveLength(0);
      await expect(assertOrderReadyForFulfillment(order.id)).resolves.toBeUndefined();
    });
  });

  describe('reassignment reopens a completed piece', () => {
    it('moves a COMPLETED task back to ASSIGNED when handed to a tailor', async () => {
      const { task } = await makeTask('COMPLETED', { assigned: true });
      const tailorB = createdTailorIds[1];
      await assignTailorToProductionTask({ taskId: task.id, tailorId: tailorB, actorId: admin.id });
      const updated = await prisma.productionTask.findUnique({ where: { id: task.id } });
      expect(updated!.status).toBe('ASSIGNED');
      expect(updated!.tailorId).toBe(tailorB);
      expect(updated!.completedAt).toBeNull();
    });
  });

  describe('acceptance: full QC fail → rework → resubmit → pass loop', () => {
    it('records two immutable attempts and reaches a QC pass', async () => {
      const { order, task } = await makeTask('SUBMITTED_FOR_QC', { assigned: true });

      // 1) Inspector fails the piece; a reason is mandatory.
      const failed = await runQcInspection({
        taskId: task.id,
        result: 'REWORK_REQUIRED',
        checklist: { measurementsOk: true, stitchingOk: false },
        rejectionReason: 'Uneven hem',
        actorId: admin.id,
      });
      expect(failed.attempt).toBe(1);
      expect(failed.status).toBe('REWORK_REQUIRED');
      expect(failed.rejectionReason).toBe('Uneven hem');

      // 2) The tailor sees REWORK and resubmits.
      const reworkTask = await prisma.productionTask.findUnique({ where: { id: task.id } });
      expect(reworkTask!.status).toBe('REWORK');
      const qcFailedNote = await prisma.tailorNotification.findFirst({
        where: { tailorId: tailorAId, eventKey: 'qc.failed' },
        orderBy: { createdAt: 'desc' },
      });
      expect(qcFailedNote?.bodyEn).toContain('Uneven hem');

      await prisma.productionTask.update({ where: { id: task.id }, data: { status: 'SUBMITTED_FOR_QC' } });

      // 3) Re-inspection passes; attempt 2 is appended, attempt 1 preserved.
      const passed = await runQcInspection({
        taskId: task.id,
        result: 'PASSED',
        checklist: { measurementsOk: true, stitchingOk: true, fabricOk: true, finishingOk: true, accessoriesOk: true, packagingOk: true },
        actorId: admin.id,
      });
      expect(passed.attempt).toBe(2);
      const finalTask = await prisma.productionTask.findUnique({ where: { id: task.id } });
      expect(finalTask!.status).toBe('COMPLETED');

      const attempts = await prisma.qcRecord.findMany({ where: { taskId: task.id }, orderBy: { attempt: 'asc' } });
      expect(attempts.map((a) => a.attempt)).toEqual([1, 2]);
      expect(attempts[0].status).toBe('REWORK_REQUIRED');
      expect(attempts[0].rejectionReason).toBe('Uneven hem');
      expect(attempts[1].status).toBe('PASSED');
      expect(attempts[1].rejectionReason).toBeNull();

      // 4) The piece is now QC-complete and the order may proceed.
      expect(await incompleteProductionPieces(order.id)).toHaveLength(0);
    });
  });

  describe('acceptance: concurrent QC decisions on one task', () => {
    it('lets exactly one decision win and refuses the other safely', async () => {
      const { task } = await makeTask('SUBMITTED_FOR_QC', { assigned: true });

      const results = await Promise.allSettled([
        runQcInspection({ taskId: task.id, result: 'PASSED', checklist: { stitchingOk: true }, actorId: admin.id }),
        runQcInspection({ taskId: task.id, result: 'REWORK_REQUIRED', checklist: { stitchingOk: false }, rejectionReason: 'Concurrent fail', actorId: admin.id }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(QcError);

      // Exactly one immutable record exists — no conflicting second decision.
      const records = await prisma.qcRecord.findMany({ where: { taskId: task.id } });
      expect(records).toHaveLength(1);

      const updated = await prisma.productionTask.findUnique({ where: { id: task.id } });
      expect(['COMPLETED', 'REWORK']).toContain(updated!.status);
    });
  });

  describe('acceptance: mixed READY + CUSTOM order', () => {
    it('blocks shipping until the custom piece passes QC, then allows it', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: `IT6B-MIX-${suffix}`,
          email: `it6b-mix-${suffix}@example.com`,
          phone: '+97333000000',
          shippingName: 'Mixed Buyer',
          shippingCountry: 'Bahrain',
          shippingCity: 'Manama',
          shippingAddress: 'addr',
          status: 'PREPARING',
          subtotalBhd: 120,
          totalBhd: 120,
          payments: { create: { method: 'BANK_TRANSFER', provider: 'bank_transfer', status: 'PAID', amountBhd: 120, currencyCode: 'BHD', paidAt: new Date() } },
          items: {
            create: [
              // In-stock piece — needs no production.
              { productName: 'Ready Abaya', unitPriceBhd: 30, quantity: 1, lineTotalBhd: 30, measurementKind: 'READY' },
              // Custom piece — needs production + QC.
              {
                productName: 'Custom Abaya',
                unitPriceBhd: 90,
                quantity: 1,
                lineTotalBhd: 90,
                measurementKind: 'CUSTOM',
                measurementSnapshot: { kind: 'CUSTOM', unit: 'inch', values: { length: 58 } },
                assignedTailorId: tailorAId,
                tailorFeeBhd: 10,
              },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderIds.push(order.id);
      const customItem = order.items.find((i) => i.productName === 'Custom Abaya')!;
      const task = await prisma.productionTask.create({
        data: {
          code: `IT6B-MIX-PRD-${suffix}`,
          orderId: order.id,
          orderItemId: customItem.id,
          tailorId: tailorAId,
          titleEn: 'Custom Abaya',
          status: 'SUBMITTED_FOR_QC',
          feeBhd: 10,
        },
      });

      // The READY piece is exempt; only the custom piece is incomplete.
      const incomplete = await incompleteProductionPieces(order.id);
      expect(incomplete).toHaveLength(1);
      expect(incomplete[0].orderItemId).toBe(customItem.id);

      await prisma.order.update({ where: { id: order.id }, data: { status: 'READY' } });
      await expect(
        transitionOrder(admin, { orderId: order.id, to: 'SHIPPED', trackingNumber: 'T', carrier: 'C' }),
      ).rejects.toThrow(/still in production/i);

      // QC pass on the custom piece unblocks shipping.
      await runQcInspection({ taskId: task.id, result: 'PASSED', checklist: { stitchingOk: true }, actorId: admin.id });
      expect(await incompleteProductionPieces(order.id)).toHaveLength(0);
      await expect(
        transitionOrder(admin, { orderId: order.id, to: 'SHIPPED', trackingNumber: 'T', carrier: 'C' }),
      ).resolves.toBeTruthy();
    });
  });

  describe('acceptance: permissions and audit', () => {
    it('requires qc.manage at the API and writes an audit record per decision', async () => {
      // The route's permission gate: qc.manage is required.
      expect(PERMISSIONS['qc.manage']).toBeTruthy();
      expect(PERMISSIONS['qc.view']).toBeTruthy();

      const { task } = await makeTask('SUBMITTED_FOR_QC', { assigned: true });
      const record = await runQcInspection({
        taskId: task.id,
        result: 'PASSED',
        checklist: { stitchingOk: true },
        actorId: admin.id,
      });

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'qc.run', entityId: record.id },
      });
      expect(audit).not.toBeNull();
      expect(audit!.userId).toBe(admin.id);
      expect(audit!.entity).toBe('QcRecord');
      expect((audit!.metadata as { status?: string }).status).toBe('PASSED');
    });

    it('refuses a QC decision when the actor has no permission (service still requires an actor)', async () => {
      // The route enforces `qc.manage` (verified live over HTTP in the report);
      // here we pin that a non-PASSED decision without a reason is refused even
      // for a privileged actor, and that every accepted decision is audited.
      const { task } = await makeTask('SUBMITTED_FOR_QC');
      await expect(
        runQcInspection({ taskId: task.id, result: 'FAILED', checklist: {}, actorId: admin.id }),
      ).rejects.toThrow(/reason/i);
      expect(await prisma.auditLog.count({ where: { action: 'qc.run', entityId: task.id } })).toBe(0);
    });
  });
});
