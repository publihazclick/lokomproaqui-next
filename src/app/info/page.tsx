import Link from 'next/link';
import { Check } from 'lucide-react';
import { supabase, conTimeout } from '@/lib/supabase';
import { ContadorShipping } from '@/components/ContadorShipping';
import { InfoCursoAdVideo } from '@/components/InfoCursoAdVideo';
import { InfoMenuPills } from '@/components/InfoMenuPills';
import { SessionRedirect } from '@/components/SessionRedirect';
import styles from './info.module.css';

export const metadata = {
  title: 'LokomproAqui | Vende, compra y gana sin invertir',
  description: 'Tu socio confiable en el mundo del dropshipping. Vende, compra, publica y genera ingresos de forma rápida y segura.',
};

// Port CASI literal de info.component.html/.scss (Angular) -- pedido explicito del usuario
// 2026-07-15: "la quiero exacta exacta exactamente la misma identica sin faltar nada". Se
// abandona la reinterpretacion con utilidades de Tailwind (degradados/rounded-3xl/hover-lifts) y
// se copia la estructura + CSS real casi textual (ver info.module.css), incluyendo las clases de
// Bootstrap (row/col-12/col-sm-4/card/etc.) que el HTML original usaba para el layout -- recreadas
// en el modulo CSS porque el resto del sitio Next.js no carga Bootstrap.

// CORREGIDO 2026-07-16: force-dynamic causaba timeouts reales (confirmado con curl contra
// produccion: la consulta a Supabase a veces tarda 15-20s+, y sin ningun cache CADA visita queda
// expuesta a esa demora -- varios usuarios reportaron "tardo demasiado en responder"). Con
// revalidate corto, casi todas las visitas reciben una version ya guardada (rapida, sin esperar a
// Supabase) mientras se regenera sola en segundo plano -- los cambios del panel admin igual se ven
// reflejados en segundos, no en 60s como antes, pero sin arriesgar la carga de nadie.
export const revalidate = 5;

function extraerIdYoutube(input: string | null): string | null {
  if (!input) return null;
  const match = input.trim().match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]+)/);
  return match ? match[1] : input;
}

const QUE_HACEMOS = [
  'Somos el aliado más confiable para nuestros proveedores.',
  'Somos el apoyo para aquellas personas que quieren generar ingresos reales y sin invertir.',
  'Nos encargamos de que los vendedores compartan y vendan tus productos.',
  'Nos encargamos de la logística de venta, que sería preparar tu pedido y enviarlo a su respectivo cliente.',
  'Nos encargamos de realizar los pagos rápidamente el mismo día que el cliente recibe su producto.',
];

const POR_QUE = [
  'Tienes tu dinero en 24 horas.',
  'Tenemos las mejores tarifas del mercado.',
  'Somos una plataforma amigable y fácil de usar.',
  'Creamos tu tienda virtual gratis y fácil.',
  'Capacitaciones gratis de marketing.',
];

