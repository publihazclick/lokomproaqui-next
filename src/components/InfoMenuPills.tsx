'use client';

import { useState } from 'react';
import Link from 'next/link';

// Port de MenuComponent (Angular, layout/menu/menu.component -- selector <app-menu>, primera
// linea de info.component.html). "¿Como Funciona?", "¿Por donde Inicio?", "Soy Proveedor" y
// "Quiero Vender" abren un video de YouTube en un modal simple (OpenIframeComponent original).
// "Mentoría" no tiene ningun link/accion en el original -- se deja igual, sin href ni onClick.
//
// Rediseño "unicornio" pedido por el usuario 2026-07-17: los 7 pills blancos (look de app vieja)
// se reemplazan por cards grandes icono+texto en grilla de 2 columnas, con copy mas vendedor.

const VIDEOS: Record<string, string> = {
  comoFunciona: 'hHMueMmIyT8',
  porDondeInicio: 'BGIUhioBkAI',
  soyProveedor: '4h-cxDIRusk',
  quieroVender: 'G1W1vL62Hus',
};

const CARD_CLASS =
  'flex flex-col items-center gap-2.5 rounded-[24px] bg-white p-6 text-center shadow-lg shadow-indigo-500/10 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/20';
const EMOJI_CLASS = 'text-3xl';
const LABEL_CLASS = 'text-base font-bold text-gray-800';

export function InfoMenuPills() {
  const [videoAbierto, setVideoAbierto] = useState<string | null>(null);

  return (
    <>
      <section className="mx-auto w-full max-w-[1200px] px-4 pt-7">
        <div className="grid grid-cols-2 gap-5">
          <Link href="/acelerador" className={CARD_CLASS}>
            <span className={EMOJI_CLASS}>🚀</span>
            <span className={LABEL_CLASS}>Vende 2x Más Rápido</span>
          </Link>
          <button type="button" onClick={() => setVideoAbierto(VIDEOS.comoFunciona)} className={CARD_CLASS}>
            <span className={EMOJI_CLASS}>✨</span>
            <span className={LABEL_CLASS}>Como Ganar Dinero</span>
          </button>
          <button type="button" onClick={() => setVideoAbierto(VIDEOS.porDondeInicio)} className={CARD_CLASS}>
            <span className={EMOJI_CLASS}>🗺️</span>
            <span className={LABEL_CLASS}>Empieza en 3 Pasos</span>
          </button>
          <button type="button" onClick={() => setVideoAbierto(VIDEOS.soyProveedor)} className={CARD_CLASS}>
            <span className={EMOJI_CLASS}>🏭</span>
            <span className={LABEL_CLASS}>Vende Tus Productos</span>
          </button>
          <button type="button" onClick={() => setVideoAbierto(VIDEOS.quieroVender)} className={CARD_CLASS}>
            <span className={EMOJI_CLASS}>💰</span>
            <span className={LABEL_CLASS}>Empieza a Vender Hoy</span>
          </button>
          <div className={CARD_CLASS}>
            <span className={EMOJI_CLASS}>🧠</span>
            <span className={LABEL_CLASS}>Mentoría 1 a 1</span>
          </div>
          <Link href="/tutoriales" className={`${CARD_CLASS} col-span-2 sm:col-span-1`}>
            <span className={EMOJI_CLASS}>📚</span>
            <span className={LABEL_CLASS}>Academia Gratis</span>
          </Link>
        </div>
      </section>

      {videoAbierto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setVideoAbierto(null)}>
          <div className="w-full max-w-[440px] rounded-[20px] bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <iframe
              width="400"
              height="315"
              src={`https://www.youtube.com/embed/${videoAbierto}`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="max-w-full border-0"
            />
            <button type="button" className="ml-auto mt-3 block rounded-lg px-3 py-2 font-semibold text-red-600" onClick={() => setVideoAbierto(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
