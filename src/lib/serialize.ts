import 'server-only';
import type { ProductCardData } from '@/components/product/ProductCard';
import { stockLabel, type ProductCard as ProductCardRow } from './catalog';

/** Maps a database product row into the serialisable shape the card needs. */
export function toProductCardData(p: ProductCardRow): ProductCardData {
  return {
    id: p.id,
    slug: p.slug,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    subtitleEn: p.subtitleEn,
    subtitleAr: p.subtitleAr,
    priceBhd: Number(p.priceBhd),
    compareAtBhd: p.compareAtBhd != null ? Number(p.compareAtBhd) : null,
    images: p.media.map((m) => m.url),
    stock: stockLabel(p),
    isNewArrival: p.isNewArrival,
    isFeatured: p.isFeatured,
    madeToOrder: p.madeToOrder,
  };
}
