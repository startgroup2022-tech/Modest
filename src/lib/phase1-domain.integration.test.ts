import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { nextSequenceStandalone } from '@/lib/sequences';
import { createSettlement, applySettlementAction, SettlementError } from '@/lib/settlements';

/**
 * Database-backed integration tests for the Phase 1 domain foundation.
 *
 * These exercise the real Prisma/MySQL code paths (sequence allocation under
 * concurrency, settlement creation from frozen fees, and the settlement state
 * machine) rather than mocks. They are skipped unless RUN_DB_TESTS=1 so the
 * default unit suite stays runnable without a database.
 */
const enabled = process.env.RUN_DB_TESTS === '1';
const maybe = enabled ? describe : describe.skip;

let actorId: string;
let tailorAId: string;
let tailorBId: string;
let productId: string;
let orderId: string;

maybe('phase 1 domain foundation (database)', () => {
  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const actor = await prisma.user.create({
      data: { email: `it-actor-${suffix}@test.local`, passwordHash: 'x', firstName: 'IT', lastName: 'Actor' },
    });
    actorId = actor.id;

    const [tA, tB] = await Promise.all([
      prisma.tailor.create({ data: { code: `IT-A-${suffix}`, nameEn: 'IT Atelier A', nameAr: 'أ', rateBhd: 10 } }),
      prisma.tailor.create({ data: { code: `IT-B-${suffix}`, nameEn: 'IT Atelier B', nameAr: 'ب', rateBhd: 12 } }),
    ]);
    tailorAId = tA.id;
    tailorBId = tB.id;

    const product = await prisma.product.create({
      data: {
        slug: `it-product-${suffix}`,
        nameEn: 'IT Product',
        nameAr: 'منتج',
        descriptionEn: 'x',
        descriptionAr: 'س',
        priceBhd: 100,
        sku: `IT-${suffix}`,
        status: 'ACTIVE',
        tailorFeeBhd: 15,
      },
    });
    productId = product.id;

    const order = await prisma.order.create({
      data: {
        orderNumber: `IT-${suffix}`,
        email: 'it@test.local',
        phone: '+97300000000',
        shippingName: 'IT',
        shippingCountry: 'BH',
        shippingCity: 'Manama',
        shippingAddress: 'x',
        subtotalBhd: 200,
        totalBhd: 200,
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    if (!enabled) return;
    // Clean up in dependency order; only rows created by this suite are touched.
    await prisma.tailorSettlementItem.deleteMany({ where: { settlement: { tailorId: { in: [tailorAId, tailorBId] } } } });
    await prisma.tailorSettlement.deleteMany({ where: { tailorId: { in: [tailorAId, tailorBId] } } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.tailor.deleteMany({ where: { id: { in: [tailorAId, tailorBId] } } });
    await prisma.auditLog.deleteMany({ where: { userId: actorId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
  });

  it('allocates unique sequential numbers under concurrency', async () => {
    const key = `it:${Date.now()}`;
    const numbers = await Promise.all(
      Array.from({ length: 25 }, () => nextSequenceStandalone({ key, prefix: 'IT', pad: 4 })),
    );
    const unique = new Set(numbers);
    expect(unique.size).toBe(25);
    const sorted = [...numbers].sort();
    expect(sorted[0]).toBe('IT-0001');
    expect(sorted[24]).toBe('IT-0025');
  });

  it('creates a settlement from frozen fees and rejects a duplicate', async () => {
    const item = await prisma.orderItem.create({
      data: {
        orderId,
        productId,
        productName: 'IT Product',
        quantity: 1,
        unitPriceBhd: 100,
        lineTotalBhd: 100,
        assignedTailorId: tailorAId,
        tailorFeeBhd: 15,
      },
    });

    const settlement = await createSettlement({ tailorId: tailorAId, orderItemIds: [item.id], actorId });
    expect(Number(settlement.grossBhd)).toBe(15);
    expect(Number(settlement.netBhd)).toBe(15);
    expect(settlement.status).toBe('PENDING');
    expect(settlement.number).toMatch(/^STL-\d{6}$/);

    await expect(createSettlement({ tailorId: tailorAId, orderItemIds: [item.id], actorId })).rejects.toThrow(
      SettlementError,
    );
  });

  it('rejects settling a piece assigned to a different tailor', async () => {
    const item = await prisma.orderItem.create({
      data: {
        orderId,
        productId,
        productName: 'IT Product',
        quantity: 1,
        unitPriceBhd: 100,
        lineTotalBhd: 100,
        assignedTailorId: tailorAId,
        tailorFeeBhd: 15,
      },
    });
    await expect(createSettlement({ tailorId: tailorBId, orderItemIds: [item.id], actorId })).rejects.toThrow(
      SettlementError,
    );
  });

  it('enforces the settlement state machine end to end', async () => {
    const item = await prisma.orderItem.create({
      data: {
        orderId,
        productId,
        productName: 'IT Product',
        quantity: 1,
        unitPriceBhd: 100,
        lineTotalBhd: 100,
        assignedTailorId: tailorAId,
        tailorFeeBhd: 20,
      },
    });
    const settlement = await createSettlement({ tailorId: tailorAId, orderItemIds: [item.id], actorId });

    // Cannot transfer before approval.
    await expect(
      applySettlementAction({ settlementId: settlement.id, action: 'transfer', actorId, transferReference: 'x' }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

    await applySettlementAction({ settlementId: settlement.id, action: 'approve', actorId });

    // Transfer requires a proof reference.
    await expect(
      applySettlementAction({ settlementId: settlement.id, action: 'transfer', actorId }),
    ).rejects.toMatchObject({ code: 'PROOF_REQUIRED' });

    const transferred = await applySettlementAction({
      settlementId: settlement.id,
      action: 'transfer',
      actorId,
      transferReference: 'BENEFIT-123',
    });
    expect(transferred.status).toBe('TRANSFERRED');
    expect(transferred.transferReference).toBe('BENEFIT-123');

    const paid = await applySettlementAction({ settlementId: settlement.id, action: 'pay', actorId });
    expect(paid.status).toBe('PAID');
    expect(Number(paid.paidBhd)).toBe(20);

    // Never pay twice.
    await expect(applySettlementAction({ settlementId: settlement.id, action: 'pay', actorId })).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
  });
});