export default async function InfoPage() {
  const { data: config } = await conTimeout(supabase.from('site_config').select('info_text').limit(1).single(), { data: null, error: null } as any);
  const infoText = (config?.info_text ?? {}) as Record<string, string>;
  const numeroWhatsapp = infoText.clInformacion || '3506700802';
  const video1 = extraerIdYoutube(infoText.aceleradorVideoGancho1);
  const video2 = extraerIdYoutube(infoText.aceleradorVideoGancho2);

  return (
    <div className={styles.infoPage}>
      {/* Pedido explicito del usuario 2026-07-19: un usuario ya logueado nunca debe ver /info --
          esta pagina es server component con ISR (revalidate=5), no puede leer la sesion del lado
          del servidor, asi que el chequeo vive en este "island" cliente que redirige apenas monta
          si detecta sesion activa. */}
      <SessionRedirect when="logged-in" to="/articulo" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- Poppins, mismo font-family que el original Angular */}
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap" rel="stylesheet" />

      <section className="bg-gradient-to-br from-[#0177a8] via-[#02a0e3] to-[#38bdf8] px-6 pb-24 pt-20 text-center text-white">
        <h1 className="text-4xl font-bold leading-tight">Vende Online Sin Inventario</h1>
        <p className="mt-4 text-lg opacity-90">Nosotros guardamos, empacamos y enviamos. Tú solo publicas y ganas desde un 40% en adelante.</p>
        <Link
          href="/singUp"
          className="shine-sweep mt-6 inline-block rounded-2xl bg-white px-8 py-4 text-lg font-bold text-[#0177a8] shadow-2xl transition duration-300 hover:scale-105"
        >
          EMPEZAR GRATIS AHORA
        </Link>
        <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm font-medium">
          <span>✓ Envío 24 Horas</span>
          <span>✓ $0 Inversión</span>
          <span>✓ Soporte 24/7</span>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1200px] bg-white px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-[#1E293B]">Cómo funciona en 3 pasos</h2>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            { emoji: '📝', title: 'Regístrate gratis', desc: 'Crea tu cuenta en 2 minutos, sin costos ocultos.' },
            { emoji: '🛒', title: 'Elige productos', desc: 'Escoge de +236 proveedores verificados y arma tu catálogo.' },
            { emoji: '💰', title: 'Vende y gana', desc: 'Comparte tu link, nosotros despachamos, tú te quedas desde un 40% en adelante.' },
          ].map((paso, i) => (
            <div key={paso.title} className="relative rounded-[24px] bg-white p-7 text-center shadow-[0_4px_24px_rgba(99,102,241,0.12)]">
              <span className="absolute left-6 top-6 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-[#0177a8] to-[#02a0e3] text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="text-5xl">{paso.emoji}</span>
              <h3 className="mt-4 text-lg font-bold text-gray-900">{paso.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{paso.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <InfoMenuPills />

      <a
        href={`https://wa.me/57${numeroWhatsapp}?text=${encodeURIComponent('Hola, tengo dudas sobre LokomproAqui')}`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(37,211,102,0.5)] transition hover:scale-105 sm:bottom-5 sm:right-5 sm:gap-2.5 sm:px-5 sm:py-4 sm:text-base"
      >
        <svg viewBox="0 0 32 32" className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" fill="currentColor" aria-hidden="true">
          <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.34.663 4.523 1.812 6.377L4 29l7.823-1.771A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm6.997 16.943c-.297.836-1.47 1.53-2.41 1.73-.64.135-1.475.243-4.29-.92-3.6-1.49-5.916-5.14-6.096-5.38-.173-.24-1.456-1.938-1.456-3.696 0-1.759.917-2.622 1.243-2.983.297-.328.65-.41.868-.41.218 0 .436.002.626.011.2.01.47-.076.735.561.297.716.998 2.474 1.086 2.653.09.18.15.39.03.63-.12.24-.18.39-.36.6-.18.21-.378.469-.54.63-.18.18-.368.375-.158.735.21.36.933 1.542 2.003 2.497 1.376 1.228 2.535 1.608 2.895 1.788.36.18.57.15.78-.09.21-.24.9-1.05 1.14-1.41.24-.36.48-.3.81-.18.33.12 2.088.986 2.448 1.166.36.18.6.27.69.42.09.15.09.87-.208 1.706Z" />
        </svg>
        <span>¿Dudas? Te ayudo</span>
      </a>

      <div className={styles.row} style={{ margin: '5px' }}>
        {video1 && (
          <div className={styles.col12}>
            <section className={styles.cursoAd}>
              <div className={`${styles.cursoAdDecor} ${styles.cursoAdDecor1}`} />
              <div className={`${styles.cursoAdDecor} ${styles.cursoAdDecor2}`} />

              <span className={styles.cursoAdBadge}>🔥 +60,350 Despachos este mes</span>

              <div className={styles.cursoAdInner}>
                <div className={styles.cursoAdVideos}>
                  <InfoCursoAdVideo youtubeId={video1} label="Video 1 del curso Acelerador de Ventas" mediaClass={styles.cursoAdMedia} glowClass={styles.cursoAdGlow} ratioClass={styles.cursoAdRatio} thumbClass={styles.cursoAdThumb} playClass={styles.cursoAdPlay} playTriangleClass={styles.cursoAdPlayTriangle} />
                  {video2 && (
                    <InfoCursoAdVideo youtubeId={video2} label="Video 2 del curso Acelerador de Ventas" mediaClass={styles.cursoAdMedia} glowClass={styles.cursoAdGlow} ratioClass={styles.cursoAdRatio} thumbClass={styles.cursoAdThumb} playClass={styles.cursoAdPlay} playTriangleClass={styles.cursoAdPlayTriangle} />
                  )}
                </div>

                <div className={styles.cursoAdBody}>
                  <span className={styles.cursoAdTag}>Acelerador de Ventas</span>
                  <h2 className={styles.cursoAdTitle}>Aprende a vender como un experto</h2>
                  <p className={styles.cursoAdDesc}>Clases grabadas + acompañamiento personalizado para llevar tu negocio al siguiente nivel.</p>

                  <ul className={styles.cursoAdFeatures}>
                    <li>
                      <span className={styles.cursoAdFeaturesEmoji}>🎥</span> Clases grabadas, a tu ritmo
                    </li>
                    <li>
                      <span className={styles.cursoAdFeaturesEmoji}>🤝</span> Acompañamiento personalizado
                    </li>
                    <li>
                      <span className={styles.cursoAdFeaturesEmoji}>⚡</span> Acceso inmediato al pagar
                    </li>
                  </ul>

                  <div className={styles.cursoAdPriceRow}>
                    <span className={styles.cursoAdPrice}>
                      Tan solo <strong>$37 USD</strong>
                      <span className={styles.cursoAdPriceSuffix}>/mes</span>
                    </span>
                    <Link href="/acelerador?checkout=1" className={styles.cursoAdCta}>
                      Suscribirme
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        <section className={styles.banner}>
          <div className={styles.frame42}>
            {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
            <img className={styles.imgprincipal1} src="/assets/imagenes/BANNER%201.png" alt="" />
            <div className={styles.frame41}>
              <div>
                <span>
                  <span className={styles.somosTuMejorAliadoSpan}>SOMOS TU</span>
                  <br />
                  <span className={styles.somosTuMejorAliadoSpan2}>MEJOR ALIADO</span>
                </span>
              </div>
              <div className={styles.compraVendeDesc}>
                Tu socio confiable en el mundo del dropshipping. ¡Maximiza tus ganancias sin preocuparte por el inventario! Con nosotros, encontrarás productos de alta calidad y una experiencia de compra excepcional.
              </div>
              <div className={styles.frame33} style={{ margin: 'auto' }}>
                <Link href="/singUp/vendedor/3213692393" className={styles.registrateGratis} style={{ textDecoration: 'none' }}>
                  Regístrate gratis
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.col12}>
          <ContadorShipping />
        </div>

        <div className={styles.col12} style={{ background: 'white' }}>
          <section className={styles.seccionDosCajas}>
            <div className={styles.caja}>
              <div className={styles.contenidoCaja}>
                <div className={styles.quehacemosCards}>
                  <div className={styles.quehacemosCard}>
                    <span className={styles.quehacemosCardEmoji}>🛍️</span>
                    <h4>Vendedor</h4>
                    <p>Más de 236 proveedores con productos disponibles para generar ingresos.</p>
                  </div>
                  <div className={styles.quehacemosCard}>
                    <span className={styles.quehacemosCardEmoji}>📦</span>
                    <h4>Proveedor</h4>
                    <p>Publica tus productos. Nuestra comunidad de emprendedores se encarga de comercializarlos.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.caja}>
              <div className={styles.contenidoCaja}>
                <h1>¿Qué Hacemos?</h1>
                <ul>
                  {QUE_HACEMOS.map((texto) => (
                    <li key={texto}>
                      <span className={styles.checkCircle}>
                        <Check size={18} strokeWidth={3} />
                      </span>
                      <p>{texto}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        <div className={styles.col12} style={{ background: 'white' }}>
          <section className={styles.seccionDosCajas}>
            <div className={styles.caja}>
              <div className={styles.contenidoCaja}>
                <div className={styles.imagen}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
                  <img src="/assets/imagenes/porquelokomproaqui.png" alt="Imagen 1" />
                </div>
              </div>
            </div>
            <div className={styles.caja}>
              <div className={styles.contenidoCaja}>
                <h1>¿Por qué lokomproaqui?</h1>
                <ul>
                  {POR_QUE.map((texto) => (
                    <li key={texto}>
                      <span className={styles.checkCircle}>
                        <Check size={18} strokeWidth={3} />
                      </span>
                      <p>{texto}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        <div className={`${styles.col12} ${styles.container1200}`}>
        <div className={styles.row} style={{ margin: '48px auto' }}>
          <div className={styles.colSm4}>
            <div className={styles.colorFondo4}>
              <h3 className={styles.registroBoxTitle}>Registro Proveedor</h3>
              <p className={styles.registroBoxSubtitle}>Empieza con tu red de ventas</p>
              <Link href="/singUp/proveedor/3213692393" className={styles.registroBoxButton}>
                Registrarme →
              </Link>
              <br />
              {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
              <img src="/assets/imagenes/REGISTROPROVEEDOR.png" alt="" className={`${styles.registroBoxImg} ${styles.registroBoxImgProveedor}`} />
            </div>
          </div>
          <div className={styles.colSm4}>
            <div className={styles.colorFondo4}>
              <h3 className={styles.registroBoxTitle}>Registro Vendedor</h3>
              <p className={styles.registroBoxSubtitle}>Empieza a generar venta sin invertir</p>
              <Link href="/singUp/vendedor/3213692393" className={styles.registroBoxButton}>
                Registrarme →
              </Link>
              <br />
              {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
              <img src="/assets/imagenes/REGISTROVENDEDOR.png" alt="" className={styles.registroBoxImg} />
            </div>
          </div>
          <div className={styles.colSm4}>
            <div className={styles.colorFondo4}>
              <h3 className={styles.registroBoxTitle}>Contactar Asesor</h3>
              <p className={styles.registroBoxSubtitle}>La información que necesitas a un click</p>
              <a href={`https://wa.me/57${numeroWhatsapp}?text=${encodeURIComponent('Hola Servicio al cliente')}`} target="_blank" rel="noreferrer" className={styles.registroBoxButton}>
                Registrarme →
              </a>
              <br />
              {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
              <img src="/assets/imagenes/CONTACTARASESOR.png" alt="" className={styles.registroBoxImg} />
            </div>
          </div>
        </div>
        </div>

        <div className={`${styles.col12} ${styles.row} ${styles.colorFondo5}`}>
          <div className={styles.col12}>
            <div className={`${styles.dFlex} ${styles.justifyContentCenter}`}>
              <div style={{ textAlign: 'center', width: '100%' }}>
                <h2>
                  Registrate no <br /> Pierdas Más Dinero
                </h2>
                <section style={{ width: '100%', maxWidth: '376px', fontSize: '25px', height: '70px', display: 'inline-block', boxSizing: 'border-box' }}>
                  <Link href="/singUp/vendedor/3213692393" className={`${styles.btn} ${styles.btnDark} ${styles.customButton}`} style={{ textDecoration: 'none' }}>
                    Regístrate gratis
                  </Link>
                </section>
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.col12} ${styles.row}`} style={{ margin: '5px' }}>
          <div className={styles.col12}>
            <div className={`${styles.dFlex} ${styles.justifyContentCenter}`}>
              <div style={{ textAlign: 'center' }}>
                <div className={styles.row}>
                  <div className={styles.col12}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
                    <img src="/assets/imagenes/transportadora.png" alt="" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
