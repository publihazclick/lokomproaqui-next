'use client';

import { useState } from 'react';
import Link from 'next/link';

// Port de IntroduccionComponent (Angular, "/introduccion") -- wizard de bienvenida con 3 videos +
// paso final de registro. Los 3 videos son URLs fijas hardcodeadas en el Angular original (no
// vienen de site_config/`/config/admin` -- confirmado grepeando el codigo entero: los campos
// tituloPrimero/urlPrimero/etc. que administra AdminComponent no los lee NADA mas en toda la app,
// es una pantalla CMS huerfana. Se replica el mismo comportamiento real: videos fijos, sin conectar
// a site_config). El paso final ("Únete a nosotros", `<app-registro>` embebido) se simplifica a un
// boton que lleva a /registro en vez de duplicar el formulario completo inline.

// Revision 2026-11-05: los 3 .mp4 originales (bucket S3 "ecomercedilisap") ya no existen (404) y
// la pagina mostraba un reproductor vacio. Se cambian por los videos de YouTube que ya usan /info
// (InfoMenuPills) e /infoSupplier, con titulos acordes a cada video.
const PASOS = [
  { titulo: '¿Qué es LokomproAqui.com?', youtube: 'qMYKvn5dbvg' },
  { titulo: '¿Por dónde empiezo?', youtube: 'BGIUhioBkAI' },
  { titulo: '¿Cómo empiezo a vender?', youtube: 'G1W1vL62Hus' },
];

export default function IntroduccionPage() {
  const [paso, setPaso] = useState(0);

  return (
    <div className="mx-auto w-full max-w-[900px] px-3 py-8">
      <h2 className="text-center text-2xl font-bold text-gray-800">BIENVENIDOS A LOKOMPROAQUI.COM</h2>

      <div className="mt-6 flex items-center justify-center gap-2">
        {[...PASOS, { titulo: 'Únete a nosotros' }].map((_, i) => (
          <div key={i} className={`h-2 w-8 rounded-full ${i <= paso ? 'bg-[#0d6efd]' : 'bg-gray-200'}`} />
        ))}
      </div>

      {paso < PASOS.length ? (
        <div className="mt-6">
          <h3 className="text-center text-xl font-semibold text-gray-700">{PASOS[paso].titulo}</h3>
          <iframe
            key={paso}
            src={`https://www.youtube.com/embed/${PASOS[paso].youtube}`}
            title={PASOS[paso].titulo}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="mt-4 aspect-video w-full rounded-lg bg-black"
          />
          <div className="mt-4 flex justify-end gap-2">
            {paso > 0 && (
              <button onClick={() => setPaso(paso - 1)} className="rounded bg-[#dc3545] px-4 py-2 text-sm font-medium text-white">
                Atras
              </button>
            )}
            <button onClick={() => setPaso(paso + 1)} className="rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white">
              Siguiente
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 text-center">
          <h3 className="text-xl font-semibold text-gray-700">Únete a nosotros</h3>
          <Link href="/registro" className="mt-4 inline-block rounded-full bg-[#0d6efd] px-6 py-3 text-sm font-bold text-white hover:opacity-90">
            Registrarme
          </Link>
          <div className="mt-4">
            <button onClick={() => setPaso(paso - 1)} className="rounded bg-[#dc3545] px-4 py-2 text-sm font-medium text-white">
              Atras
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
