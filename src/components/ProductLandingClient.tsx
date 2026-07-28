'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, ChevronDown, Flame, Minus, MessageCircle, Plus, ShieldCheck, ShoppingCart, Truck, PackageCheck } from 'lucide-react';
import type { ProductoLegacy, ProductoColor } from '@/lib/productos';
import { crearPedidoRapido, agregarAlCarritoFront, fijarVendedorCarritoFront, type TiendaFront } from '@/lib/front';
import { formatCOP } from '@/lib/cartStore';
import { useToast, Toast } from '@/components/Toast';
import { PixelScripts } from '@/components/PixelScripts';
import { pixelViewContent, pixelInitiateCheckout, pixelPurchase } from '@/lib/adPixels';

// Landing de producto de alta conversion (pedido explicito del usuario 2026-07-28: "landing
// profesional de alta conversion apta para trafico de campañas pagas"), pensada para alguien que
// llega desde un anuncio pago, no para un usuario ya navegando el catalogo. Diferencias
// deliberadas frente a FrontProductoDetalle.tsx (la vista de producto normal de la vitrina):
// - Sin header/menu del sitio (RealHeader la excluye via RUTAS_SIN_HEADER) -- cero distracciones
//   entre el anuncio y la compra.
// - Estructura larga tipo landing (beneficios, como funciona, reseñas reales si existen, FAQ) en
//   vez de solo foto+formulario -- pensada para dar confianza a un visitante que nunca oyo hablar
//   de la tienda ni del vendedor.
// - Barra fija inferior en movil con precio + CTA, y pixeles de Meta/TikTok/GA4 (ver adPixels.ts).
// A proposito NO se fabrica ningun dato falso: ni reseñas inventadas, ni contador de "gente viendo
// esto ahora", ni precio "antes" tachado (no existe un campo de precio de comparacion real en el
// esquema) -- toda la urgencia/prueba social que se muestra sale de datos reales del producto.

