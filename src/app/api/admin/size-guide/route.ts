import { NextResponse } from 'next/server';
import { adminHandler, auditAdmin, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { actionSchema } from '@/lib/admin/size-guide-schema';

export const dynamic = 'force-dynamic';

/**
 * Admin size-guide management. Every mutation is permission-gated by
 * `settings.edit`. Deletions that would break a live product's measurement
 * configuration are refused; historical order snapshots are stored as JSON on
 * the order item, so guide edits never rewrite a past order.
 */
export const POST = adminHandler('settings.edit', async ({ admin, req, ip }) => {
  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }
  const action = parsed.data;

  switch (action.action) {
    case 'create_cut': {
      const dupe = await prisma.productCut.findUnique({ where: { code: action.data.code } });
      if (dupe) return NextResponse.json({ error: 'That cut code is already in use' }, { status: 409 });
      const cut = await prisma.productCut.create({
        data: {
          ...action.data,
          descriptionEn: action.data.descriptionEn || null,
          descriptionAr: action.data.descriptionAr || null,
          sizeCharts: { create: { unit: 'inch' } },
        },
      });
      await auditAdmin(admin, 'size_guide.cut_create', 'ProductCut', cut.id, { code: cut.code }, ip);
      return NextResponse.json({ ok: true, id: cut.id });
    }

    case 'update_cut': {
      const { id, ...data } = action.data;
      const existing = await prisma.productCut.findUnique({ where: { id } });
      if (!existing) throw new AdminActionError('Cut not found', 'NOT_FOUND', 404);
      if (data.code && data.code !== existing.code) {
        const dupe = await prisma.productCut.findUnique({ where: { code: data.code } });
        if (dupe) return NextResponse.json({ error: 'That cut code is already in use' }, { status: 409 });
      }
      await prisma.productCut.update({
        where: { id },
        data: {
          ...data,
          ...(data.descriptionEn !== undefined ? { descriptionEn: data.descriptionEn || null } : {}),
          ...(data.descriptionAr !== undefined ? { descriptionAr: data.descriptionAr || null } : {}),
        },
      });
      await auditAdmin(admin, 'size_guide.cut_update', 'ProductCut', id, {}, ip);
      return NextResponse.json({ ok: true });
    }

    case 'delete_cut': {
      const { id } = action.data;
      const [products, orderItems] = await Promise.all([
        prisma.product.count({ where: { cutId: id } }),
        prisma.orderItem.count({ where: { cutId: id } }),
      ]);
      if (products > 0 || orderItems > 0) {
        // Archive rather than delete: history and live products stay intact.
        await prisma.productCut.update({ where: { id }, data: { isActive: false } });
        await auditAdmin(admin, 'size_guide.cut_archive', 'ProductCut', id, { products, orderItems }, ip);
        return NextResponse.json({ ok: true, archived: true });
      }
      await prisma.productCut.delete({ where: { id } });
      await auditAdmin(admin, 'size_guide.cut_delete', 'ProductCut', id, {}, ip);
      return NextResponse.json({ ok: true });
    }

    case 'create_field': {
      const { sizeValues, cutId, minValue, maxValue, helperEn, helperAr, ...rest } = action.data;
      const cut = await prisma.productCut.findUnique({ where: { id: cutId }, include: { sizeCharts: true } });
      if (!cut) throw new AdminActionError('Cut not found', 'NOT_FOUND', 404);
      const dupe = await prisma.measurementField.findUnique({ where: { cutId_key: { cutId, key: rest.key } } });
      if (dupe) return NextResponse.json({ error: 'That field key already exists for this cut' }, { status: 409 });

      const chart = cut.sizeCharts[0] ?? (await prisma.sizeChart.create({ data: { cutId } }));

      const field = await prisma.$transaction(async (tx) => {
        const created = await tx.measurementField.create({
          data: {
            ...rest,
            cutId,
            minValue: minValue ?? null,
            maxValue: maxValue ?? null,
            helperEn: helperEn || null,
            helperAr: helperAr || null,
          },
        });
        if (sizeValues) {
          const rows = Object.entries(sizeValues)
            .filter(([, v]) => Number.isFinite(v))
            .map(([sizeCode, value], i) => ({ chartId: chart.id, fieldId: created.id, sizeCode, value, sortOrder: i }));
          if (rows.length) await tx.sizeChartValue.createMany({ data: rows });
        }
        return created;
      });
      await auditAdmin(admin, 'size_guide.field_create', 'MeasurementField', field.id, { cutId, key: field.key }, ip);
      return NextResponse.json({ ok: true, id: field.id });
    }

    case 'update_field': {
      const { id, cutId, sizeValues, sizes, minValue, maxValue, helperEn, helperAr, ...rest } = action.data;
      const existing = await prisma.measurementField.findUnique({ where: { id } });
      if (!existing) throw new AdminActionError('Field not found', 'NOT_FOUND', 404);
      const chart = (await prisma.sizeChart.findUnique({ where: { cutId } })) ?? (await prisma.sizeChart.create({ data: { cutId } }));

      await prisma.$transaction(async (tx) => {
        await tx.measurementField.update({
          where: { id },
          data: {
            ...rest,
            ...(minValue !== undefined ? { minValue: minValue ?? null } : {}),
            ...(maxValue !== undefined ? { maxValue: maxValue ?? null } : {}),
            ...(helperEn !== undefined ? { helperEn: helperEn || null } : {}),
            ...(helperAr !== undefined ? { helperAr: helperAr || null } : {}),
          },
        });
        if (sizeValues) {
          for (const [sizeCode, value] of Object.entries(sizeValues)) {
            await tx.sizeChartValue.upsert({
              where: { chartId_fieldId_sizeCode: { chartId: chart.id, fieldId: id, sizeCode } },
              update: { value },
              create: { chartId: chart.id, fieldId: id, sizeCode, value },
            });
          }
        }
        if (sizes) {
          // Removing a size must remove its cells so the guide cannot show a
          // size with a stale value.
          await tx.sizeChartValue.deleteMany({
            where: { fieldId: id, sizeCode: { notIn: sizes } },
          });
        }
      });
      await auditAdmin(admin, 'size_guide.field_update', 'MeasurementField', id, {}, ip);
      return NextResponse.json({ ok: true });
    }

    case 'delete_field': {
      const { id } = action.data;
      const field = await prisma.measurementField.findUnique({ where: { id } });
      if (!field) throw new AdminActionError('Field not found', 'NOT_FOUND', 404);
      const [activeFields, products] = await Promise.all([
        prisma.measurementField.count({ where: { cutId: field.cutId, isActive: true, id: { not: id } } }),
        prisma.product.count({ where: { cutId: field.cutId } }),
      ]);
      // A cut that backs live products must keep at least one measurement field.
      if (activeFields === 0 && products > 0) {
        return NextResponse.json(
          { error: "This is the cut's only measurement field and products use it. Deactivate the cut instead.", code: 'IN_USE' },
          { status: 409 },
        );
      }
      await prisma.measurementField.delete({ where: { id } });
      await auditAdmin(admin, 'size_guide.field_delete', 'MeasurementField', id, { key: field.key }, ip);
      return NextResponse.json({ ok: true });
    }
  }
});
