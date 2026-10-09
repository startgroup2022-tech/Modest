import { NextResponse } from 'next/server';
import { adminHandler, AdminActionError, auditAdmin } from '@/lib/admin-auth';
import { storeUpload, deleteUpload, MediaError, MAX_UPLOAD_BYTES } from '@/lib/media';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, string> = {
  unsupportedType: 'Unsupported file type. Use JPEG, PNG, WebP, AVIF, GIF or ICO.',
  tooLarge: `File is too large. Maximum size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
  empty: 'The file is empty.',
};

// Uploading requires an edit-level capability in any content-owning group.
const ALLOWED = ['products.edit', 'content.edit', 'promotions.edit', 'seo.edit'] as const;

function canUpload(permissions: { has(p: string): boolean }): boolean {
  return ALLOWED.some((p) => permissions.has(p));
}

export const POST = adminHandler(undefined, async ({ admin, req, ip }) => {
  if (!canUpload(admin.permissions)) throw new AdminActionError('Insufficient permissions', 'FORBIDDEN', 403);

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw new AdminActionError('No file provided', 'NO_FILE', 422);

  try {
    const stored = await storeUpload(file);
    await auditAdmin(admin, 'media.upload', 'Media', stored.filename, { bytes: stored.bytes, type: stored.contentType }, ip);
    return NextResponse.json({ ok: true, ...stored });
  } catch (err) {
    if (err instanceof MediaError) {
      throw new AdminActionError(MESSAGES[err.message] ?? 'Upload failed', err.message, 422);
    }
    throw err;
  }
});

export const DELETE = adminHandler(undefined, async ({ admin, req, ip }) => {
  if (!canUpload(admin.permissions)) throw new AdminActionError('Insufficient permissions', 'FORBIDDEN', 403);

  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === 'string' ? body.url : null;
  if (!url) throw new AdminActionError('No url provided', 'NO_URL', 422);

  const removed = await deleteUpload(url);
  if (removed) await auditAdmin(admin, 'media.delete', 'Media', url, undefined, ip);
  return NextResponse.json({ ok: removed });
});
