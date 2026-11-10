'use client';

import { useRef, useState } from 'react';

// Video gancho de la vitrina de venta de /acelerador (pedido del usuario 10-11-2026: "por qué
// somos los mejores en las campañas", ponerlo donde mejor quede de manera estratégica).
//
// Va ARRIBA, antes del precio: quien llega primero ve los resultados reales (TikTok Ads +
// pedidos de Shopify) y después el precio y el botón de pago. El archivo vive en
// public/acelerador/ (720x1280, ~15 MB, faststart) -- NO en el worker de R2 de las clases, que
// solo sirve links firmados para quien ya pagó. Este es público a propósito: es publicidad.
//
// Arranca con la portada y un botón de play grande (con sonido: es un video hablado). Al
// terminar muestra "Quiero entrar al Acelerador", que abre el mismo pago que el botón de abajo.
export function AceleradorVideoGancho({ onQuieroEntrar }: { onQuieroEntrar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [iniciado, setIniciado] = useState(false);
  const [terminado, setTerminado] = useState(false);

  const reproducir = () => {
    const v = videoRef.current;
    if (!v) return;
    setIniciado(true);
    setTerminado(false);
    v.currentTime = terminado ? 0 : v.currentTime;
    void v.play();
  };

  return (
    // En computador el ancho sale del ALTO de la pantalla (9:16): en un portátil 1366x768 queda
    // ~280 px y se ve entero sin bajar; en pantallas altas llega al tope de 340 px.
    <div className="relative mx-auto w-full max-w-[340px] lg:w-[clamp(260px,calc((100svh_-_270px)*9/16),340px)]">
      {/* Brillo azul de marca detrás del video (nada de morado/fucsia: regla del negocio) */}
      <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-[#02a0e3]/35 to-[#0177a8]/10 blur-2xl" aria-hidden="true" />
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-black/10">
        <video
          ref={videoRef}
          src="/acelerador/video-gancho.mp4"
          poster="/acelerador/video-gancho.jpg"
          preload="metadata"
          playsInline
          controls={iniciado && !terminado}
          controlsList="nodownload"
          onPlay={() => setIniciado(true)}
          onEnded={() => setTerminado(true)}
          className="h-full w-full object-cover"
        />

        {!iniciado && (
          <button
            type="button"
            onClick={reproducir}
            aria-label="Ver el video"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/25 transition hover:bg-black/15"
          >
            <span className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-[#02a0e3] shadow-[0_10px_40px_rgba(2,160,227,0.6)]">
              <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9 text-white" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="rounded-full bg-black/70 px-4 py-1.5 text-sm font-bold text-white">Dale play · 1 min 29 s 🔊</span>
          </button>
        )}

        {terminado && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75 px-6 text-center">
            <p className="text-xl font-extrabold text-white">¿Quieres resultados como estos?</p>
            <button
              type="button"
              onClick={onQuieroEntrar}
              className="rounded-full bg-green-600 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:bg-green-700"
            >
              Quiero entrar al Acelerador
            </button>
            <button type="button" onClick={reproducir} className="text-sm font-semibold text-white/80 underline">
              Ver otra vez
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
