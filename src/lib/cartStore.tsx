'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Port del reducer de carrito de Angular (src/app/redux/app.ts, case CART): mismo
// localStorage key 'APP', mismo shape { cart: [...] } dentro de un blob mas grande -- solo se
// lee/escribe la porcion `cart`, dejando cualquier otra cosa que Angular haya guardado ahi
// intacta (el usuario puede tener sesion abierta en ambos frontends a la vez).
const APP_STORAGE_KEY = 'APP';

export interface CartItem {
  id: number | string;
  titulo?: string;
  foto?: string;
  cantidad?: number;
  costo?: number;
  costoTotal?: number;
  loVendio?: number;
  tallaSelect?: string;
  color?: string;
  codigo?: string;
  coinShop?: boolean;
  [key: string]: unknown;
}

function leerApp(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(APP_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function escribirApp(app: Record<string, unknown>) {
  window.localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(app));
  window.dispatchEvent(new Event('app-storage-changed'));
}

function leerCart(): CartItem[] {
  const app = leerApp();
  return Array.isArray(app.cart) ? (app.cart as CartItem[]) : [];
}

interface CartContextValue {
  cart: CartItem[];
  agregar: (item: CartItem) => void;
  actualizar: (item: CartItem) => void;
  eliminar: (id: CartItem['id']) => void;
  vaciar: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const sync = useCallback(() => setCart(leerCart()), []);

  useEffect(() => {
    sync();
    window.addEventListener('app-storage-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('app-storage-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, [sync]);

  const persistir = (nuevoCart: CartItem[]) => {
    const app = leerApp();
    app.cart = nuevoCart;
    escribirApp(app);
    setCart(nuevoCart);
  };

  const agregar = (item: CartItem) => {
    const actual = leerCart();
    const idx = actual.findIndex((r) => r.id === item.id);
    if (idx > -1) actual[idx] = item;
    else actual.push(item);
    persistir([...actual]);
  };

  const actualizar = (item: CartItem) => {
    const actual = leerCart();
    const idx = actual.findIndex((r) => r.id === item.id);
    if (idx > -1) actual[idx] = item;
    persistir([...actual]);
  };

  const eliminar = (id: CartItem['id']) => {
    persistir(leerCart().filter((r) => r.id !== id));
  };

  const vaciar = () => persistir([]);

  return <CartContext.Provider value={{ cart, agregar, actualizar, eliminar, vaciar }}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
}

// Mismo criterio de formato que ToolsService.monedaChange (separador de miles con punto,
// estilo colombiano), sin replicar la implementacion caracter-por-caracter del original.
export function formatCOP(valor: number | null | undefined): string {
  if (!valor) return '0';
  return Math.round(valor).toLocaleString('es-CO');
}
