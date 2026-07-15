'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchProductoById, codigoCarrito, type ProductoLegacy } from '@/lib/productos';
import { useCart, formatCOP } from '@/lib/cartStore';
import { useToast, Toast } from '@/components/Toast';

// Port 1:1 desde src/app/components/producto-view (Angular) -- pagina de detalle de un producto
// individual (ruta con GuestGuard, exige sesion). A partir de Fase 3 el usuario pidio fidelidad
// visual IDENTICA a la version Angular (no "modernizada" como la Fase 2): el original casi no
// tiene CSS propio, se apoya en clases de Bootstrap 5 por defecto (container/row/col-md-6,
// .form-control, .btn.btn-primary, .text-primary = azul #0d6efd) -- se replica ese mismo look
// con Tailwind en vez de reinterpretar el diseno.
//
// Dos correcciones de bugs reales encontrados al portar (no cambios de diseno, invisibles en
// pantalla):
// 1) `AgregarCart` original hacia `listColor.find(row => row.foto = data.foto)` -- una
//    ASIGNACION (=) en vez de comparacion (===), asi que siempre "encontraba" el primer color de
//    la lista sin importar cual eligiera el usuario en el selector. Se corrige a comparacion real.
// 2) El item que arma esta pagina para el carrito usaba la clave `talla`, pero el resto del
//    sistema (el resumen de carrito/checkout por WhatsApp en el header, y el dialogo real
//    "Agregar" del catalogo `ViewProductosComponent`) lee `tallaSelect` -- con `talla` el resumen
//    de WhatsApp mostraba "Talla: undefined" para productos agregados desde esta pagina en
//    particular. Se usa `tallaSelect` aca tambien, igual que el resto del carrito.
//
// Omision documentada (no es una simplificacion mia): el bloque "Tallas disponibles"
// (`data.listTallas`) y la lista de precios al por mayor (`data.listPrecios`) del HTML original
// nunca pueden aparecer con el backend actual -- `ProductoService.get()` (ya en Supabase) nunca
// llena esos dos campos, ni en Angular ni aca. Se omiten en vez de portar un bloque que jamas
// renderiza nada.

export default function ProductoViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { agregar } = useCart();
  const { mensaje, mostrar } = useToast();

  const [estado, setEstado] = useState<'revisando' | 'cargando' | 'listo' | 'no-encontrado'>('revisando');
  const [data, setData] = useState<ProductoLegacy | null>(null);
  const [foto, setFoto] = useState('');
  const [cantidadAdquirir, setCantidadAdquirir] = useState(1);
  const [rango, setRango] = useState(250);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      setEstado('cargando');
      fetchProductoById(id).then((prod) => {
        if (!prod) {
          setEstado('no-encontrado');
          return;
        }
        setData(prod);
        setFoto(prod.foto);
        setEstado('listo');
      });
    });
  }, [id]);

  if (estado === 'revisando' || estado === 'cargando') return null;

  if (estado === 'no-encontrado' || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-gray-500">Este producto ya no esta disponible.</p>
        <a href="/pedidos" className="mt-3 inline-block text-[#0d6efd] hover:underline">
          Volver Productos
        </a>
      </div>
    );
  }

  function cambioImgs(nuevaFoto: string) {
    setFoto(nuevaFoto);
  }

  function agregarCarrito(opt: { cantidad: number; precios: number; selecciono?: boolean } | false) {
    if (!data) return;
    let color = '';
    let cantidad = cantidadAdquirir || 1;
    let precio = data.pro_uni_venta;

    const matched = data.listColor.find((c) => c.foto === foto);
    if (matched) color = matched.talla;

    let costoTotal: number;
    if (opt) {
      cantidad = opt.cantidad;
      precio = opt.precios;
      costoTotal = precio * cantidad;
    } else {
      costoTotal = (data.pro_uni_venta || 0) * (cantidadAdquirir || 1);
    }

    agregar({
      articulo: data.id,
      codigo: data.pro_codigo,
      titulo: data.pro_nombre,
      color,
      tallaSelect: 'default',
      foto,
      cantidad,
      costo: precio,
      costoTotal,
      id: codigoCarrito(),
    });

    mostrar('Producto agregado al carro');
  }

  return (
    <div className="mx-auto w-full max-w-[540px] px-3 py-8 sm:max-w-[720px] md:max-w-[960px] lg:max-w-[1140px] xl:max-w-[1320px]">
      <p className="text-left">
        <a href="/pedidos" className="text-[#0d6efd] hover:underline">
          Volver Productos
        </a>
      </p>

      <div className="mt-3 flex flex-wrap">
        <div className="w-full px-2 md:w-1/2">
          <div className="overflow-hidden rounded">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de Supabase Storage/legacy assets */}
            <img
              src={foto || '/assets/noimagen.jpg'}
              alt={data.pro_nombre}
              className="w-full max-h-[425px] object-contain transition-transform duration-300 hover:scale-105"
            />
          </div>
        </div>

        <div className="mt-4 w-full px-2 md:mt-0 md:w-1/2">
          <h3 className="text-[1.75rem] font-medium text-[#0d6efd]">
            $ {formatCOP(data.pro_uni_venta)} COP
          </h3>

          {data.listColor.length > 0 && (
            <select
              className="mt-1 block w-full max-w-xs rounded border border-gray-300 px-2 py-1 text-sm"
              value={foto}
              onChange={(e) => cambioImgs(e.target.value)}
            >
              {data.listColor.map((item) => (
                <option key={item.foto} value={item.foto}>
                  {item.talla}
                </option>
              ))}
            </select>
          )}

          <h4 className="mt-2 text-xl font-medium text-gray-900">{data.pro_nombre}</h4>

          <p
            className="mt-1 text-sm leading-relaxed text-gray-700"
            dangerouslySetInnerHTML={{ __html: (data.pro_descripcion || '').slice(0, rango) }}
          />
          {rango === 100 ? (
            <p onClick={() => setRango(5000)} className="cursor-pointer text-sm text-[#0d6efd] hover:underline">
              leer mas..
            </p>
          ) : (
            <p onClick={() => setRango(100)} className="cursor-pointer text-sm text-[#0d6efd] hover:underline">
              leer menos..
            </p>
          )}

          <div className="mt-3 flex justify-center">
            <div>
              <label className="block text-sm text-gray-700">Cantidad Adquirir</label>
              <input
                type="number"
                value={cantidadAdquirir}
                onChange={(e) => setCantidadAdquirir(Number(e.target.value))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
          </div>

          <br />

          {data.checkMayor && (
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-500">Lista de precios al Mayor</div>
            </div>
          )}

          <button
            onClick={() => agregarCarrito(false)}
            type="button"
            className="rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0b5ed7]"
          >
            Agregar
          </button>

          {data.listComment.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h5 className="mb-2 text-sm font-semibold text-gray-700">Comentarios</h5>
              <div className="space-y-3">
                {data.listComment.map((c, idx) => (
                  <div key={idx} className="text-sm">
                    <p className="font-medium text-gray-800">
                      {c.nombre || 'Anonimo'} <span className="font-normal text-gray-400">{c.fecha}</span>
                    </p>
                    <p className="text-gray-600">{c.descripcion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
