'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Eye, Menu, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchModulosConLecciones, tieneAccesoAcelerador, fetchUrlFirmadaLeccion, formatDuracion, type ModuloConLecciones, type Leccion } from '@/lib/acelerador';

// Port de AceleradorPlayerComponent (Angular, "/acelerador/leccion/:id", protegido por
// AceleradorGuard) -- reproductor con sidebar de todo el curso + Siguiente/Anterior. El video
// nunca llega con una URL publica (URL firmada de corta duracion via Edge Function
// acelerador-signed-url, ya desplegada). La marca de agua (nombre+telefono, jitter cada 25s) y el
// bloqueo de clic derecho son disuasivos, no proteccion real -- mismo alcance que el original.

export default function AceleradorPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const leccionId = Number(id);

  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [modulos, setModulos] = useState<ModuloConLecciones[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [cargandoVideo, setCargandoVideo] = useState(true);
  const [errorVideo, setErrorVideo] = useState<string | null>(null);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [marcaAgua, setMarcaAgua] = useState({ top: 10, left: 10 });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      if (usuario.rolname !== 'mentor') {
        const acceso = await tieneAccesoAcelerador(usuario.id);
        if (!acceso) {
          window.location.href = '/acelerador';
          return;
        }
      }
      setDataUser(usuario);
      setModulos(await fetchModulosConLecciones());
      setEstado('listo');
    });
  }, []);

  useEffect(() => {
    if (estado !== 'listo' || !leccionId) return;
    setCargandoVideo(true);
    setErrorVideo(null);
    setVideoUrl(null);
    fetchUrlFirmadaLeccion(leccionId).then((res) => {
      setCargandoVideo(false);
      if (!res.success) {
        setErrorVideo(res.message || 'No pudimos cargar el video');
        return;
      }
      setVideoUrl(res.url || null);
    });
  }, [estado, leccionId]);

  useEffect(() => {
    const interval = setInterval(() => setMarcaAgua({ top: 10 + Math.random() * 70, left: 10 + Math.random() * 70 }), 25000);
    return () => clearInterval(interval);
  }, []);

  const plano = useMemo(() => {
    const lista: (Leccion & { moduloTitulo: string })[] = [];
    for (const m of modulos) for (const l of m.lecciones) lista.push({ ...l, moduloTitulo: m.titulo });
    return lista;
  }, [modulos]);

  const idx = plano.findIndex((l) => l.id === leccionId);
  const leccionActual = idx >= 0 ? plano[idx] : null;
  const leccionAnterior = idx > 0 ? plano[idx - 1] : null;
  const leccionSiguiente = idx >= 0 && idx < plano.length - 1 ? plano[idx + 1] : null;

  if (estado === 'revisando' || !dataUser) return null;

  return (
    <div className="flex min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto bg-white shadow-lg transition-transform lg:static lg:translate-x-0 ${sidebarAbierto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h5 className="font-semibold text-gray-800">Contenido del curso</h5>
          <button onClick={() => setSidebarAbierto(false)} className="lg:hidden">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-2">
          {modulos.map((m) => (
            <div key={m.id} className="mb-3">
              <div className="px-2 py-1 text-sm font-extrabold uppercase text-gray-600">{m.titulo}</div>
              {m.lecciones.map((l) => (
                <Link
                  key={l.id}
                  href={`/acelerador/leccion/${l.id}`}
                  onClick={() => setSidebarAbierto(false)}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${l.id === leccionId ? 'bg-green-50 font-medium text-green-700' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <span className="flex-1">{l.titulo}</span>
                  {l.duracionSegundos != null && <span className="text-xs text-gray-400">{formatDuracion(l.duracionSegundos)}</span>}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {sidebarAbierto && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarAbierto(false)} />}

      <main className="flex-1 px-4 py-6">
        <button onClick={() => setSidebarAbierto(true)} className="mb-3 flex items-center gap-1 text-sm text-gray-600 lg:hidden">
          <Menu className="h-4 w-4" /> Contenido del curso
        </button>

        {dataUser.rolname === 'mentor' && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <Eye className="h-4 w-4" /> Vista previa (mentor) — asi lo ve un suscriptor real.
          </div>
        )}

        {leccionActual && <p className="text-sm font-extrabold uppercase text-gray-500 sm:text-base">{leccionActual.moduloTitulo}</p>}
        {leccionActual && <h2 className="mt-1 text-xl font-bold text-gray-800">{leccionActual.titulo}</h2>}
        {leccionActual?.descripcion && <p className="mt-1 text-sm text-gray-600">{leccionActual.descripcion}</p>}

        {cargandoVideo && <p className="mt-4 text-center text-gray-500">Cargando video...</p>}
        {errorVideo && <p className="mt-4 rounded bg-red-50 p-3 text-center text-sm text-red-700">{errorVideo}</p>}

        {videoUrl && (
          <div className="relative mt-4" onContextMenu={(e) => e.preventDefault()}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- leccion del curso, sin subtitulos en el original */}
            <video
              src={videoUrl}
              poster={leccionActual?.thumbnailUrl || undefined}
              controls
              controlsList="nodownload"
              disablePictureInPicture
              className="max-h-[70vh] w-full rounded-lg bg-black object-contain"
            />
            <div className="pointer-events-none absolute rounded bg-black/40 px-2 py-1 text-xs text-white/70" style={{ top: `${marcaAgua.top}%`, left: `${marcaAgua.left}%` }}>
              {dataUser.nombre} {dataUser.apellido} · {dataUser.telefono}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          {leccionAnterior ? (
            <Link href={`/acelerador/leccion/${leccionAnterior.id}`} className="flex items-center gap-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <ArrowLeft className="h-4 w-4" /> {leccionAnterior.titulo}
            </Link>
          ) : (
            <span />
          )}
          {leccionSiguiente && (
            <Link href={`/acelerador/leccion/${leccionSiguiente.id}`} className="flex items-center gap-1 rounded bg-[#0d6efd] px-3 py-2 text-sm text-white">
              {leccionSiguiente.titulo} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
