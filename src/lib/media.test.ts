import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let dir: string;
let media: typeof import('./media');

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'att-media-'));
  process.env.MEDIA_UPLOAD_DIR = dir;
  media = await import('./media');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MEDIA_UPLOAD_DIR;
});

function file(bytes: number, type: string, name = 'x'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('media storage', () => {
  it('stores an allowed image and serves it under /uploads', async () => {
    const stored = await media.storeUpload(file(16, 'image/png'));
    expect(stored.url.startsWith('/uploads/')).toBe(true);
    expect(stored.url.endsWith('.png')).toBe(true);
    expect(existsSync(path.join(dir, stored.filename))).toBe(true);
  });

  it('rejects a disallowed content type', async () => {
    await expect(media.storeUpload(file(16, 'application/x-php'))).rejects.toThrow(media.MediaError);
  });

  it('rejects an oversized file', async () => {
    await expect(media.storeUpload(file(media.MAX_UPLOAD_BYTES + 1, 'image/png'))).rejects.toThrow(media.MediaError);
  });

  it('rejects an empty file', async () => {
    await expect(media.storeUpload(file(0, 'image/png'))).rejects.toThrow(media.MediaError);
  });

  it('deletes a stored file and refuses paths outside the upload dir', async () => {
    const stored = await media.storeUpload(file(16, 'image/webp'));
    expect(await media.deleteUpload(stored.url)).toBe(true);
    expect(existsSync(path.join(dir, stored.filename))).toBe(false);
    expect(await media.deleteUpload('https://evil.example/x.png')).toBe(false);
    expect(await media.deleteUpload('/uploads/../../etc/passwd')).toBe(false);
  });
});
