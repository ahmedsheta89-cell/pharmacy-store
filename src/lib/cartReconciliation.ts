import type { Product } from './catalog';
import type { CartLine } from './cart';
import { productPhotoIdentity } from './productPhotoMatching.ts';
import { derivedVisibility } from './productVisibility.ts';

export type CartChange = { id: string; name: string; kind: 'unavailable' | 'identity' | 'quantity' | 'price'; before?: number; after?: number };
export const cartTotal = (lines: readonly CartLine[]) => lines.reduce((sum, line) => sum + Math.round(line.product.price * 100) * line.quantity, 0) / 100;

// Fresh server reads are supplied by checkout. Never infer availability from a saved cart.
export function reconcileCart(lines: readonly CartLine[], products: readonly (Product | null)[]): { lines: CartLine[]; changes: CartChange[] } {
  const current = new Map(products.filter((p): p is Product => p !== null).map(p => [p.id, p]));
  const next: CartLine[] = [], changes: CartChange[] = [];
  for (const line of lines) {
    const product = current.get(line.product.id), name = line.product.name;
    if (!product || !product.public_visible || !derivedVisibility(product) || !Number.isFinite(product.price) || product.price < 0 || !Number.isInteger(line.quantity) || line.quantity < 1 || (product.stock_quantity !== undefined && (!Number.isInteger(product.stock_quantity) || product.stock_quantity <= 0))) {
      changes.push({ id: line.product.id, name, kind: 'unavailable' }); continue;
    }
    if (productPhotoIdentity(product) !== productPhotoIdentity(line.product)) {
      changes.push({ id: product.id, name, kind: 'identity' }); continue;
    }
    const quantity = Math.min(line.quantity, 20, product.stock_quantity ?? 20);
    if (quantity !== line.quantity) changes.push({ id: product.id, name, kind: 'quantity', before: line.quantity, after: quantity });
    if (product.price !== line.product.price) changes.push({ id: product.id, name, kind: 'price', before: line.product.price, after: product.price });
    next.push({ product, quantity });
  }
  return { lines: next, changes };
}
