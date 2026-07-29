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

// Landing de producto de alta conversion (pedido explicito del usuario 2026-07-28/29: "que se vea
// de nivel experto/2026", despues "estetica cyberpunk neon/glassmorphism"). Tercera pasada de
// diseño -- mismo estado/logica de siempre, ahora con tema oscuro + vidrio esmerilado + resplandor
// neon (ver globals.css: landing-glass, landing-glow-neon, landing-cta-neon, landing-seal-*).
//
// Paleta CIAN + AZUL DE MARCA a proposito, NUNCA morado/fucsia -- el usuario ya establecio antes
// (memoria feedback_no_purple_fuchsia_scam) que esa paleta se asocia en su mercado con una
// plataforma que estafo gente.
//
// El brief original de esta pasada pedia cronometro de 24h que reinicia solo, contador de "N
// personas viendo esto ahora", barra de stock "simulada" y reseñas con fotos/estrellas inventadas
// -- se le explico al usuario que esas 4 cosas son datos fabricados presentados como reales (falsa
// urgencia + reseñas falsas, ilegal en varias jurisdicciones) y eligio la opcion honesta: mejorar
// SOLO la landing real con datos reales, sin inventar nada. Por eso esta version sigue sin
// cronometro, sin contador de visitantes y sin reseñas falsas -- el stock bajo mostrado es el
// stock real del producto, y las reseñas (si aparecen) son comentarios reales de la tabla
// product_comments.

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
    <div className="min-h-screen bg-[#05070f] pb-24 text-slate-100 sm:pb-0">
      <PixelScripts />

      {/* Barra superior de confianza -- pegajosa, vidrio esmerilado. */}
      <div className="sticky top-0 z-30 flex items-center justify-center gap-4 border-b border-cyan-400/10 bg-[#05070f]/85 px-3 py-2.5 text-center text-[11px] font-bold tracking-wide text-slate-200 backdrop-blur-md sm:text-xs">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-cyan-400" /> Compra segura
        </span>
        <span className="hidden h-3 w-px bg-white/15 sm:block" />
        <span className="hidden items-center gap-1.5 sm:flex">
          <PackageCheck className="h-3.5 w-3.5 text-cyan-400" /> Pago contra entrega
        </span>
        <span className="hidden h-3 w-px bg-white/15 sm:block" />
        <span className="flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-cyan-400" /> Envío 24h
        </span>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#071224] via-[#050b18] to-[#05070f] px-3 pb-16 pt-8 sm:pb-24 sm:pt-14">
        {/* Manchas de luz -- puramente visuales, CSS puro (sin canvas/particulas, mantiene la
            pagina liviana para trafico pago). */}
        <div className="landing-glow-blob pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="landing-glow-blob landing-glow-blob-2 pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[#0177a8]/30 blur-3xl" />

        <div ref={heroRef} className="relative mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
          {/* Galeria */}
          <div className="landing-fade-up landing-glass rounded-[28px] p-3 sm:p-4" style={{ ['--landing-delay' as string]: '0s' }}>
            <div className="landing-glow-neon relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-900">
              <Image src={fotosVisibles[fotoIndexValido] || producto.foto} alt={producto.pro_nombre} fill unoptimized priority sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
              {agotado && <span className="absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-xs font-bold text-white">Agotado</span>}
              {!agotado && (
                <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-cyan-400/30 bg-black/60 px-2.5 py-1 text-[10px] font-extrabold text-cyan-300 backdrop-blur">
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
                      i === fotoIndexValido ? 'border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]' : 'border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Image src={foto} alt="" fill unoptimized sizes="64px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info + CTA */}
          <div className="landing-fade-up landing-glass rounded-[28px] p-5 sm:p-7" style={{ ['--landing-delay' as string]: '0.12s' }}>
            <div className="flex flex-wrap items-center gap-2">
              {producto.pro_categoria && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-cyan-300">
                  <Sparkles className="h-3 w-3" /> {producto.pro_categoria.cat_nombre}
                </span>
              )}
              {producto.pro_marca && <span className="text-[11px] font-semibold text-slate-400">{producto.pro_marca}</span>}
            </div>

            <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">{producto.pro_nombre}</h1>
            {producto.pro_descripcionbreve && <p className="mt-2 text-sm text-slate-400">{producto.pro_descripcionbreve}</p>}

            <div className="mt-5 flex items-end gap-2">
              <p className="landing-price landing-price-neon text-4xl font-extrabold text-cyan-300 sm:text-[42px]">$ {formatCOP(producto.pro_uni_venta)}</p>
              <span className="mb-1.5 text-xs font-bold text-slate-500">COP</span>
            </div>

            {!agotado && stockTotal <= 10 && (
              <div className="mt-2">
                <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-extrabold text-amber-300">
                  <Flame className="h-3.5 w-3.5" /> Solo quedan {stockTotal} unidades disponibles
                </p>
                {/* Barra de stock REAL (no simulada) -- llena hasta un tope visual de 10 unidades,
                    asi que solo se ve "casi vacia" cuando de verdad queda poco. */}
                <div className="mt-1.5 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-400" style={{ width: `${Math.min(100, (stockTotal / 10) * 100)}%` }} />
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { Icon: Truck, label: 'Envío 24h' },
                { Icon: PackageCheck, label: 'Pago al recibir' },
                { Icon: ShieldCheck, label: 'Compra segura' },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-3 text-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[10.5px] font-bold leading-tight text-slate-300">{label}</span>
                </div>
              ))}
            </div>

            {hayVariante1 && (
              <div className="mt-6">
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-400">{producto.variante1Label}</label>
                <div className="flex flex-wrap gap-2">
                  {producto.listColor.map((c) => (
                    <button
                      key={c.talla}
                      onClick={() => seleccionarColor(c.talla)}
                      className={`rounded-2xl border-2 px-4 py-2 text-sm font-bold transition ${
                        colorSeleccionado === c.talla
                          ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.35)]'
                          : 'border-white/15 text-slate-300 hover:border-cyan-400/40'
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
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-400">{producto.variante2Label || 'Talla'}</label>
                <div className="flex flex-wrap gap-2">
                  {colorActual.tallaSelect.map((t) => (
                    <button
                      key={t.id}
                      disabled={!t.check}
                      onClick={() => setTallaSeleccionada(t.tal_descripcion)}
                      className={`rounded-2xl border-2 px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-30 ${
                        tallaSeleccionada === t.tal_descripcion
                          ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.35)]'
                          : 'border-white/15 text-slate-300 hover:border-cyan-400/40'
                      }`}
                    >
                      {t.tal_descripcion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Cantidad</span>
              <div className="flex items-center rounded-full border border-white/15 bg-white/[0.03]">
                <button onClick={() => setCantidad((n) => Math.max(1, n - 1))} className="p-2.5 text-slate-400 hover:text-white" aria-label="Menos">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-extrabold text-white">{cantidad}</span>
                <button onClick={() => setCantidad((n) => n + 1)} className="p-2.5 text-slate-400 hover:text-white" aria-label="Más">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <button
              onClick={irAComprar}
              disabled={agotado}
              className="landing-cta-neon group mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0177a8] to-cyan-400 px-6 py-4 text-base font-extrabold text-[#04121c] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {agotado ? 'Agotado' : (
                <>
                  COMPRAR AHORA · ENVÍO GRATIS <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                </>
              )}
            </button>
            <button
              onClick={agregarAlCarrito}
              disabled={agotado}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/15 py-3 text-sm font-bold text-slate-300 transition hover:border-white/30 hover:bg-white/5 disabled:opacity-40"
            >
              <ShoppingCart className="h-4 w-4" /> Agregar al carrito
            </button>
            <a
              href={`https://wa.me/57${tienda.telefono}?text=${encodeURIComponent(`Hola, tengo dudas sobre ${producto.pro_nombre}`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#25D366]/10 py-3 text-sm font-bold text-[#4ade80] transition hover:bg-[#25D366]/20"
            >
              <MessageCircle className="h-4 w-4" /> Preguntar por WhatsApp
            </a>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Lock className="h-3.5 w-3.5" /> Pago 100% seguro · Sin pagos anticipados
            </p>
          </div>
        </div>
      </section>

      {beneficios.length > 0 && (
        <section className="border-t border-white/5 px-3 py-14 sm:py-20">
          <div className="mx-auto max-w-[820px]">
            <p className="text-center text-xs font-extrabold uppercase tracking-widest text-cyan-400">Beneficios</p>
            <h2 className="mt-1 text-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl">¿Por qué te va a encantar?</h2>
            <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {beneficios.map((b, i) => (
                <div key={i} className="landing-glass flex items-start gap-3.5 rounded-2xl p-4 transition hover:-translate-y-0.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0177a8] to-cyan-400 text-[#04121c] shadow-[0_0_14px_rgba(34,211,238,0.4)]">
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <span className="text-sm leading-relaxed text-slate-200">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {producto.pro_descripcion && (
        <section className="border-t border-white/5 bg-[#070c17] px-3 py-14 sm:py-20">
          <div className="landing-glass mx-auto max-w-[760px] rounded-3xl p-6 sm:p-8">
            <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Descripción del producto</h2>
            <div
              className={`prose prose-sm prose-invert mt-4 max-w-none overflow-hidden break-words leading-relaxed text-slate-300 [&_*]:max-w-full ${descripcionAbierta ? '' : 'max-h-40'}`}
              dangerouslySetInnerHTML={{ __html: producto.pro_descripcion }}
            />
            <button onClick={() => setDescripcionAbierta((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-cyan-400">
              {descripcionAbierta ? 'Ver menos' : 'Ver más'} <ChevronDown className={`h-4 w-4 transition-transform ${descripcionAbierta ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </section>
      )}

      <section className="border-t border-white/5 px-3 py-14 sm:py-20">
        <div className="mx-auto max-w-[960px]">
          <p className="text-center text-xs font-extrabold uppercase tracking-widest text-cyan-400">Proceso simple</p>
          <h2 className="mt-1 text-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Cómo funciona tu compra</h2>
          <div className="relative mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-4">
            <div className="pointer-events-none absolute left-0 right-0 top-8 hidden border-t-2 border-dashed border-white/10 sm:block" />
            {[
              { Icon: ShoppingCart, title: 'Compra ahora', desc: 'Confirma tus datos, sin pagar nada por adelantado.' },
              { Icon: PackageCheck, title: 'Lo preparamos', desc: 'Empacamos y despachamos tu pedido en 24 horas hábiles.' },
              { Icon: Truck, title: 'Pagas al recibir', desc: 'Le pagas al mensajero cuando el pedido llega a tu puerta.' },
            ].map((p, i) => (
              <div key={p.title} className="landing-glass relative rounded-3xl p-6 text-center">
                <span className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#0177a8] to-cyan-400 text-[#04121c] shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                  <p.Icon className="h-7 w-7" />
                </span>
                <span className="mt-3 block text-xs font-extrabold text-slate-500">PASO {i + 1}</span>
                <h3 className="mt-1 text-base font-extrabold text-white">{p.title}</h3>
                <p className="mt-1.5 text-sm text-slate-400">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Garantía -- solo afirmaciones reales de la plataforma (verificacion de proveedor, pago
          contra entrega, pedido registrado). Nada de "devolucion de dinero 30 dias" -- esa
          politica no existe hoy, no se inventa un sello para simularla. */}
      <section className="border-t border-white/5 bg-[#070c17] px-3 py-14 sm:py-20">
        <div className="mx-auto max-w-[820px]">
          <p className="text-center text-xs font-extrabold uppercase tracking-widest text-cyan-400">Garantía</p>
          <h2 className="mt-1 text-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Compra sin riesgo</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { title: 'Proveedor verificado', desc: 'Este vendedor pasó la revisión de LokomproAqui antes de poder publicar.' },
              { title: 'Pago contra entrega', desc: 'Pagas cuando el pedido llega a tus manos, no antes.' },
              { title: 'Pedido registrado', desc: 'Queda guardado en la plataforma y un asesor confirma tus datos por WhatsApp.' },
            ].map((g) => (
              <div key={g.title} className="landing-glass flex flex-col items-center rounded-3xl p-6 text-center">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10">
                  <div className="landing-seal-ring absolute inset-0 rounded-full" />
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path className="landing-seal-check text-cyan-300" d="M4 12.5l5 5L20 6" pathLength={48} />
                  </svg>
                </div>
                <h3 className="mt-3 text-sm font-extrabold text-white">{g.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {producto.listComment.length > 0 && (
        <section className="border-t border-white/5 px-3 py-14 sm:py-20">
          <div className="mx-auto max-w-[820px]">
            <p className="text-center text-xs font-extrabold uppercase tracking-widest text-cyan-400">Testimonios reales</p>
            <h2 className="mt-1 text-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Lo que dicen quienes ya compraron</h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {producto.listComment.slice(0, 6).map((c, i) => (
                <div key={i} className="landing-glass rounded-2xl p-5">
                  <span className="text-3xl leading-none text-cyan-400/40">“</span>
                  <p className="-mt-2 text-sm leading-relaxed text-slate-200">{c.descripcion}</p>
                  <div className="mt-3 flex items-center gap-2.5 border-t border-white/10 pt-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0177a8] to-cyan-400 text-xs font-extrabold text-[#04121c]">
                      {(c.nombre || 'C')[0].toUpperCase()}
                    </span>
                    <p className="text-xs font-bold text-slate-400">
                      {c.nombre || 'Comprador'} <span className="font-normal text-slate-500">· {c.fecha}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-white/5 bg-[#070c17] px-3 py-14 sm:py-20">
        <div className="mx-auto max-w-[700px]">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Preguntas frecuentes</h2>
          <div className="mt-8 space-y-2.5">
            {FAQ.map((f, i) => (
              <div key={i} className={`overflow-hidden rounded-2xl border transition ${faqAbierta === i ? 'border-cyan-400/30 bg-cyan-400/5' : 'landing-glass'}`}>
                <button onClick={() => setFaqAbierta(faqAbierta === i ? null : i)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-extrabold text-slate-100">
                  {f.q}
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 transition-transform ${faqAbierta === i ? 'rotate-180 border-cyan-400 bg-cyan-400 text-[#04121c]' : 'text-slate-400'}`}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                </button>
                {faqAbierta === i && <p className="px-5 pb-4 text-sm leading-relaxed text-slate-400">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formulario final de compra */}
      <section ref={formRef} id="comprar" className="border-t border-white/5 px-3 py-14 sm:py-20">
        <div className="landing-glow-neon mx-auto max-w-[520px] overflow-hidden rounded-[28px] border border-white/10 bg-[#070c17]">
          {pedidoOk ? (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/10 text-4xl">🎉</span>
              <h3 className="mt-4 text-xl font-extrabold text-white">¡Pedido confirmado!</h3>
              <p className="mt-2 text-sm text-slate-400">Un asesor se pondrá en contacto contigo por WhatsApp para coordinar la entrega. Pagas cuando lo recibes.</p>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-[#0177a8] to-cyan-400 px-6 py-5 text-[#04121c] sm:px-7">
                <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#04121c]/70">
                  <Sparkles className="h-3.5 w-3.5" /> Último paso
                </p>
                <h2 className="mt-0.5 text-xl font-extrabold">Finaliza tu pedido</h2>
                <p className="mt-1 text-sm text-[#04121c]/80">
                  {producto.pro_nombre} · ${formatCOP(producto.pro_uni_venta)} x {cantidad} = <strong>${formatCOP(producto.pro_uni_venta * cantidad)}</strong>
                </p>
              </div>
              <div className="px-6 py-6 sm:px-7">
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
                  className="landing-cta-neon mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-4 text-base font-extrabold text-[#04121c] transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {enviando ? 'Procesando…' : (
                    <>
                      Confirmar pedido · ${formatCOP(producto.pro_uni_venta * cantidad)}
                    </>
                  )}
                </button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <Lock className="h-3.5 w-3.5" /> No pagas nada ahora. Pagas contra entrega.
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-500">LokomproAqui · lokomproaqui.com</footer>

      {mostrarBarraFija && !pedidoOk && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-cyan-400/15 bg-[#05070f]/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur-lg sm:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-900">
              <Image src={fotosVisibles[0] || producto.foto} alt="" fill unoptimized sizes="40px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-slate-400">{producto.pro_nombre}</p>
              <p className="text-base font-extrabold text-cyan-300">$ {formatCOP(producto.pro_uni_venta)}</p>
            </div>
          </div>
          <button onClick={irAComprar} disabled={agotado} className="landing-cta-neon flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0177a8] to-cyan-400 px-5 py-3 text-sm font-extrabold text-[#04121c] disabled:opacity-40">
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
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/15 bg-white/[0.03] py-2.5 pl-10 pr-3.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
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