export function ProductLandingClient({ producto, tienda, galeriaProducto }: { producto: ProductoLegacy; tienda: TiendaFront; galeriaProducto: string[] }) {
  const { mensaje, mostrar } = useToast();
  // Inicializador perezoso (no un efecto) -- la primera variante con color se preselecciona en el
  // primer render, sin el "parpadeo" de un render sin color seguido de otro con color ya elegido.
  const [colorSeleccionado, setColorSeleccionado] = useState<string | null>(() => {
    const primera = producto.listColor[0];
    return primera?.esVariante ? primera.talla : null;
  });
  const [tallaSeleccionada, setTallaSeleccionada] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [fotoIndex, setFotoIndex] = useState(0);
  const [mostrarBarraFija, setMostrarBarraFija] = useState(false);
  const [descripcionAbierta, setDescripcionAbierta] = useState(false);
  const [faqAbierta, setFaqAbierta] = useState<number | null>(0);
  const [form, setForm] = useState({ nombre: '', telefono: '', ciudad: '', barrio: '', direccion: '', referencia: '' });
  const [enviando, setEnviando] = useState(false);
  const [pedidoOk, setPedidoOk] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const hayVariante1 = producto.listColor.some((c) => c.esVariante);
  const colorActual: ProductoColor | undefined = producto.listColor.find((c) => c.talla === colorSeleccionado);
  const stockTotal = producto.listColor.reduce((acc, c) => acc + c.tallaSelect.reduce((a, t) => a + Math.max(0, t.cantidad), 0), 0);
  const agotado = stockTotal <= 0;

  // Galeria: por defecto las fotos del producto completo (mas ricas -- suelen tener varios angulos
  // aunque el producto no tenga variantes de color con foto propia). Si el color elegido tiene sus
  // propias fotos reales (mas de una, o distinta a la generica), se cambia a esas -- mismo criterio
  // que un ecommerce premium (la foto sigue a la variante elegida cuando existe).
  const fotosVisibles = useMemo(() => {
    if (colorActual && colorActual.galeriaList.length > 1) return colorActual.galeriaList.map((g) => g.foto);
    if (colorActual && colorActual.foto && colorActual.foto !== producto.foto) return [colorActual.foto];
    return galeriaProducto.length ? galeriaProducto : [producto.foto];
  }, [colorActual, galeriaProducto, producto.foto]);

  // Indice de foto clamped en vez de resetear con un efecto: si el color elegido cambia y trae
  // menos fotos que el indice actual, cae al ultimo valido en el mismo render (sin frame con un
  // indice fuera de rango ni un efecto extra solo para sincronizar este numero).
  const fotoIndexValido = Math.min(fotoIndex, fotosVisibles.length - 1);

  useEffect(() => {
    pixelViewContent({ id: producto.id, nombre: producto.pro_nombre, precio: producto.pro_uni_venta });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = heroRef.current ? heroRef.current.getBoundingClientRect().bottom : 0;
      setMostrarBarraFija(y < 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function seleccionarColor(color: string) {
    setColorSeleccionado(color);
    setTallaSeleccionada(null);
    setFotoIndex(0);
  }

  function irAComprar() {
    pixelInitiateCheckout({ id: producto.id, nombre: producto.pro_nombre, precio: producto.pro_uni_venta, cantidad });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function agregarAlCarrito() {
    fijarVendedorCarritoFront(tienda.telefono || '');
    agregarAlCarritoFront({
      productId: producto.id,
      nombre: producto.pro_nombre,
      foto: fotosVisibles[0],
      precio: producto.pro_uni_venta,
      cantidad,
      talla: tallaSeleccionada,
      color: colorSeleccionado,
      colorLabel: hayVariante1 ? producto.variante1Label : null,
      tallaLabel: tallaSeleccionada ? producto.variante2Label || 'Talla' : null,
    });
    mostrar('Producto agregado al carrito');
  }

  function validar(): boolean {
    if (hayVariante1 && !colorSeleccionado) {
      mostrar(`Elige ${producto.variante1Label.toLowerCase()}`);
      return false;
    }
    if (!form.nombre) return mostrar('Falta tu nombre'), false;
    if (!form.telefono) return mostrar('Falta tu celular (WhatsApp)'), false;
    if (!form.ciudad) return mostrar('Falta la ciudad'), false;
    if (!form.barrio) return mostrar('Falta el barrio'), false;
    if (!form.direccion) return mostrar('Falta la dirección'), false;
    // Fase 1 del plan de reduccion de devoluciones (mismo criterio que FrontProductoDetalle): el
    // punto de referencia es la diferencia real entre que el mensajero encuentre la casa o no.
    if (!form.referencia) return mostrar('Falta un punto de referencia para el mensajero'), false;
    return true;
  }

  async function confirmarCompra() {
    if (!validar() || enviando) return;
    setEnviando(true);
    const direccionCompleta = `${form.direccion} (Referencia: ${form.referencia})`;
    const res = await crearPedidoRapido(
      tienda.id,
      { nombre: form.nombre, telefono: form.telefono, ciudad: form.ciudad, barrio: form.barrio, direccion: direccionCompleta },
      { productId: producto.id, nombre: producto.pro_nombre, precio: producto.pro_uni_venta, cantidad, talla: tallaSeleccionada, color: colorSeleccionado },
    );
    setEnviando(false);
    if (!res.success) {
      mostrar(res.message || 'No pudimos procesar tu pedido, intenta de nuevo');
      return;
    }
    pixelPurchase({ id: producto.id, nombre: producto.pro_nombre, precio: producto.pro_uni_venta, cantidad }, res.id!);
    setPedidoOk(true);
  }

  const beneficios = useMemo(() => extraerBeneficios(producto.pro_descripcion), [producto.pro_descripcion]);

  return (
    <div className="min-h-screen bg-white pb-24 sm:pb-0">
      <PixelScripts />

      {/* Barra superior de confianza -- copy honesto, sin numeros inventados. */}
      <div className="bg-[#0177a8] px-3 py-2 text-center text-[11px] font-semibold text-white sm:text-xs">
        🔒 Compra segura &nbsp;·&nbsp; 📦 Pago contra entrega &nbsp;·&nbsp; 🚚 Envío a toda Colombia
      </div>

      <div ref={heroRef} className="mx-auto grid w-full max-w-[1100px] grid-cols-1 gap-6 px-3 py-6 sm:grid-cols-2 sm:gap-10 sm:py-10">
        {/* Galeria */}
        <div>
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gray-100 shadow-sm">
            <Image src={fotosVisibles[fotoIndexValido] || producto.foto} alt={producto.pro_nombre} fill unoptimized priority sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
            {agotado && (
              <span className="absolute left-3 top-3 rounded-full bg-gray-900/85 px-3 py-1 text-xs font-bold text-white">Agotado</span>
            )}
          </div>
          {fotosVisibles.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {fotosVisibles.map((foto, i) => (
                <button
                  key={`${foto}-${i}`}
                  onClick={() => setFotoIndex(i)}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === fotoIndexValido ? 'border-[#0177a8]' : 'border-transparent opacity-70'}`}
                >
                  <Image src={foto} alt="" fill unoptimized sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info + CTA */}
        <div>
          {producto.pro_categoria && (
            <span className="mb-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0177a8]">
              {producto.pro_categoria.cat_nombre}
            </span>
          )}
          <h1 className="text-2xl font-extrabold leading-tight text-gray-900 sm:text-3xl">{producto.pro_nombre}</h1>
          {producto.pro_descripcionbreve && <p className="mt-2 text-sm text-gray-500">{producto.pro_descripcionbreve}</p>}

          <p className="mt-4 text-3xl font-extrabold text-[#0177a8] sm:text-4xl">$ {formatCOP(producto.pro_uni_venta)}</p>

          {!agotado && stockTotal <= 10 && (
            <p className="mt-1 flex items-center gap-1 text-sm font-bold text-amber-600">
              <Flame className="h-4 w-4" /> Solo quedan {stockTotal} unidades disponibles
            </p>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-gray-600">
            <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 px-2 py-2.5">
              <Truck className="h-5 w-5 text-[#0177a8]" /> Envío 24h
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 px-2 py-2.5">
              <PackageCheck className="h-5 w-5 text-[#0177a8]" /> Pago al recibir
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 px-2 py-2.5">
              <ShieldCheck className="h-5 w-5 text-[#0177a8]" /> Compra segura
            </div>
          </div>

          {hayVariante1 && (
            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-bold text-gray-700">{producto.variante1Label}</label>
              <div className="flex flex-wrap gap-2">
                {producto.listColor.map((c) => (
                  <button
                    key={c.talla}
                    onClick={() => seleccionarColor(c.talla)}
                    className={`rounded-xl border-2 px-3.5 py-2 text-sm font-semibold transition ${
                      colorSeleccionado === c.talla ? 'border-[#0177a8] bg-blue-50 text-[#0177a8]' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {c.talla}
                  </button>
                ))}
              </div>
            </div>
          )}

          {colorActual && colorActual.tallaSelect.some((t) => t.tal_descripcion && t.tal_descripcion !== 'unico') && (
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-bold text-gray-700">{producto.variante2Label || 'Talla'}</label>
              <div className="flex flex-wrap gap-2">
                {colorActual.tallaSelect.map((t) => (
                  <button
                    key={t.id}
                    disabled={!t.check}
                    onClick={() => setTallaSeleccionada(t.tal_descripcion)}
                    className={`rounded-xl border-2 px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${
                      tallaSeleccionada === t.tal_descripcion ? 'border-[#0177a8] bg-blue-50 text-[#0177a8]' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {t.tal_descripcion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <span className="text-xs font-bold text-gray-700">Cantidad</span>
            <div className="flex items-center rounded-xl border-2 border-gray-200">
              <button onClick={() => setCantidad((n) => Math.max(1, n - 1))} className="p-2.5 text-gray-500 hover:text-gray-800" aria-label="Menos">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm font-bold">{cantidad}</span>
              <button onClick={() => setCantidad((n) => n + 1)} className="p-2.5 text-gray-500 hover:text-gray-800" aria-label="Más">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <button
            onClick={irAComprar}
            disabled={agotado}
            className="boton-pulso mt-5 w-full rounded-2xl bg-[#0177a8] px-6 py-4 text-base font-extrabold text-white shadow-lg transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ ['--boton-glow' as string]: 'rgba(1,119,168,0.55)' }}
          >
            {agotado ? 'Agotado' : '🛒 Comprar ahora'}
          </button>
          <button onClick={agregarAlCarrito} disabled={agotado} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            <ShoppingCart className="h-4 w-4" /> Agregar al carrito
          </button>
          <a
            href={`https://wa.me/57${tienda.telefono}?text=${encodeURIComponent(`Hola, tengo dudas sobre ${producto.pro_nombre}`)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#25D366]/10 py-3 text-sm font-bold text-[#128C4A] hover:bg-[#25D366]/20"
          >
            <MessageCircle className="h-4 w-4" /> Preguntar por WhatsApp
          </a>
        </div>
      </div>

      {beneficios.length > 0 && (
        <section className="border-t border-gray-100 bg-gray-50 px-3 py-10">
          <div className="mx-auto max-w-[760px]">
            <h2 className="text-center text-xl font-extrabold text-gray-900">¿Por qué te va a encantar?</h2>
            <ul className="mt-5 space-y-3">
              {beneficios.map((b, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-white p-3.5 shadow-sm">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0177a8] text-white">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span className="text-sm text-gray-700">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {producto.pro_descripcion && (
        <section className="border-t border-gray-100 px-3 py-10">
          <div className="mx-auto max-w-[760px]">
            <h2 className="text-xl font-extrabold text-gray-900">Descripción del producto</h2>
            <div
              className={`prose prose-sm mt-4 max-w-none overflow-hidden break-words text-gray-600 [&_*]:max-w-full ${descripcionAbierta ? '' : 'max-h-40'}`}
              dangerouslySetInnerHTML={{ __html: producto.pro_descripcion }}
            />
            <button onClick={() => setDescripcionAbierta((v) => !v)} className="mt-2 text-sm font-bold text-[#0177a8]">
              {descripcionAbierta ? 'Ver menos' : 'Ver más'}
            </button>
          </div>
        </section>
      )}

      <section className="border-t border-gray-100 bg-gray-50 px-3 py-10">
        <div className="mx-auto max-w-[900px]">
          <h2 className="text-center text-xl font-extrabold text-gray-900">Cómo funciona tu compra</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { emoji: '🛒', title: 'Compra ahora', desc: 'Confirma tus datos, sin pagar nada por adelantado.' },
              { emoji: '📦', title: 'Lo preparamos', desc: 'Empacamos y despachamos tu pedido en 24 horas hábiles.' },
              { emoji: '💵', title: 'Pagas al recibir', desc: 'Le pagas al mensajero cuando el pedido llega a tu puerta.' },
            ].map((p) => (
              <div key={p.title} className="rounded-2xl bg-white p-5 text-center shadow-sm">
                <span className="text-4xl">{p.emoji}</span>
                <h3 className="mt-2 text-sm font-extrabold text-gray-900">{p.title}</h3>
                <p className="mt-1 text-xs text-gray-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {producto.listComment.length > 0 && (
        <section className="border-t border-gray-100 px-3 py-10">
          <div className="mx-auto max-w-[760px]">
            <h2 className="text-xl font-extrabold text-gray-900">Lo que dicen quienes ya compraron</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {producto.listComment.slice(0, 6).map((c, i) => (
                <div key={i} className="rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-sm italic text-gray-700">“{c.descripcion}”</p>
                  <p className="mt-2 text-xs font-bold text-gray-500">{c.nombre || 'Comprador verificado'} · {c.fecha}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-gray-100 bg-gray-50 px-3 py-10">
        <div className="mx-auto max-w-[700px]">
          <h2 className="text-center text-xl font-extrabold text-gray-900">Preguntas frecuentes</h2>
          <div className="mt-5 space-y-2">
            {FAQ.map((f, i) => (
              <div key={i} className="overflow-hidden rounded-xl bg-white shadow-sm">
                <button onClick={() => setFaqAbierta(faqAbierta === i ? null : i)} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-bold text-gray-800">
                  {f.q}
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${faqAbierta === i ? 'rotate-180' : ''}`} />
                </button>
                {faqAbierta === i && <p className="px-4 pb-4 text-sm text-gray-600">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formulario final de compra */}
      <section ref={formRef} id="comprar" className="border-t border-gray-100 px-3 py-10">
        <div className="mx-auto max-w-[500px] rounded-3xl border border-gray-100 p-5 shadow-lg sm:p-7">
          {pedidoOk ? (
            <div className="py-8 text-center">
              <span className="text-5xl">🎉</span>
              <h3 className="mt-3 text-lg font-extrabold text-gray-900">¡Pedido confirmado!</h3>
              <p className="mt-2 text-sm text-gray-500">Un asesor se pondrá en contacto contigo por WhatsApp para coordinar la entrega. Pagas cuando lo recibes.</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-extrabold text-gray-900">Finaliza tu pedido</h2>
              <p className="mt-1 text-sm text-gray-500">
                {producto.pro_nombre} · ${formatCOP(producto.pro_uni_venta)} x {cantidad} = <strong>${formatCOP(producto.pro_uni_venta * cantidad)}</strong>
              </p>
              <div className="mt-4 space-y-2.5">
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre completo" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm" />
                <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Celular / WhatsApp" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm" />
                <input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} placeholder="Ciudad" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm" />
                <input value={form.barrio} onChange={(e) => setForm({ ...form, barrio: e.target.value })} placeholder="Barrio" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm" />
                <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Dirección" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm" />
                <input
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                  placeholder="Punto de referencia (ej: casa azul, junto a la tienda X)"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm"
                />
              </div>
              <button
                onClick={confirmarCompra}
                disabled={enviando || agotado}
                className="boton-pulso mt-4 w-full rounded-2xl bg-green-600 px-6 py-4 text-base font-extrabold text-white shadow-lg disabled:opacity-60"
                style={{ ['--boton-glow' as string]: 'rgba(22,163,74,0.55)' }}
              >
                {enviando ? 'Procesando…' : `Confirmar pedido · $${formatCOP(producto.pro_uni_venta * cantidad)}`}
              </button>
              <p className="mt-2 text-center text-[11px] text-gray-400">No pagas nada ahora. Pagas contra entrega.</p>
            </>
          )}
        </div>
      </section>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">LokomproAqui · lokomproaqui.com</footer>

      {/* Barra fija movil */}
      {mostrarBarraFija && !pedidoOk && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-gray-100 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
          <div className="min-w-0">
            <p className="truncate text-xs text-gray-500">{producto.pro_nombre}</p>
            <p className="text-base font-extrabold text-[#0177a8]">$ {formatCOP(producto.pro_uni_venta)}</p>
          </div>
          <button onClick={irAComprar} disabled={agotado} className="shrink-0 rounded-xl bg-[#0177a8] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-40">
            {agotado ? 'Agotado' : 'Comprar ahora'}
          </button>
        </div>
      )}

      <Toast mensaje={mensaje} />
    </div>
  );
}

const FAQ = [
  { q: '¿Cómo pago?', a: 'Pagas contra entrega: le pagas en efectivo o transferencia al mensajero cuando el pedido llega a tu dirección. No necesitas pagar nada por adelantado.' },
  { q: '¿Cuánto tarda en llegar mi pedido?', a: 'El pedido se despacha en 24 horas hábiles después de confirmarlo. El tiempo de entrega depende de tu ciudad.' },
  { q: '¿A qué ciudades hacen envíos?', a: 'Hacemos envíos a toda Colombia a través de las principales transportadoras del país.' },
  { q: '¿Es seguro comprar aquí?', a: 'Sí. Tu pedido queda registrado en la plataforma y un asesor te confirma los datos por WhatsApp antes del despacho.' },
];

// Extrae hasta 5 lineas con contenido real de la descripcion del proveedor para armar bullets de
// beneficios -- no se inventa texto nuevo, solo se reformatea lo que el proveedor ya escribio (le
// quita las etiquetas HTML y descarta lineas vacias o demasiado largas para verse bien como bullet).
function extraerBeneficios(descripcionHtml: string | null): string[] {
  if (!descripcionHtml) return [];
  const texto = descripcionHtml.replace(/<[^>]+>/g, '\n');
  const lineas = texto
    .split(/\n|\r/)
    .map((l) => l.replace(/&nbsp;/g, ' ').trim())
    .filter((l) => l.length >= 8 && l.length <= 110);
  return Array.from(new Set(lineas)).slice(0, 5);
}
