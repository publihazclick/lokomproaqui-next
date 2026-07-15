import { supabase } from '@/lib/supabase';
import { ContadorShipping } from '@/components/ContadorShipping';
import { InfoCursoAdVideo } from '@/components/InfoCursoAdVideo';
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

export const revalidate = 60;

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
  const { data: config } = await supabase.from('site_config').select('info_text').limit(1).single();
  const infoText = (config?.info_text ?? {}) as Record<string, string>;
  const numeroWhatsapp = infoText.clInformacion || '3506700802';
  const video1 = extraerIdYoutube(infoText.aceleradorVideoGancho1);
  const video2 = extraerIdYoutube(infoText.aceleradorVideoGancho2);

  return (
    <div className={styles.infoPage}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- Poppins, mismo font-family que el original Angular */}
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap" rel="stylesheet" />

      <div className={styles.row} style={{ margin: '5px' }}>
        {video1 && (
          <div className={styles.col12}>
            <section className={styles.cursoAd}>
              <div className={`${styles.cursoAdDecor} ${styles.cursoAdDecor1}`} />
              <div className={`${styles.cursoAdDecor} ${styles.cursoAdDecor2}`} />
              <span className={styles.cursoAdBadge}>🔥 Nuevo</span>

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
                      Tan solo <strong>$35 USD</strong> al mes
                    </span>
                    <a href="/acelerador?checkout=1" className={styles.cursoAdCta}>
                      Suscribirme
                    </a>
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
                <a href="/singUp/vendedor/3213692393" className={styles.registrateGratis} style={{ textDecoration: 'none' }}>
                  Regístrate gratis
                </a>
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
                    <p>Más de 85 proveedores con productos disponibles para generar ingresos.</p>
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
                      <p>{texto}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        <div className={styles.col12}>
        <div className={styles.rowSinGutter}>
          <div className={styles.colSm4SinGutter}>
            <div className={styles.colorFondo4}>
              <h3 className={styles.registroBoxTitle}>Registro Proveedor</h3>
              <p className={styles.registroBoxSubtitle}>Empieza con tu red de ventas</p>
              <a href="/singUp/proveedor/3213692393" className={styles.registroBoxButton}>
                Registrarme →
              </a>
              <br />
              {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
              <img src="/assets/imagenes/REGISTROPROVEEDOR.png" alt="" className={styles.registroBoxImg} />
            </div>
          </div>
          <div className={styles.colSm4SinGutter}>
            <div className={styles.colorFondo4}>
              <h3 className={styles.registroBoxTitle}>Registro Vendedor</h3>
              <p className={styles.registroBoxSubtitle}>Empieza a generar venta sin invertir</p>
              <a href="/singUp/vendedor/3213692393" className={styles.registroBoxButton}>
                Registrarme →
              </a>
              <br />
              {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
              <img src="/assets/imagenes/REGISTROVENDEDOR.png" alt="" className={styles.registroBoxImg} />
            </div>
          </div>
          <div className={styles.colSm4SinGutter}>
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

        <div className={`${styles.col12} ${styles.row} ${styles.colorFondo5}`} style={{ margin: '0 -1px' }}>
          <div className={styles.col12}>
            <div className={`${styles.dFlex} ${styles.justifyContentCenter}`}>
              <div style={{ textAlign: 'center', width: '100%' }}>
                <h2>
                  Registrate no <br /> Pierdas Más Dinero
                </h2>
                <section style={{ width: '100%', maxWidth: '376px', fontSize: '25px', height: '70px', display: 'inline-block', boxSizing: 'border-box' }}>
                  <a href="/singUp/vendedor/3213692393" className={`${styles.btn} ${styles.btnDark} ${styles.customButton}`} style={{ textDecoration: 'none' }}>
                    Regístrate gratis
                  </a>
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
