'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  Flame,
  Home,
  Lock,
  MapPin,
  Minus,
  MessageCircle,
  Phone,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  User,
  PackageCheck,
} from 'lucide-react';
import type { ProductoLegacy, ProductoColor } from '@/lib/productos';
import { crearPedidoRapido, agregarAlCarritoFront, fijarVendedorCarritoFront, type TiendaFront } from '@/lib/front';
import { formatCOP } from '@/lib/cartStore';
import { useToast, Toast } from '@/components/Toast';
import { PixelScripts } from '@/components/PixelScripts';
import { pixelViewContent, pixelInitiateCheckout, pixelPurchase } from '@/lib/adPixels';

// Landing de producto de alta conversion (pedido explicito del usuario 2026-07-28: "landing
// profesional de alta conversion apta para trafico de campañas pagas... que se vea de nivel
// experto/2026, no algo mediocre"). Segunda pasada de diseño (la primera version funcionaba pero
// se veia "generica", pedido explicito del usuario) -- mismo estado/logica de siempre, pero cada
// seccion se redisenio con jerarquia visual real: hero con degradado + tarjetas flotantes con
// sombra/profundidad, badges con circulos de icono a color, animacion de entrada escalonada
// (landing-fade-up, ver globals.css), y mas contraste entre secciones.
//
// A proposito NO se fabrica ningun dato falso para "verse mas de alta conversion": ni reseñas
// inventadas, ni contador de "gente viendo esto ahora", ni precio "antes" tachado (no existe un
// campo de precio de comparacion real en el esquema). El badge "Producto verificado" SI es honesto
// -- fetchProductoById ya excluye productos de proveedores no aprobados, asi que todo lo que llega
// aca paso esa revision real.

