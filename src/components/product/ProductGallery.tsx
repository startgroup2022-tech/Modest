'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { CloseIcon, ZoomIcon } from '@/components/ui/icons';

export interface GalleryImage {
  url: string;
  alt: string;
}

/**
 * Product gallery: swipeable on touch, thumbnail rail on desktop, with a
 * full-screen zoom view. Images keep their natural aspect ratio throughout.
 */
export function ProductGallery({ images, productName }: { images: GalleryImage[]; productName: string }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (!fullscreen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(images.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen, images.length]);

  if (!images.length) {
    return <div className="aspect-product w-full bg-sand-100" />;
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(delta) > 45) {
      const rtl = document.documentElement.dir === 'rtl';
      const forward = rtl ? delta > 0 : delta < 0;
      setIndex((i) => (forward ? Math.min(images.length - 1, i + 1) : Math.max(0, i - 1)));
    }
    touchStart.current = null;
  };

  return (
    <div className="lg:flex lg:gap-5">
      {/* Thumbnail rail — desktop only */}
      {images.length > 1 ? (
        <ul className="hidden shrink-0 flex-col gap-3 lg:flex" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === index}
                className={clsx(
                  'relative block h-24 w-20 overflow-hidden bg-sand-50 transition-opacity',
                  i === index ? 'opacity-100 ring-1 ring-ink' : 'opacity-60 hover:opacity-100',
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Main stage */}
      <div className="relative flex-1">
        <div
          ref={trackRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="relative aspect-product w-full overflow-hidden bg-sand-50"
        >
          {images.map((img, i) => (
            <Image
              key={img.url}
              src={img.url}
              alt={i === 0 ? productName : `${productName} — view ${i + 1}`}
              fill
              priority={i === 0}
              sizes="(max-width: 1023px) 100vw, 55vw"
              className={clsx(
                'object-cover transition-opacity duration-500 ease-luxe',
                i === index ? 'opacity-100' : 'opacity-0',
              )}
            />
          ))}
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            aria-label="Open full screen"
            className="absolute end-4 top-4 flex h-10 w-10 items-center justify-center bg-paper/85 text-ink backdrop-blur-sm transition-colors hover:bg-paper"
          >
            <ZoomIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile dots */}
        {images.length > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-1.5 lg:hidden" aria-hidden="true">
            {images.map((img, i) => (
              <span
                key={img.url}
                className={clsx('h-1 rounded-full transition-all', i === index ? 'w-5 bg-ink' : 'w-1.5 bg-line-strong')}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Fullscreen */}
      {fullscreen ? (
        <div className="fixed inset-0 z-[95] flex flex-col bg-ink/95" role="dialog" aria-modal="true" aria-label={productName}>
          <div className="flex items-center justify-between px-5 py-4 text-paper">
            <span className="text-caption uppercase tracking-[0.14em]">
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              aria-label="Close full screen"
              className="flex h-10 w-10 items-center justify-center"
            >
              <CloseIcon className="h-6 w-6" />
            </button>
          </div>
          <div
            className="relative flex-1"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <Image
              src={images[index].url}
              alt={images[index].alt}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
          {images.length > 1 ? (
            <div className="flex items-center justify-center gap-3 p-5 safe-bottom">
              {images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`View image ${i + 1}`}
                  className={clsx('h-14 w-11 overflow-hidden', i === index ? 'ring-1 ring-paper' : 'opacity-50')}
                >
                  <Image src={img.url} alt="" width={44} height={56} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
