'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface CartPiece {
  id: string;
  pieceIndex: number;
  kind: 'READY' | 'CUSTOM' | null;
  sizeCode: string | null;
  measurements: { key: string; labelEn: string; labelAr: string; value: number; unit: string }[];
}

export type CartPieceInput =
  | { mode: 'READY'; sizeCode: string }
  | { mode: 'CUSTOM'; values: Record<string, number>; profileId?: string | null };

export interface CartLine {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  nameEn: string;
  nameAr: string;
  slug: string;
  image: string | null;
  size: string | null;
  unitPriceBhd: number;
  lineTotalBhd: number;
  stockStatus: string;
  available: boolean;
  pieces: CartPiece[];
  needsMeasurements: boolean;
}

export interface CartState {
  id: string | null;
  items: CartLine[];
  count: number;
  subtotalBhd: number;
}

export interface CurrencyMeta {
  code: string;
  symbol: string;
  decimals: number;
  symbolPosition: 'prefix' | 'suffix';
  rateToBhd: number;
}

interface StoreContextValue {
  cart: CartState;
  wishlist: string[];
  currency: string;
  currencyMeta: CurrencyMeta;
  busy: boolean;
  cartOpen: boolean;
  searchOpen: boolean;
  setCartOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  addItem: (productId: string, variantId: string | null, quantity?: number, pieces?: CartPieceInput[]) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  toggleWishlist: (productId: string) => Promise<boolean>;
  setCurrency: (code: string) => Promise<void>;
  flash: string | null;
  setFlash: (message: string | null) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const EMPTY_CART: CartState = { id: null, items: [], count: 0, subtotalBhd: 0 };

export function StoreProvider({
  children,
  initialCart,
  initialWishlist,
  initialCurrency,
  currencyMeta,
}: {
  children: React.ReactNode;
  initialCart: CartState;
  initialWishlist: string[];
  initialCurrency: string;
  currencyMeta: CurrencyMeta;
}) {
  const [cart, setCart] = useState<CartState>(initialCart);
  const [wishlist, setWishlist] = useState<string[]>(initialWishlist);
  const [currency, setCurrencyState] = useState(initialCurrency);
  const [busy, setBusy] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3200);
    return () => clearTimeout(t);
  }, [flash]);

  const refreshCart = useCallback(async () => {
    const res = await fetch('/api/cart', { cache: 'no-store' });
    if (res.ok) setCart(await res.json());
  }, []);

  const addItem = useCallback(async (productId: string, variantId: string | null, quantity = 1, pieces?: CartPieceInput[]) => {
    setBusy(true);
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, variantId, quantity, pieces }),
      });
      if (res.ok) {
        setCart(await res.json());
        setCartOpen(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setFlash(data.error ?? 'Unable to add to bag');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    setBusy(true);
    try {
      const res = await fetch('/api/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, quantity }),
      });
      if (res.ok) setCart(await res.json());
    } finally {
      setBusy(false);
    }
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/cart?itemId=${encodeURIComponent(itemId)}`, { method: 'DELETE' });
      if (res.ok) setCart(await res.json());
    } finally {
      setBusy(false);
    }
  }, []);

  const toggleWishlist = useCallback(async (productId: string) => {
    const res = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    if (res.ok) {
      const data = (await res.json()) as { saved: boolean; ids: string[] };
      setWishlist(data.ids);
      return data.saved;
    }
    return false;
  }, []);

  const setCurrency = useCallback(async (code: string) => {
    await fetch('/api/currency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    setCurrencyState(code);
    window.location.reload();
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      cart,
      wishlist,
      currency,
      currencyMeta,
      busy,
      cartOpen,
      searchOpen,
      setCartOpen,
      setSearchOpen,
      addItem,
      updateItem,
      removeItem,
      refreshCart,
      toggleWishlist,
      setCurrency,
      flash,
      setFlash,
    }),
    [cart, wishlist, currency, currencyMeta, busy, cartOpen, searchOpen, addItem, updateItem, removeItem, refreshCart, toggleWishlist, setCurrency, flash],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    return {
      cart: EMPTY_CART,
      wishlist: [],
      currency: 'BHD',
      currencyMeta: { code: 'BHD', symbol: 'BHD', decimals: 3, symbolPosition: 'prefix', rateToBhd: 1 },
      busy: false,
      cartOpen: false,
      searchOpen: false,
      setCartOpen: () => {},
      setSearchOpen: () => {},
      addItem: async () => {},
      updateItem: async () => {},
      removeItem: async () => {},
      refreshCart: async () => {},
      toggleWishlist: async () => false,
      setCurrency: async () => {},
      flash: null,
      setFlash: () => {},
    };
  }
  return ctx;
}
