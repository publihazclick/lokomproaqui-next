'use client';

import { useState } from 'react';
import styles from '@/app/info/info.module.css';

// Port de MenuComponent (Angular, layout/menu/menu.component -- selector <app-menu>, primera
// linea de info.component.html). Se me habia pasado en el primer port. "¿Como Funciona?", "¿Por
// donde Inicio?", "Soy Proveedor" y "Quiero Vender" abren un video de YouTube en un modal simple
// (OpenIframeComponent original). "Mentoría" no tiene ningun link/accion en el original -- se
// deja igual, sin href ni onClick.

const VIDEOS: Record<string, string> = {
  comoFunciona: 'hHMueMmIyT8',
  porDondeInicio: 'BGIUhioBkAI',
  soyProveedor: '4h-cxDIRusk',
  quieroVender: 'G1W1vL62Hus',
};

export function InfoMenuPills() {
  const [videoAbierto, setVideoAbierto] = useState<string | null>(null);

  return (
    <>
      <section className={styles.iphoneMenu}>
        <ul className={styles.iphoneMenuUl}>
          <li className={styles.iphoneMenuLi}>
            <a href="/acelerador" className={styles.iphoneMenuA}>
              Acelerador de Ventas
            </a>
          </li>
          <li className={styles.iphoneMenuLi}>
            <button type="button" onClick={() => setVideoAbierto(VIDEOS.comoFunciona)} className={styles.iphoneMenuA}>
              ¿Como Funciona?
            </button>
          </li>
          <li className={styles.iphoneMenuLi}>
            <button type="button" onClick={() => setVideoAbierto(VIDEOS.porDondeInicio)} className={styles.iphoneMenuA}>
              ¿Por donde Inicio?
            </button>
          </li>
          <li className={styles.iphoneMenuLi}>
            <button type="button" onClick={() => setVideoAbierto(VIDEOS.soyProveedor)} className={styles.iphoneMenuA}>
              Soy Proveedor
            </button>
          </li>
          <li className={styles.iphoneMenuLi}>
            <button type="button" onClick={() => setVideoAbierto(VIDEOS.quieroVender)} className={styles.iphoneMenuA}>
              Quiero Vender
            </button>
          </li>
          <li className={styles.iphoneMenuLi}>
            <span className={styles.iphoneMenuA}>Mentoría</span>
          </li>
          <li className={styles.iphoneMenuLi}>
            <a href="/tutoriales" className={styles.iphoneMenuA}>
              Tutoriales
            </a>
          </li>
        </ul>
      </section>

      {videoAbierto && (
        <div className={styles.videoModalOverlay} onClick={() => setVideoAbierto(null)}>
          <div className={styles.videoModalBox} onClick={(e) => e.stopPropagation()}>
            <iframe
              width="400"
              height="315"
              src={`https://www.youtube.com/embed/${videoAbierto}`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ maxWidth: '100%', border: 0 }}
            />
            <button type="button" className={styles.videoModalClose} onClick={() => setVideoAbierto(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
