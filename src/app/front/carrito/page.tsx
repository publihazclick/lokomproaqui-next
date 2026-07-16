'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { FrontHeader } from '@/components/FrontHeader';
import { leerCarritoFront, quitarDelCarritoFront, leerVendedorCarritoFront, type ItemCarritoFront } from '@/lib/front';
import { formatCOP } from '@/lib/cartStore';

// Port de CarritoComponent (Angular, modulo `portada`, "/front/carrito").

export default function FrontCarritoPage() {
  const [items, setItems] = useState<ItemCarritoFront[]>([]);
  const [telefono, setTelefono] = useState<string | null>(null);

  useEffect(() => {
    setItems(leerCarritoFront());
    setTelefono(leerVendedorCarritoFront());
  }, []);

  function eliminar(id: string) {
    setItems(quitarDelCarritoFront(id));
  }

  const total = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <FrontHeader telefono={telefono || ''} />

      <div className="mx-auto w-full max-w-[800px] px-3 py-6">
        <h3 className="text-xl font-bold text-gray-800">Mi Carrito</h3>

        {items.length === 0 ? (
          <p className="py-10 text-center text-gray-500">Tu carrito está vacío.</p>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto en el carrito */}
                  <img src={item.foto} alt={item.nombre} className="h-16 w-16 rounded object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{item.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {item.talla && `Talla: ${item.talla} · `}
                      {item.color && `Color: ${item.color} · `}Cant: {item.cantidad}
                    </p>
                    <p className="text-sm font-semibold text-green-700">$ {formatCOP(item.precio * item.cantidad)}</p>
                  </div>
                  <button onClick={() => eliminar(item.id)} className="rounded-full bg-red-50 p-2 text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="text-xl font-bold text-green-700">$ {formatCOP(total)}</span>
            </div>

            <Link href="/front/checkouts" className="mt-4 block rounded-full bg-green-600 px-4 py-3 text-center text-sm font-bold text-white hover:opacity-90">
              Confirmar pedido
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
