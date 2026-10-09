import { NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { uploadDir } from '@/lib/media';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  ico: 'image/x-icon',
};

/**
 * Serves admin uploads at request time. `next start` (and Passenger) only
 * serve files that were present in `public/` at boot, so a file written while
 * the server runs would 404 until restart. Reading from disk per request makes
 * an upload visible immediately and survives no-restart deploys.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  if (!segments?.length) return new NextResponse('Not found', { status: 404 });
  if (!segments.every((s) => /^[A-Za-z0-9._-]+$/.test(s) && s !== '.' && s !== '..')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = segments[segments.length - 1].split('.').pop()?.toLowerCase() ?? '';
  const contentType = MIME[ext];
  if (!contentType) return new NextResponse('Not found', { status: 404 });

  const root = uploadDir();
  const filePath = path.join(root, ...segments);
  try {
    if (!path.resolve(filePath).startsWith(path.resolve(root))) {
      return new NextResponse('Not found', { status: 404 });
    }
    const info = await stat(filePath);
    if (!info.isFile()) return new NextResponse('Not found', { status: 404 });
    const data = await readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(info.size),
        // Filenames are content-unique (UUID), so a long cache is safe.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}

export const runtime = 'nodejs';
