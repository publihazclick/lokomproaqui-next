'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './tutoriales.module.css';
import type { CategoriaConVideos, CursoVideo } from './types';

function thumbnail(video: CursoVideo): string {
  return `https://img.youtube.com/vi/${video.video_url}/hqdefault.jpg`;
}

// Pedido explicito del usuario 2026-07-20: en celular los usuarios no notaban que la fila de
// categorias se puede deslizar horizontal -- no hay scrollbar visible (a proposito, ver CSS) y
// sin mas categorias que las que caben en pantalla no hay ninguna pista de que sigue habiendo mas.
// Se agrega el mismo patron de Netflix/YouTube: flecha + degradado que solo aparecen del lado que
// SI tiene contenido oculto (se recalculan con cada scroll/resize), y desaparecen solos al llegar
// a cada extremo. Igual en mobile y en desktop -- en mobile es la pista visual, en desktop ademas
// es clickeable (el trackpad/mouse wheel no siempre hace scroll horizontal de forma obvia).
function CategoriasSlider({
  categorias,
  activaId,
  onSelect,
}: {
  categorias: CategoriaConVideos[];
  activaId: number | null;
  onSelect: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [puedeIzq, setPuedeIzq] = useState(false);
  const [puedeDer, setPuedeDer] = useState(false);
  // Pedido explicito del usuario 2026-07-20 (segunda vuelta): la flecha+degradado no se notaba
  // suficiente -- pidio algo mas parecido a una barrita de scroll de verdad, visible todo el
  // tiempo que haya overflow (no solo en los bordes), con su "thumb" moviendose en vivo segun la
  // posicion real del scroll -- igual que el indicador nativo de iOS/Android, pero siempre visible
  // en vez de aparecer solo mientras se toca.
  const [barraVisible, setBarraVisible] = useState(false);
  const [thumbAncho, setThumbAncho] = useState(100);
  const [thumbIzq, setThumbIzq] = useState(0);

  const actualizarFlechas = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setPuedeIzq(el.scrollLeft > 4);
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);

    const overflow = el.scrollWidth - el.clientWidth;
    setBarraVisible(overflow > 4);
    if (overflow > 4) {
      const anchoPct = Math.max((el.clientWidth / el.scrollWidth) * 100, 12);
      const progreso = el.scrollLeft / overflow;
      setThumbAncho(anchoPct);
      setThumbIzq(progreso * (100 - anchoPct));
    }
  }, []);

  useEffect(() => {
    actualizarFlechas();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', actualizarFlechas, { passive: true });
    window.addEventListener('resize', actualizarFlechas);
    return () => {
      el.removeEventListener('scroll', actualizarFlechas);
      window.removeEventListener('resize', actualizarFlechas);
    };
  }, [actualizarFlechas, categorias.length]);

  function desplazar(direccion: number) {
    scrollRef.current?.scrollBy({ left: direccion * 220, behavior: 'smooth' });
  }

  return (
    <div className={styles.tutCategoriasWrap}>
      <div className={styles.tutCategorias} ref={scrollRef}>
        {categorias.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`${styles.tutCategoriaPill} ${cat.id === activaId ? styles.tutCategoriaPillActiva : ''}`}
            onClick={() => onSelect(cat.id)}
          >
            {cat.title}
          </button>
        ))}
      </div>

      {puedeIzq && <div className={`${styles.tutCatFade} ${styles.tutCatFadeIzq}`} />}
      {puedeIzq && (
        <button type="button" className={`${styles.tutCatFlecha} ${styles.tutCatFlechaIzq}`} onClick={() => desplazar(-1)} aria-label="Ver categorías anteriores">
          <ChevronLeft size={16} strokeWidth={3} />
        </button>
      )}

      {puedeDer && <div className={`${styles.tutCatFade} ${styles.tutCatFadeDer}`} />}
      {puedeDer && (
        <button type="button" className={`${styles.tutCatFlecha} ${styles.tutCatFlechaDer}`} onClick={() => desplazar(1)} aria-label="Ver más categorías">
          <ChevronRight size={16} strokeWidth={3} />
        </button>
      )}

      {barraVisible && (
        <div className={styles.tutCatBarraTrack}>
          <div className={styles.tutCatBarraThumb} style={{ width: `${thumbAncho}%`, left: `${thumbIzq}%` }} />
        </div>
      )}
    </div>
  );
}

