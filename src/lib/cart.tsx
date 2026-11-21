import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product } from "./catalog";

export type CartLine = { product: Product; quantity: number };

type CartContextValue = {
  lines: CartLine[];
  count: number;
  total: number;
  add: (product: Product) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "elhawary-store-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // storage full or unavailable - cart still works in memory
    }
  }, [lines]);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const total = lines.reduce((sum, line) => sum + line.quantity * line.product.price, 0);
    return {
      lines,
      count,
      total,
      add: (product) =>
        setLines((prev) => {
          const existing = prev.find((line) => line.product.id === product.id);
          if (existing) {
            return prev.map((line) =>
              line.product.id === product.id ? { ...line, quantity: Math.min(line.quantity + 1, 20) } : line
            );
          }
          return [...prev, { product, quantity: 1 }];
        }),
      remove: (productId) => setLines((prev) => prev.filter((line) => line.product.id !== productId)),
      setQuantity: (productId, quantity) =>
        setLines((prev) =>
          quantity <= 0
            ? prev.filter((line) => line.product.id !== productId)
            : prev.map((line) => (line.product.id === productId ? { ...line, quantity: Math.min(quantity, 20) } : line))
        ),
      clear: () => setLines([]),
      open,
      setOpen,
    };
  }, [lines, open]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart خارج CartProvider");
  return ctx;
}
