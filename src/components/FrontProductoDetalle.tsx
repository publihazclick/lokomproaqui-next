'use client';

import { useEffect, useState } from 'react';
import { FrontHeader } from '@/components/FrontHeader';
import { fetchProductoById, type ProductoLegacy } from '@/lib/productos';
import { resolverTiendaPorTelefono, crearPedidoRapido, agregarAlCarritoFront, fijarVendedorCarritoFront, type TiendaFront } from '@/lib/front';
import { formatCOP } from '@/lib/cartStore';
import { useToast, Toast } from '@/components/Toast';

// Port unificado de ProductosViewComponent + CatalogoComponent (Angular, modulo `portada`) --
// ambos son la MISMA pantalla real (ver un producto especifico + comprar rapido por WhatsApp/
// contra entrega), construida dos veces por separado en el original (rutas
// "productosView/:id/:cel" y "catalogo/:id/:cel"). Se consolida en un solo componente reusado por
// las 2 rutas en vez de mantener 2 copias casi identicas.
//
// El flujo real de compra que SI funciona en el original es el formulario inline (nombre/telefono/
// ciudad/barrio/direccion + talla/color) que crea un pedido real via create_order y abre WhatsApp
// con el resumen -- se porta eso. Los dialogos de compra alternativos de ambos componentes
// originales (`ChecktDialogComponent` desde `comprarArticulo()`, y el propio dialogo de
// `buyArticulo()`) estaban comentados/inalcanzables en el codigo fuente, no se reconstruyen.
//
// Alcance recortado: las 9 reseñas fijas ficticias y el popup periodico de "compras recientes"
// (nombres inventados) del CatalogoComponent original no se replican -- son contenido fabricado,
// decision que se le dejo pendiente al usuario en vez de tomarla en silencio.

