import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { guardApi } from '@/lib/admin-auth';
import { listOrders, resolveRange } from '@/lib/admin/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Hard cap so an export can never pull an unbounded result set into memory. */
const MAX_ROWS = 5000;

const HEADER = [
  'Order Number', 'Date', 'Customer', 'Email', 'Phone', 'Status', 'Channel',
  'Payment', 'Items', 'Subtotal (BHD)', 'Discount (BHD)', 'Shipping (BHD)',
  'Total (BHD)', 'Presentment', 'Presentment Total',
];

export async function GET(req: Request): Promise<Response> {
  const { admin, error } = await guardApi('reports.export');
  if (error || !admin) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const range = resolveRange({ range: sp.get('range'), from: sp.get('from'), to: sp.get('to') });

  const { rows, total } = await listOrders({
    q: sp.get('q') ?? undefined,
    status: sp.get('status') ?? undefined,
    channel: sp.get('channel') ?? undefined,
    paymentStatus: sp.get('paymentStatus') ?? undefined,
    range: sp.get('range') || sp.get('from') || sp.get('to') ? range : undefined,
    sort: (sp.get('sort') as never) ?? 'newest',
    page: 1,
    perPage: MAX_ROWS,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Attention Modest Fashion';
  const ws = wb.addWorksheet('Orders', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = HEADER.map((h) => ({ header: h, key: h, width: Math.max(12, h.length + 2) }));

  for (const o of rows) {
    ws.addRow({
      'Order Number': o.orderNumber,
      Date: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
      Customer: o.shippingName,
      Email: o.email,
      Phone: o.phone,
      Status: o.status,
      Channel: o.channel,
      Payment: o.payments[0]?.status ?? 'UNPAID',
      Items: o.items.reduce((n, i) => n + i.quantity, 0),
      'Subtotal (BHD)': Number(o.subtotalBhd),
      'Discount (BHD)': Number(o.discountBhd),
      'Shipping (BHD)': Number(o.shippingBhd),
      'Total (BHD)': Number(o.totalBhd),
      Presentment: o.presentmentCode ?? 'BHD',
      'Presentment Total': o.presentmentTotal != null ? Number(o.presentmentTotal) : '',
    });
  }

  ws.getRow(1).font = { bold: true };
  ws.getColumn('Date').numFmt = 'yyyy-mm-dd hh:mm';
  for (const key of ['Subtotal (BHD)', 'Discount (BHD)', 'Shipping (BHD)', 'Total (BHD)']) {
    ws.getColumn(key).numFmt = '#,##0.000';
  }
  ws.getColumn('Presentment Total').numFmt = '#,##0.00';
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADER.length } };

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `attention-orders-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Export-Truncated': total > MAX_ROWS ? 'true' : 'false',
    },
  });
}