export function ProductLandingClient({ producto, tienda, galeriaProducto }: { producto: ProductoLegacy; tienda: TiendaFront; galeriaProducto: string[] }) {
  const { mensaje, mostrar } = useToast();
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

  const fotosVisibles = useMemo(() => {
    if (colorActual && colorActual.galeriaList.length > 1) return colorActual.galeriaList.map((g) => g.foto);
    if (colorActual && colorActual.foto && colorActual.foto !== producto.foto) return [colorActual.foto];
    return galeriaProducto.length ? galeriaProducto : [producto.foto];
  }, [colorActual, galeriaProducto, producto.foto]);

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

      {/* Barra superior de confianza */}
      <div className="flex items-center justify-center gap-4 bg-[#062a3a] px-3 py-2.5 text-center text-[11px] font-bold tracking-wide text-white sm:text-xs">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-[#38bdf8]" /> Compra segura
        </span>
        <span className="hidden h-3 w-px bg-white/20 sm:block" />
        <span className="hidden items-center gap-1.5 sm:flex">
          <PackageCheck className="h-3.5 w-3.5 text-[#38bdf8]" /> Pago contra entrega
        </span>
        <span className="hidden h-3 w-px bg-white/20 sm:block" />
        <span className="flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-[#38bdf8]" /> Envío 24h
        </span>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#053a52] via-[#0177a8] to-[#02a0e3] px-3 pb-16 pt-8 sm:pb-24 sm:pt-14">
        {/* Manchas decorativas -- puramente visuales, no interactivas. */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[#38bdf8]/25 blur-3xl" />

        <div ref={heroRef} className="relative mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
          {/* Galeria */}
          <div className="landing-fade-up rounded-[28px] bg-white p-3 shadow-2xl sm:p-4" style={{ ['--landing-delay' as string]: '0s' }}>
            <div className="landing-glow relative aspect-square w-full overflow-hidden rounded-2xl bg-gray-100">
              <Image src={fotosVisibles[fotoIndexValido] || producto.foto} alt={producto.pro_nombre} fill unoptimized priority sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
              {agotado && <span className="absolute left-3 top-3 rounded-full bg-gray-900/85 px-3 py-1 text-xs font-bold text-white">Agotado</span>}
              {!agotado && (
                <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-[#0177a8] shadow">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verificado
                </span>
              )}
            </div>
            {fotosVisibles.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
                {fotosVisibles.map((foto, i) => (
                  <button
                    key={`${foto}-${i}`}
                    onClick={() => setFotoIndex(i)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                      i === fotoIndexValido ? 'border-[#0177a8] shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Image src={foto} alt="" fill unoptimized sizes="64px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info + CTA */}
          <div className="landing-fade-up rounded-[28px] bg-white p-5 shadow-2xl sm:p-7" style={{ ['--landing-delay' as string]: '0.12s' }}>
            <div className="flex flex-wrap items-center gap-2">
              {producto.pro_categoria && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#0177a8]">
                  <Sparkles className="h-3 w-3" /> {producto.pro_categoria.cat_nombre}
                </span>
              )}
              {producto.pro_marca && <span className="text-[11px] font-semibold text-gray-400">{producto.pro_marca}</span>}
            </div>

            <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl">{producto.pro_nombre}</h1>
            {producto.pro_descripcionbreve && <p className="mt-2 text-sm text-gray-500">{producto.pro_descripcionbreve}</p>}

            <div className="mt-5 flex items-end gap-2">
              <p className="landing-price text-4xl font-extrabold text-[#0177a8] sm:text-[42px]">$ {formatCOP(producto.pro_uni_venta)}</p>
              <span className="mb-1.5 text-xs font-bold text-gray-400">COP</span>
            </div>

            {!agotado && stockTotal <= 10 && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-600">
                <Flame className="h-3.5 w-3.5" /> Solo quedan {stockTotal} unidades disponibles
              </p>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { Icon: Truck, label: 'Envío 24h', color: 'text-[#0177a8] bg-blue-50' },
                { Icon: PackageCheck, label: 'Pago al recibir', color: 'text-emerald-600 bg-emerald-50' },
                { Icon: ShieldCheck, label: 'Compra segura', color: 'text-amber-600 bg-amber-50' },
              ].map(({ Icon, label, color }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-gray-50 px-2 py-3 text-center">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[10.5px] font-bold leading-tight text-gray-600">{label}</span>
                </div>
              ))}
            </div>

            {hayVariante1 && (
              <div className="mt-6">
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-gray-500">{producto.variante1Label}</label>
                <div className="flex flex-wrap gap-2">
                  {producto.listColor.map((c) => (
                    <button
                      key={c.talla}
                      onClick={() => seleccionarColor(c.talla)}
                      className={`rounded-2xl border-2 px-4 py-2 text-sm font-bold transition ${
                        colorSeleccionado === c.talla ? 'border-[#0177a8] bg-[#0177a8] text-white shadow-md' : 'border-gray-200 text-gray-700 hover:border-[#0177a8]/50'
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
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-gray-500">{producto.variante2Label || 'Talla'}</label>
                <div className="flex flex-wrap gap-2">
                  {colorActual.tallaSelect.map((t) => (
                    <button
                      key={t.id}
                      disabled={!t.check}
                      onClick={() => setTallaSeleccionada(t.tal_descripcion)}
                      className={`rounded-2xl border-2 px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-30 ${
                        tallaSeleccionada === t.tal_descripcion ? 'border-[#0177a8] bg-[#0177a8] text-white shadow-md' : 'border-gray-200 text-gray-700 hover:border-[#0177a8]/50'
                      }`}
                    >
                      {t.tal_descripcion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <span className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Cantidad</span>
              <div className="flex items-center rounded-full border-2 border-gray-200 bg-gray-50">
                <button onClick={() => setCantidad((n) => Math.max(1, n - 1))} className="p-2.5 text-gray-500 hover:text-gray-900" aria-label="Menos">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-extrabold">{cantidad}</span>
                <button onClick={() => setCantidad((n) => n + 1)} className="p-2.5 text-gray-500 hover:text-gray-900" aria-label="Más">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <button
              onClick={irAComprar}
              disabled={agotado}
              className="boton-pulso group mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0177a8] to-[#02a0e3] px-6 py-4 text-base font-extrabold text-white shadow-xl shadow-blue-900/20 transition hover:-translate-y-0.5 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-40"
              style={{ ['--boton-glow' as string]: 'rgba(1,119,168,0.55)' }}
            >
              {agotado ? 'Agotado' : (
                <>
                  Comprar ahora <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                </>
              )}
            </button>
            <button
              onClick={agregarAlCarrito}
              disabled={agotado}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-gray-200 py-3 text-sm font-bold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40"
            >
              <ShoppingCart className="h-4 w-4" /> Agregar al carrito
            </button>
            <a
              href={`https://wa.me/57${tienda.telefono}?text=${encodeURIComponent(`Hola, tengo dudas sobre ${producto.pro_nombre}`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#25D366]/10 py-3 text-sm font-bold text-[#128C4A] transition hover:bg-[#25D366]/20"
            >
              <MessageCircle className="h-4 w-4" /> Preguntar por WhatsApp
            </a>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-gray-400">
              <Lock className="h-3.5 w-3.5" /> Pago 100% seguro · Sin pagos anticipados
            </p>
          </div>
        </div>
      </section>

      {beneficios.length > 0 && (
        <section className="px-3 py-14 sm:py-20">
          <div className="mx-auto max-w-[820px]">
            <p className="text-center text-xs font-extrabold uppercase tracking-widest text-[#0177a8]">Beneficios</p>
            <h2 className="mt-1 text-center text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">¿Por qué te va a encantar?</h2>
            <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {beneficios.map((b, i) => (
                <div key={i} className="flex items-start gap-3.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0177a8] to-[#02a0e3] text-white shadow-sm">
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <span className="text-sm leading-relaxed text-gray-700">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {producto.pro_descripcion && (
        <section className="border-t border-gray-100 bg-gray-50 px-3 py-14 sm:py-20">
          <div className="mx-auto max-w-[760px] rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">Descripción del producto</h2>
            <div
              className={`prose prose-sm mt-4 max-w-none overflow-hidden break-words leading-relaxed text-gray-600 [&_*]:max-w-full ${descripcionAbierta ? '' : 'max-h-40'}`}
              dangerouslySetInnerHTML={{ __html: producto.pro_descripcion }}
            />
            <button onClick={() => setDescripcionAbierta((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-[#0177a8]">
              {descripcionAbierta ? 'Ver menos' : 'Ver más'} <ChevronDown className={`h-4 w-4 transition-transform ${descripcionAbierta ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </section>
      )}

      <section className="px-3 py-14 sm:py-20">
        <div className="mx-auto max-w-[960px]">
          <p className="text-center text-xs font-extrabold uppercase tracking-widest text-[#0177a8]">Proceso simple</p>
          <h2 className="mt-1 text-center text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Cómo funciona tu compra</h2>
          <div className="relative mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-4">
            <div className="pointer-events-none absolute left-0 right-0 top-8 hidden border-t-2 border-dashed border-gray-200 sm:block" />
            {[
              { Icon: ShoppingCart, title: 'Compra ahora', desc: 'Confirma tus datos, sin pagar nada por adelantado.' },
              { Icon: PackageCheck, title: 'Lo preparamos', desc: 'Empacamos y despachamos tu pedido en 24 horas hábiles.' },
              { Icon: Truck, title: 'Pagas al recibir', desc: 'Le pagas al mensajero cuando el pedido llega a tu puerta.' },
            ].map((p, i) => (
              <div key={p.title} className="relative rounded-3xl bg-white p-6 text-center shadow-[0_4px_24px_rgba(1,119,168,0.08)]">
                <span className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#0177a8] to-[#02a0e3] text-white shadow-lg">
                  <p.Icon className="h-7 w-7" />
                </span>
                <span className="mt-3 block text-xs font-extrabold text-gray-300">PASO {i + 1}</span>
                <h3 className="mt-1 text-base font-extrabold text-gray-900">{p.title}</h3>
                <p className="mt-1.5 text-sm text-gray-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {producto.listComment.length > 0 && (
        <section className="border-t border-gray-100 bg-gray-50 px-3 py-14 sm:py-20">
          <div className="mx-auto max-w-[820px]">
            <p className="text-center text-xs font-extrabold uppercase tracking-widest text-[#0177a8]">Testimonios reales</p>
            <h2 className="mt-1 text-center text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Lo que dicen quienes ya compraron</h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {producto.listComment.slice(0, 6).map((c, i) => (
                <div key={i} className="rounded-2xl bg-white p-5 shadow-sm">
                  <span className="text-3xl leading-none text-[#0177a8]/25">“</span>
                  <p className="-mt-2 text-sm leading-relaxed text-gray-700">{c.descripcion}</p>
                  <div className="mt-3 flex items-center gap-2.5 border-t border-gray-50 pt-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0177a8] to-[#02a0e3] text-xs font-extrabold text-white">
                      {(c.nombre || 'C')[0].toUpperCase()}
                    </span>
                    <p className="text-xs font-bold text-gray-500">
                      {c.nombre || 'Comprador'} <span className="font-normal text-gray-400">· {c.fecha}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-3 py-14 sm:py-20">
        <div className="mx-auto max-w-[700px]">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Preguntas frecuentes</h2>
          <div className="mt-8 space-y-2.5">
            {FAQ.map((f, i) => (
              <div key={i} className={`overflow-hidden rounded-2xl border transition ${faqAbierta === i ? 'border-[#0177a8]/30 bg-blue-50/40' : 'border-gray-100 bg-white'}`}>
                <button onClick={() => setFaqAbierta(faqAbierta === i ? null : i)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-extrabold text-gray-800">
                  {f.q}
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 transition-transform ${faqAbierta === i ? 'rotate-180 bg-[#0177a8] text-white' : 'text-gray-500'}`}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                </button>
                {faqAbierta === i && <p className="px-5 pb-4 text-sm leading-relaxed text-gray-600">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formulario final de compra */}
      <section ref={formRef} id="comprar" className="bg-gradient-to-b from-gray-50 to-white px-3 py-14 sm:py-20">
        <div className="mx-auto max-w-[520px] overflow-hidden rounded-[28px] border border-gray-100 shadow-2xl">
          {pedidoOk ? (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-4xl">🎉</span>
              <h3 className="mt-4 text-xl font-extrabold text-gray-900">¡Pedido confirmado!</h3>
              <p className="mt-2 text-sm text-gray-500">Un asesor se pondrá en contacto contigo por WhatsApp para coordinar la entrega. Pagas cuando lo recibes.</p>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-[#0177a8] to-[#02a0e3] px-6 py-5 text-white sm:px-7">
                <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-white/80">
                  <Sparkles className="h-3.5 w-3.5" /> Último paso
                </p>
                <h2 className="mt-0.5 text-xl font-extrabold">Finaliza tu pedido</h2>
                <p className="mt-1 text-sm text-white/90">
                  {producto.pro_nombre} · ${formatCOP(producto.pro_uni_venta)} x {cantidad} = <strong>${formatCOP(producto.pro_uni_venta * cantidad)}</strong>
                </p>
              </div>
              <div className="bg-white px-6 py-6 sm:px-7">
                <div className="space-y-2.5">
                  <CampoConIcono Icon={User} value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} placeholder="Nombre completo" />
                  <CampoConIcono Icon={Phone} value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} placeholder="Celular / WhatsApp" />
                  <CampoConIcono Icon={MapPin} value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} placeholder="Ciudad" />
                  <CampoConIcono Icon={Home} value={form.barrio} onChange={(v) => setForm({ ...form, barrio: v })} placeholder="Barrio" />
                  <CampoConIcono Icon={MapPin} value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} placeholder="Dirección" />
                  <CampoConIcono Icon={MapPin} value={form.referencia} onChange={(v) => setForm({ ...form, referencia: v })} placeholder="Punto de referencia (ej: casa azul)" />
                </div>
                <button
                  onClick={confirmarCompra}
                  disabled={enviando || agotado}
                  className="boton-pulso mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 px-6 py-4 text-base font-extrabold text-white shadow-xl transition hover:-translate-y-0.5 disabled:opacity-60"
                  style={{ ['--boton-glow' as string]: 'rgba(22,163,74,0.55)' }}
                >
                  {enviando ? 'Procesando…' : (
                    <>
                      Confirmar pedido · ${formatCOP(producto.pro_uni_venta * cantidad)}
                    </>
                  )}
                </button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-gray-400">
                  <Lock className="h-3.5 w-3.5" /> No pagas nada ahora. Pagas contra entrega.
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">LokomproAqui · lokomproaqui.com</footer>

      {mostrarBarraFija && !pedidoOk && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-gray-100 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] backdrop-blur sm:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-gray-100">
              <Image src={fotosVisibles[0] || producto.foto} alt="" fill unoptimized sizes="40px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-gray-500">{producto.pro_nombre}</p>
              <p className="text-base font-extrabold text-[#0177a8]">$ {formatCOP(producto.pro_uni_venta)}</p>
            </div>
          </div>
          <button onClick={irAComprar} disabled={agotado} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0177a8] to-[#02a0e3] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-40">
            {agotado ? 'Agotado' : 'Comprar'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <Toast mensaje={mensaje} />
    </div>
  );
}

function CampoConIcono({ Icon, value, onChange, placeholder }: { Icon: typeof User; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3.5 text-sm transition focus:border-[#0177a8] focus:outline-none focus:ring-2 focus:ring-[#0177a8]/20"
      />
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
// beneficios -- no se inventa texto nuevo, solo se reformatea lo que el proveedor ya escribio.
function extraerBeneficios(descripcionHtml: string | null): string[] {
  if (!descripcionHtml) return [];
  const texto = descripcionHtml.replace(/<[^>]+>/g, '\n');
  const lineas = texto
    .split(/\n|\r/)
    .map((l) => l.replace(/&nbsp;/g, ' ').trim())
    .filter((l) => l.length >= 8 && l.length <= 110);
  return Array.from(new Set(lineas)).slice(0, 5);
}
