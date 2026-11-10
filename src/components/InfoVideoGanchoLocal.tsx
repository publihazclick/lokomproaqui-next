'use client';

import { useRef, useState } from 'react';

// 10-11-2026 (pedido del usuario): en la home (/info) el "video 2" de YouTube se cambia por el
// video gancho del Acelerador ("por qué somos los mejores en campañas", el mismo de /acelerador,
// archivo en public/acelerador/). Usa las MISMAS clases de info.module.css que InfoCursoAdVideo
// (marco 9:16, brillo, botón de play blanco) para que los dos videos se vean parejos uno al lado
// del otro. Arranca con la portada; al tocar play reproduce con sonido y muestra los controles.
export function InfoVideoGanchoLocal({
  label,
  mediaClass,
  glowClass,
  ratioClass,
  thumbClass,
  playClass,
  playTriangleClass,
}: {
  label: string;
  mediaClass: string;
  glowClass: string;
  ratioClass: string;
  thumbClass: string;
  playClass: string;
  playTriangleClass: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [iniciado, setIniciado] = useState(false);

  const reproducir = () => {
    setIniciado(true);
    void videoRef.current?.play();
  };

  return (
    <div className={mediaClass}>
      <div className={glowClass} />
      <div className={ratioClass}>
        <video
          ref={videoRef}
          className={thumbClass}
          src="/acelerador/video-gancho.mp4"
          poster="/acelerador/video-gancho.jpg"
          preload="metadata"
          playsInline
          controls={iniciado}
          controlsList="nodownload"
          onPlay={() => setIniciado(true)}
          aria-label={label}
          onClick={iniciado ? undefined : reproducir}
        />
        {!iniciado && (
          <button type="button" className={playClass} onClick={reproducir} aria-label={label}>
            <span className={playTriangleClass} />
          </button>
        )}
      </div>
    </div>
  );
}
