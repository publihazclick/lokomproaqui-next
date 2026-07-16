'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, MessageCircle } from 'lucide-react';
import { leerCarritoFront } from '@/lib/front';

// Port de MenuComponent (Angular, header de la vitrina "/front") -- logo + carrito + WhatsApp.
// Se omiten (confirmados no funcionales en el original, no se replican): login con Facebook
// (SocialAuthService nunca conectado a una sesion real) y el boton de pago con ePayco del menu
// original (`openEpayco()`, referencia una variable `URL` inexistente -- error de JS garantizado
// si se hubiera usado, `createPago()` tampoco persiste nada).

export function FrontHeader({ telefono }: { telefono: string }) {
  const [cantidad, setCantidad] = useState(0);

  useEffect(() => {
    setCantidad(leerCarritoFront().length);
    const onStorage = () => setCantidad(leerCarritoFront().length);
    window.addEventListener('storage', onStorage);
    window.addEventListener('front-cart-updated', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('front-cart-updated', onStorage);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0d6efd] px-4 py-3 text-white shadow-sm">
      <Link href={`/front/${telefono}`} className="text-lg font-bold">
        LokomproAqui
      </Link>
      <div className="flex items-center gap-3">
        <a href={`https://wa.me/57${telefono}`} target="_blank" rel="noreferrer" className="rounded-full bg-white/15 p-2">
          <MessageCircle className="h-5 w-5" />
        </a>
        <Link href="/front/carrito" className="relative rounded-full bg-white/15 p-2">
          <ShoppingCart className="h-5 w-5" />
          {cantidad > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">{cantidad}</span>}
        </Link>
      </div>
    </header>
  );
}
