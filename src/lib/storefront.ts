import 'server-only';
import { getActiveCurrencies, getSelectedCurrency } from './currency';
import { getCartView, getWishlistIds } from './cart';
import { getStoreInfo, getSocialLinks, getShippingMethods } from './site';
import { getCategories, getCollections } from './catalog';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

/**
 * Collects everything the storefront chrome needs for a given locale in one
 * place, so every page shares the same header, footer and cart state.
 */
export async function getStorefrontContext(locale: Locale) {
  const [dict, store, socials, cart, wishlist, currencies, selected, categories, collections, shipping] =
    await Promise.all([
      Promise.resolve(getDictionary(locale)),
      getStoreInfo(),
      getSocialLinks(),
      getCartView(),
      getWishlistIds(),
      getActiveCurrencies(),
      getSelectedCurrency(),
      getCategories(),
      getCollections(),
      getShippingMethods(),
    ]);

  const localizedCategories = categories.map((c) => ({
    slug: c.slug,
    name: locale === 'ar' ? c.nameAr : c.nameEn,
    count: c._count.products,
  }));
  const localizedCollections = collections.map((c) => ({
    slug: c.slug,
    name: locale === 'ar' ? c.nameAr : c.nameEn,
    count: c._count.products,
  }));

  const currencyOptions = currencies.map((c) => ({
    code: c.code,
    label: `${c.code} — ${locale === 'ar' ? c.nameAr : c.nameEn}`,
  }));

  return {
    dict,
    store,
    socials: socials.map((s) => ({
      platform: s.platform,
      url: s.url,
      label: (locale === 'ar' ? s.labelAr : s.labelEn) ?? s.platform,
    })),
    cart,
    wishlist,
    currency: selected,
    currencyMeta: {
      code: selected.code,
      symbol: locale === 'ar' ? selected.symbolAr || selected.symbolEn : selected.symbolEn,
      decimals: selected.decimals,
      symbolPosition: selected.symbolPosition,
      rateToBhd: selected.rateToBhd,
    },
    currencyOptions,
    categories: localizedCategories,
    collections: localizedCollections,
    shipping,
  };
}

export type StorefrontContext = Awaited<ReturnType<typeof getStorefrontContext>>;
