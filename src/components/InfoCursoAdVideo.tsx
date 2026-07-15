'use client';

import { useState } from 'react';

// Version del anuncio del curso Acelerador de Ventas EXCLUSIVA de /info -- a diferencia de
// CursoAdVideo.tsx (usado en /acelerador, formato 16:9 horizontal con clases Tailwind), esta
// replica el formato VERTICAL 9:16 (estilo Shorts) del info.component.html/.scss original, con
// las clases exactas de info.module.css pasadas por props para fidelidad total.
export function InfoCursoAdVideo({
  youtubeId,
  label,
  mediaClass,
  glowClass,
  ratioClass,
  thumbClass,
  playClass,
  playTriangleClass,
}: {
  youtubeId: string;
  label: string;
  mediaClass: string;
  glowClass: string;
  ratioClass: string;
  thumbClass: string;
  playClass: string;
  playTriangleClass: string;
}) {
  const [reproduciendo, setReproduciendo] = useState(false);

  return (
    <div className={mediaClass}>
      <div className={glowClass} />
      <div className={ratioClass}>
        {reproduciendo ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`} allow="autoplay" allowFullScreen />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube */}
            <img className={thumbClass} src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`} alt={label} onClick={() => setReproduciendo(true)} />
            <button type="button" className={playClass} onClick={() => setReproduciendo(true)} aria-label={label}>
              <span className={playTriangleClass} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
