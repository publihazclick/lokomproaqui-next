'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './tutoriales.module.css';
import type { CategoriaConVideos, CursoVideo } from './types';

function thumbnail(video: CursoVideo): string {
  return `https://img.youtube.com/vi/${video.video_url}/hqdefault.jpg`;
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
        <div className={styles.tutCategorias}>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.tutCategoriaPill} ${cat.id === categoriaActivaId ? styles.tutCategoriaPillActiva : ''}`}
              onClick={() => setCategoriaActivaId(cat.id)}
            >
              {cat.title}
            </button>
          ))}
        </div>

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