export function FrontProductoDetalle({ productoId, telefono }: { productoId: string; telefono: string }) {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-encontrado'>('revisando');
  const [tienda, setTienda] = useState<TiendaFront | null>(null);
  const [producto, setProducto] = useState<ProductoLegacy | null>(null);
  const [fotoActual, setFotoActual] = useState<string>('');
  const [colorSeleccionado, setColorSeleccionado] = useState<string | null>(null);
  const [tallaSeleccionada, setTallaSeleccionada] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [form, setForm] = useState({ nombre: '', telefono: '', ciudad: '', barrio: '', direccion: '', referencia: '' });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, p] = await Promise.all([resolverTiendaPorTelefono(telefono), fetchProductoById(productoId)]);
      if (!t || !p) {
        setEstado('no-encontrado');
        return;
      }
      setTienda(t);
      setProducto(p);
      setFotoActual(p.foto);
      if (p.listColor.length) setColorSeleccionado(p.listColor[0].talla);
      setEstado('listo');
    })();
  }, [productoId, telefono]);

  const colorActual = producto?.listColor.find((c) => c.talla === colorSeleccionado);

  function seleccionarColor(color: string) {
    setColorSeleccionado(color);
    const grupo = producto?.listColor.find((c) => c.talla === color);
    if (grupo) setFotoActual(grupo.foto);
    setTallaSeleccionada(null);
  }

  function agregarAlCarrito() {
    if (!producto || !tienda) return;
    fijarVendedorCarritoFront(tienda.telefono || telefono);
    agregarAlCarritoFront({ productId: producto.id, nombre: producto.pro_nombre, foto: fotoActual, precio: producto.pro_uni_venta, cantidad, talla: tallaSeleccionada, color: colorSeleccionado });
    mostrar('Producto agregado al carro');
  }

  function validar(): boolean {
    if (!form.nombre) {
      mostrar('Error falta el nombre');
      return false;
    }
    if (!form.telefono) {
      mostrar('Error falta el telefono (whatsapp)');
      return false;
    }
    if (!form.direccion) {
      mostrar('Error falta la direccion');
      return false;
    }
    if (!form.ciudad) {
      mostrar('Error falta la ciudad');
      return false;
    }
    // Fase 1 del plan de reduccion de devoluciones (pedido explicito del usuario 2026-07-19):
    // "no encontrado"/"direccion invalida" son las causas #1 de devolucion en contra entrega en
    // Colombia. Barrio y punto de referencia pasan de opcionales a obligatorios -- son la diferencia
    // real entre que el mensajero encuentre la casa o no.
    if (!form.barrio) {
      mostrar('Error falta el barrio');
      return false;
    }
    if (!form.referencia) {
      mostrar('Error falta el punto de referencia (ayuda al mensajero a encontrar la casa)');
      return false;
    }
    if (producto && producto.listColor.length && !colorSeleccionado) {
      mostrar('Error falta el color');
      return false;
    }
    return true;
  }

  async function comprarAhora() {
    if (!validar() || !producto || !tienda) return;
    setEnviando(true);
    // Punto de referencia se guarda dentro de buyer_address (orders no tiene columna propia para
    // esto) -- mismo patron ya usado por "apartamento" en el checkout del carrito.
    const direccionCompleta = `${form.direccion} (Referencia: ${form.referencia})`;
    const res = await crearPedidoRapido(
      tienda.id,
      { nombre: form.nombre, telefono: form.telefono, ciudad: form.ciudad, barrio: form.barrio, direccion: direccionCompleta },
      { productId: producto.id, nombre: producto.pro_nombre, precio: producto.pro_uni_venta, cantidad, talla: tallaSeleccionada, color: colorSeleccionado },
    );
    setEnviando(false);
    if (!res.success) {
      mostrar(res.message || 'No pudimos procesar tu pedido');
      return;
    }
    mostrar('Exitoso! Tu pedido esta en proceso. Un asesor se pondra en contacto contigo.');
    const url = `https://wa.me/57${tienda.telefono}?text=${encodeURIComponent(
      `DATOS DE CONFIRMACIÓN DE COMPRA:\nNombre: ${form.nombre}\nCelular: ${form.telefono}\nDireccion: ${direccionCompleta}\nCiudad: ${form.ciudad}\nCantidad: ${cantidad}\nTalla: ${tallaSeleccionada || '-'}\nColor: ${colorSeleccionado || '-'}\nTotal a pagar: ${producto.pro_uni_venta * cantidad} (PAGO CONTRA ENTREGA)`,
    )}`;
    window.open(url);
  }

  if (estado === 'revisando') return null;
  if (estado === 'no-encontrado' || !producto || !tienda) {
    return <p className="py-16 text-center text-gray-500">Este producto ya no está disponible.</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FrontHeader telefono={tienda.telefono || telefono} />

      <div className="mx-auto w-full max-w-[1000px] px-3 py-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
            <img src={fotoActual} alt={producto.pro_nombre} className="w-full rounded-xl object-cover" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-gray-800">{producto.pro_nombre}</h1>
            <p className="mt-1 text-2xl font-bold text-green-700">$ {formatCOP(producto.pro_uni_venta)}</p>
            {producto.pro_descripcion && (
              <p
                className="mt-2 max-w-full overflow-hidden break-words text-sm text-gray-600 [&_*]:max-w-full [&_img]:h-auto"
                dangerouslySetInnerHTML={{ __html: producto.pro_descripcion }}
              />
            )}

            {producto.listColor.length > 0 && (
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold text-gray-700">Color</label>
                <div className="flex flex-wrap gap-2">
                  {producto.listColor.map((c) => (
                    <button
                      key={c.talla}
                      onClick={() => seleccionarColor(c.talla)}
                      className={`rounded border px-3 py-1.5 text-xs ${colorSeleccionado === c.talla ? 'border-[#0d6efd] bg-blue-50 font-medium' : 'border-gray-300'}`}
                    >
                      {c.talla}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {colorActual && colorActual.tallaSelect.some((t) => t.tal_descripcion && t.tal_descripcion !== 'unico') && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-gray-700">Talla</label>
                <div className="flex flex-wrap gap-2">
                  {colorActual.tallaSelect.map((t) => (
                    <button
                      key={t.id}
                      disabled={!t.check}
                      onClick={() => setTallaSeleccionada(t.tal_descripcion)}
                      className={`rounded border px-3 py-1.5 text-xs disabled:opacity-40 ${tallaSeleccionada === t.tal_descripcion ? 'border-[#0d6efd] bg-blue-50 font-medium' : 'border-gray-300'}`}
                    >
                      {t.tal_descripcion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-700">Cantidad</label>
              <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))} className="w-20 rounded border border-gray-300 px-2 py-1 text-sm" />
            </div>

            <button onClick={agregarAlCarrito} className="mt-4 w-full rounded-full bg-gray-800 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">
              Agregar al carrito
            </button>

            <hr className="my-5" />

            <h3 className="text-sm font-bold text-gray-800">Comprar ahora (pago contra entrega)</h3>
            <div className="mt-2 space-y-2">
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre completo" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Telefono / WhatsApp" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              <input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} placeholder="Ciudad" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              <input value={form.barrio} onChange={(e) => setForm({ ...form, barrio: e.target.value })} placeholder="Barrio" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Direccion" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              <input
                value={form.referencia}
                onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                placeholder="Punto de referencia (ej: casa azul, al lado de la tienda X)"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button onClick={comprarAhora} disabled={enviando} className="mt-3 w-full rounded-full bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">
              {enviando ? 'Procesando…' : 'Comprar ahora'}
            </button>
          </div>
        </div>
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
