'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';

// Miniatura propia (sin el "chrome" de YouTube) con boton de play a medida -- el iframe real
// (con autoplay) solo se carga al hacer click, igual que el original Angular, para que se
// sienta como un anuncio diseñado y no como un video incrustado desde el primer render.
export function CursoAdVideo({ youtubeId, label }: { youtubeId: string; label: string }) {
  const [reproduciendo, setReproduciendo] = useState(false);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.5)]">
      {reproduciendo ? (
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`}
          allow="autoplay"
          allowFullScreen
        />
      ) : (
        <button type="button" className="group block h-full w-full" onClick={() => setReproduciendo(true)} aria-label={label}>
          {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube */}
          <img
            src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
            alt={label}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-110">
              <Play className="ml-1 h-7 w-7 fill-[#0177a8] text-[#0177a8]" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
