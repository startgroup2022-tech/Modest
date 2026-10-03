import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

/**
 * Local-disk media storage for cPanel (no S3/cloud dependency).
 *
 * Uploads land under `public/uploads`, which Next serves as static files and
 * cPanel persists across deploys. `MEDIA_UPLOAD_DIR` overrides the directory;
 * `MEDIA_PUBLIC_PREFIX` overrides the URL prefix if a reverse proxy maps it
 * elsewhere. SVG is deliberately not accepted: it can execute script when
 * opened directly, and operators can still paste an SVG URL for logos.
 */
const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface StoredFile {
  url: string;
  filename: string;
  bytes: number;
  contentType: string;
}

export class MediaError extends Error {}

export function uploadDir(): string {
  return process.env.MEDIA_UPLOAD_DIR ?? path.join(process.cwd(), 'public', 'uploads');
}

function publicPrefix(): string {
  return (process.env.MEDIA_PUBLIC_PREFIX ?? '/uploads').replace(/\/$/, '');
}

/** Validates a browser File and writes it, returning its public URL. */
export async function storeUpload(file: File): Promise<StoredFile> {
  if (!ALLOWED.has(file.type)) {
    throw new MediaError('unsupportedType');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new MediaError('tooLarge');
  }
  if (file.size === 0) {
    throw new MediaError('empty');
  }

  const ext = EXT[file.type] ?? 'bin';
  // Server-generated name only; the client filename never touches the path,
  // which rules out traversal and collisions.
  const filename = `${randomUUID()}.${ext}`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return { url: `${publicPrefix()}/${filename}`, filename, bytes: file.size, contentType: file.type };
}

/** Deletes a previously stored upload. Refuses paths outside the upload dir. */
export async function deleteUpload(publicUrl: string): Promise<boolean> {
  const prefix = `${publicPrefix()}/`;
  if (!publicUrl.startsWith(prefix)) return false;
  const filename = publicUrl.slice(prefix.length);
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) return false;
  try {
    await unlink(path.join(uploadDir(), filename));
    return true;
  } catch {
    return false;
  }
}