export function TutorialesClient({ categorias }: { categorias: CategoriaConVideos[] }) {
  const [categoriaActivaId, setCategoriaActivaId] = useState<number | null>(categorias[0]?.id ?? null);
  const [videoAbierto, setVideoAbierto] = useState<CursoVideo | null>(null);

  // Lista aplanada de TODOS los videos en el orden que se muestran, para navegar
  // Anterior/Siguiente en el lightbox sin importar de que categoria viene cada uno.
  const videosPlanos = useMemo(() => categorias.flatMap((c) => c.videos), [categorias]);

  const categoriaActiva = categorias.find((c) => c.id === categoriaActivaId);
  const idxAbierto = videoAbierto ? videosPlanos.findIndex((v) => v.id === videoAbierto.id) : -1;
  const hayAnterior = idxAbierto > 0;
  const haySiguiente = idxAbierto >= 0 && idxAbierto < videosPlanos.length - 1;

  const cerrarVideo = () => setVideoAbierto(null);
  const videoAnterior = () => hayAnterior && setVideoAbierto(videosPlanos[idxAbierto - 1]);
  const videoSiguiente = () => haySiguiente && setVideoAbierto(videosPlanos[idxAbierto + 1]);

  useEffect(() => {
    if (!videoAbierto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarVideo();
      if (e.key === 'ArrowLeft') videoAnterior();
      if (e.key === 'ArrowRight') videoSiguiente();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoAbierto, idxAbierto]);

  if (categorias.length === 0) {
    return (
      <div className={styles.tutPage}>
        <div className={styles.tutHero}>
          <h1 className={styles.tutHeroTitulo}>Tutoriales</h1>
          <p className={styles.tutHeroSubtitulo}>
            Aprende a usar LokomproAqui paso a paso: como vender, como comprar, como despachar y mucho mas.
          </p>
        </div>
        <div className={styles.tutVacio}>Todavia no hay tutoriales publicados. Vuelve pronto.</div>
      </div>
    );
  }

  return (
    <div className={styles.tutPage}>
      <div className={styles.tutHero}>
        <h1 className={styles.tutHeroTitulo}>Tutoriales</h1>
        <p className={styles.tutHeroSubtitulo}>
          Aprende a usar LokomproAqui paso a paso: como vender, como comprar, como despachar y mucho mas.
        </p>
      </div>

      <div className={styles.tutContenido}>
        <CategoriasSlider categorias={categorias} activaId={categoriaActivaId} onSelect={setCategoriaActivaId} />

        {categoriaActiva && (
          <div className={styles.tutGrid}>
            {categoriaActiva.videos.map((video) => (
              <button
                key={video.id}
                type="button"
                className={styles.tutCard}
                onClick={() => setVideoAbierto(video)}
              >
                <div className={styles.tutCardMiniatura}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube, no de /public */}
                  <img src={thumbnail(video)} alt={video.title} loading="lazy" />
                  <span className={styles.tutCardPlay}>
                    <span className={styles.tutCardPlayTriangulo} />
                  </span>
                </div>
                <div className={styles.tutCardCuerpo}>
                  <h3 className={styles.tutCardTitulo}>{video.title}</h3>
                  {video.description && <p className={styles.tutCardDescripcion}>{video.description}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {videoAbierto && (
        <div className={styles.tutLightbox} onClick={cerrarVideo}>
          <div className={styles.tutLightboxCaja} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.tutLightboxCerrar} onClick={cerrarVideo} aria-label="Cerrar">
              &times;
            </button>

            <div className={styles.tutLightboxVideo}>
              <iframe
                src={`https://www.youtube.com/embed/${videoAbierto.video_url}?autoplay=1&rel=0`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className={styles.tutLightboxInfo}>
              <h3>{videoAbierto.title}</h3>
              {videoAbierto.description && <p>{videoAbierto.description}</p>}
            </div>

            <div className={styles.tutLightboxNav}>
              <button type="button" className={styles.tutNavBtn} disabled={!hayAnterior} onClick={videoAnterior}>
                <span className={`${styles.tutNavArrow} ${styles.tutNavArrowIzq}`} /> Anterior
              </button>
              <button
                type="button"
                className={`${styles.tutNavBtn} ${styles.tutNavBtnSiguiente}`}
                disabled={!haySiguiente}
                onClick={videoSiguiente}
              >
                Siguiente <span className={`${styles.tutNavArrow} ${styles.tutNavArrowDer}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
