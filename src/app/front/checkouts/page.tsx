'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FrontHeader } from '@/components/FrontHeader';
import { leerCarritoFront, leerVendedorCarritoFront, resolverTiendaPorTelefono, crearPedidoCarrito, vaciarCarritoFront, type ItemCarritoFront, type TiendaFront } from '@/lib/front';
import { departamento } from '@/lib/departamentos';
import { formatCOP } from '@/lib/cartStore';
import { useToast, Toast } from '@/components/Toast';

// Port de ChecktComponent (Angular, modulo `portada`, "/front/checkouts") -- checkout real de
// carrito completo (multi-item), conectado de verdad al RPC create_order (VentasService.createOrder,
// ya confirmado bien implementado, sin bugs).

export default function FrontChecktPage() {
  const { mensaje, mostrar } = useToast();
  const [items, setItems] = useState<ItemCarritoFront[]>([]);
  const [tienda, setTienda] = useState<TiendaFront | null>(null);
  const [vista, setVista] = useState<'inicial' | 'segunda' | 'completado'>('inicial');
  const [data, setData] = useState({ nombre: '', telefono: '', ciudad: '', barrio: '', direccion: '', apartamento: '', departamento: '' });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      const cart = leerCarritoFront();
      setItems(cart);
      const telefono = leerVendedorCarritoFront();
      if (telefono) setTienda(await resolverTiendaPorTelefono(telefono));
      if (cart.length === 0) window.location.href = telefono ? `/front/${telefono}` : '/info';
    })();
  }, []);

  const total = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);

  function validarPrimero(): boolean {
    if (!data.nombre) {
      mostrar('Error Por Favor Completar campos nombre');
      return false;
    }
    if (!data.telefono) {
      mostrar('Error Por Favor Completar campos telefono');
      return false;
    }
    if (!data.ciudad) {
      mostrar('Error Por Favor Completar campos ciudad');
      return false;
    }
    if (!data.barrio) {
      mostrar('Error Por Favor Completar campos barrio');
      return false;
    }
    if (!data.direccion) {
      mostrar('Error Por Favor Completar campos direccion');
      return false;
    }
    if (!data.departamento) {
      mostrar('Error Por Favor Completar campos departamento');
      return false;
    }
    return true;
  }

  function siguiente() {
    if (validarPrimero()) setVista('segunda');
  }

  async function finalizar() {
    if (!tienda || enviando) return;
    setEnviando(true);
    const res = await crearPedidoCarrito(tienda.id, { nombre: data.nombre, telefono: data.telefono, ciudad: data.ciudad, barrio: data.barrio, direccion: `${data.direccion}${data.apartamento ? ' Apto ' + data.apartamento : ''}` }, items);
    setEnviando(false);
    if (!res.success) {
      mostrar(res.message || 'No pudimos procesar tu pedido');
      return;
    }
    mostrar('Exitoso! Tu pedido esta en proceso. Un asesor se pondra en contacto contigo.');
    vaciarCarritoFront();
    setVista('completado');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FrontHeader telefono={tienda?.telefono || ''} />

      <div className="mx-auto w-full max-w-[700px] px-3 py-6">
        {vista === 'completado' ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <h3 className="text-xl font-bold text-green-700">¡Pedido confirmado!</h3>
            <p className="mt-2 text-sm text-gray-600">Un asesor se pondra en contacto contigo pronto.</p>
            <Link href={tienda ? `/front/${tienda.telefono}` : '/info'} className="mt-4 inline-block rounded-full bg-[#0d6efd] px-6 py-2.5 text-sm font-bold text-white">
              Seguir comprando
            </Link>
          </div>
        ) : (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800">Finalizar compra</h3>
            <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
              <span>{items.length} producto(s)</span>
              <span className="font-semibold text-green-700">$ {formatCOP(total)}</span>
            </div>

            {vista === 'inicial' ? (
              <div className="mt-4 space-y-2">
                <input value={data.nombre} onChange={(e) => setData({ ...data, nombre: e.target.value })} placeholder="Nombre completo" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                <input value={data.telefono} onChange={(e) => setData({ ...data, telefono: e.target.value })} placeholder="Telefono" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                <select value={data.departamento} onChange={(e) => setData({ ...data, departamento: e.target.value })} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                  <option value="">Selecciona departamento</option>
                  {departamento.map((d: any) => (
                    <option key={d.departamento} value={d.departamento}>
                      {d.departamento}
                    </option>
                  ))}
                </select>
                <input value={data.ciudad} onChange={(e) => setData({ ...data, ciudad: e.target.value })} placeholder="Ciudad" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                <input value={data.barrio} onChange={(e) => setData({ ...data, barrio: e.target.value })} placeholder="Barrio" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                <input value={data.direccion} onChange={(e) => setData({ ...data, direccion: e.target.value })} placeholder="Direccion" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                <input value={data.apartamento} onChange={(e) => setData({ ...data, apartamento: e.target.value })} placeholder="Apartamento (opcional)" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                <button onClick={siguiente} className="w-full rounded-full bg-[#0d6efd] px-4 py-2.5 text-sm font-bold text-white">
                  Siguiente
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Pago contra entrega. Revisa tus datos antes de confirmar:</p>
                <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  <p>{data.nombre} — {data.telefono}</p>
                  <p>
                    {data.direccion} {data.apartamento && `Apto ${data.apartamento}`}, {data.barrio}, {data.ciudad} ({data.departamento})
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setVista('inicial')} className="flex-1 rounded-full bg-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700">
                    Atras
                  </button>
                  <button onClick={finalizar} disabled={enviando} className="flex-1 rounded-full bg-green-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                    {enviando ? 'Procesando…' : 'Confirmar pedido'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
