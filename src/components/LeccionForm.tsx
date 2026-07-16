'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// El cliente de Supabase (functions-js) oculta el mensaje real de la Edge Function detras de un
// generico "Edge Function returned a non-2xx status code" -- el cuerpo real de la respuesta
// queda en error.context (el Response crudo, todavia sin leer) y hay que parsearlo a mano.
// Encontrado 2026-07-16 investigando un reporte real de un mentor al que no le dejaba subir
// cursos: la funcion en si funcionaba bien (probado con una cuenta de prueba real), pero el
// usuario solo veia el mensaje generico sin ninguna pista de la causa real (sesion vencida,
// sin permiso, etc.) -- este helper hace que el motivo real siempre se vea.
const MENSAJES_CONOCIDOS: Record<string, string> = {
  'No autenticado': 'Tu sesión expiró. Cierra sesión, vuelve a entrar y prueba de nuevo.',
  'No autorizado': 'Tu cuenta no tiene permiso de mentor para subir cursos.',
  'path invalido': 'Ocurrió un error interno subiendo el video. Intenta de nuevo.',
};

async function mensajeRealDeErrorEdge(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return MENSAJES_CONOCIDOS[body.error] || body.error;
    } catch {
      /* el cuerpo no era JSON */
    }
  }
  return fallback;
}

const THUMB_BUCKET = 'lokomproaqui-media';
// Mismo limite que en Angular: el proyecto de Supabase acepta hasta 500MB por archivo (ver
// memoria lokomproaqui_project, arreglo de subida del mentor de hoy mismo).
const LIMITE_MB = 500;

export interface Leccion {
  id?: number;
  module_id: number;
  title: string;
  description: string | null;
  sort_order: number;
  video_path: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
}

// Sube un archivo PUBLICO (miniaturas, bucket lokomproaqui-media) via XHR directo al endpoint
// REST de Storage -- unica forma de tener progreso real. Este bucket nunca tuvo el bug de
// abajo (su policy no depende de auth.uid()/auth.role()).
function subirArchivoConProgreso(
  file: File,
  bucket: string,
  carpeta: string,
  onProgress: (pct: number) => void
): Promise<{ success: boolean; path?: string; publicUrl?: string; message?: string }> {
  return new Promise(async (resolve) => {
    const ext = (file.name || 'bin').split('.').pop();
    const path = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session ? sessionData.session.access_token : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        resolve({ success: true, path, publicUrl: data.publicUrl });
      } else {
        let message = 'Error subiendo el archivo. Intenta de nuevo.';
        try {
          message = JSON.parse(xhr.responseText).message || message;
        } catch {
          /* respuesta no era JSON */
        }
        resolve({ success: false, message });
      }
    };
    xhr.onerror = () => resolve({ success: false, message: 'Se perdió la conexión a internet. Revisa tu wifi/datos e intenta de nuevo.' });
    xhr.send(file);
  });
}

// Sube el video al bucket PRIVADO via URL de subida firmada (Edge Function
// acelerador-signed-upload), no via XHR directo con el JWT del mentor. Motivo real (encontrado
// y confirmado el 2026-07-15, ver memoria lokomproaqui-nextjs-migration): el servicio de
// Storage de Supabase en este proyecto NO reconoce la sesion del usuario para buckets privados
// (auth.uid()/auth.role() vuelven null ahi, aunque la MISMA sesion funciona perfecto via
// /rest/v1/rpc -- confirmado con pruebas directas por curl). Una URL firmada evita el problema
// por completo: la autorizacion real (solo mentores) queda del lado de la Edge Function
// (que SI verifica bien la sesion), y la subida en si usa un token de un solo uso que no
// depende de esa verificacion rota.
async function subirVideoConProgreso(
  file: File,
  onProgress: (pct: number) => void
): Promise<{ success: boolean; path?: string; message?: string }> {
  const ext = (file.name || 'mp4').split('.').pop();
  const path = `lecciones/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data: signData, error: signError } = await supabase.functions.invoke('acelerador-signed-upload', {
    body: { path },
  });
  if (signError || !signData?.signedUrl) {
    const message = await mensajeRealDeErrorEdge(signError, 'No se pudo iniciar la subida. Intenta de nuevo.');
    return { success: false, message };
  }

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signData.signedUrl);
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ success: true, path });
      } else {
        let message = 'Error subiendo el video. Intenta de nuevo.';
        try {
          message = JSON.parse(xhr.responseText).message || message;
        } catch {
          /* respuesta no era JSON */
        }
        resolve({ success: false, message });
      }
    };
    xhr.onerror = () => resolve({ success: false, message: 'Se perdió la conexión a internet. Revisa tu wifi/datos e intenta de nuevo.' });
    xhr.send(file);
  });
}

export function LeccionForm({
  moduloId,
  siguienteOrden,
  leccion,
  onClose,
  onGuardado,
}: {
  moduloId: number;
  siguienteOrden: number;
  leccion: Leccion | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [title, setTitle] = useState(leccion?.title ?? '');
  const [description, setDescription] = useState(leccion?.description ?? '');
  const [videoPath, setVideoPath] = useState(leccion?.video_path ?? null);
  const [thumbnailUrl, setThumbnailUrl] = useState(leccion?.thumbnail_url ?? null);
  const [durationSeconds, setDurationSeconds] = useState(leccion?.duration_seconds ?? null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subiendoVideo, setSubiendoVideo] = useState(false);
  const [progresoVideo, setProgresoVideo] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [subiendoThumb, setSubiendoThumb] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const duracionLegible = durationSeconds
    ? `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, '0')}`
    : null;

  function detectarDuracion(file: File) {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      if (isFinite(video.duration)) setDurationSeconds(Math.round(video.duration));
      URL.revokeObjectURL(url);
    };
    video.src = url;
  }

  async function subirVideo(file: File) {
    setSubiendoVideo(true);
    setProgresoVideo(0);
    const res = await subirVideoConProgreso(file, setProgresoVideo);
    setSubiendoVideo(false);
    if (!res.success) {
      setVideoError(res.message || 'Error subiendo el video. Intenta de nuevo.');
      return;
    }
    setVideoPath(res.path!);
  }

  // Apenas se elige/suelta el video arranca la subida sola, con barra de progreso -- no hace
  // falta un segundo click en "Subir" (mismo criterio que la version Angular de hoy).
  function onSelectVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoError(null);
    setVideoPath(null);
    detectarDuracion(file);

    const pesoMb = file.size / (1024 * 1024);
    if (pesoMb > LIMITE_MB) {
      setVideoError(`Pesa ${pesoMb.toFixed(0)} MB y el límite es ${LIMITE_MB} MB. Comprímelo (ej. con HandBrake) o grábalo en menor calidad e intenta de nuevo.`);
      return;
    }
    subirVideo(file);
  }

  function reintentarVideo() {
    if (!videoFile || videoFile.size / (1024 * 1024) > LIMITE_MB) return;
    subirVideo(videoFile);
  }

  async function onSelectThumbnail(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoThumb(true);
    const res = await subirArchivoConProgreso(file, THUMB_BUCKET, 'uploads', () => {});
    setSubiendoThumb(false);
    if (res.success) setThumbnailUrl(res.publicUrl!);
  }

  const puedeGuardar = !!(title.trim() && videoPath && !subiendoVideo);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return alert('Ponle un título a la clase');
    if (!videoPath) return alert('Sube el video antes de guardar');
    setGuardando(true);

    const payload = {
      module_id: moduloId,
      title,
      description: description || null,
      video_path: videoPath,
      thumbnail_url: thumbnailUrl,
      duration_seconds: durationSeconds,
    };

    const { error } = leccion?.id
      ? await supabase.from('acelerador_lessons').update(payload).eq('id', leccion.id)
      : await supabase.from('acelerador_lessons').insert({ ...payload, sort_order: siguienteOrden });

    setGuardando(false);
    if (error) return alert('Error de servidor, intenta de nuevo');
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-gray-900">{leccion?.id ? '🎬 Editar esta clase' : '🎬 Nueva clase para tu curso'}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">Ve completando cada paso de arriba hacia abajo. Al final tocas &quot;Guardar&quot;.</p>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-gray-700">PASO 1 — ¿Cómo se llama esta clase?</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Cómo cerrar una venta por WhatsApp"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#02a0e3]"
            />
          </label>

          <div>
            <span className="mb-1 block text-sm font-semibold text-gray-700">PASO 2 — Sube el video de esta clase</span>
            <p className="mb-2 text-xs text-gray-400">Si el video pesa mucho puede tardar varios minutos en subir. Mientras suba, no cierres ni recargues esta ventana.</p>

            {videoPath && (
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
                ✓ Video subido{duracionLegible ? ` (${duracionLegible})` : ''}
                <button
                  type="button"
                  onClick={() => {
                    setVideoPath(null);
                    setVideoFile(null);
                    setVideoError(null);
                  }}
                  className="text-xs font-semibold text-gray-500 underline"
                >
                  cambiar video
                </button>
              </div>
            )}

            {subiendoVideo && (
              <div className="mb-2">
                <div className="h-[18px] w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full bg-green-500 transition-all duration-200" style={{ width: `${progresoVideo}%` }} />
                </div>
                <p className="mt-1 text-xs text-gray-500">Subiendo... {progresoVideo}% (no cierres esta ventana)</p>
              </div>
            )}

            {videoError && (
              <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {videoError}
                {videoFile && videoFile.size / (1024 * 1024) <= LIMITE_MB && (
                  <button type="button" onClick={reintentarVideo} className="ml-2 font-semibold underline">
                    Reintentar
                  </button>
                )}
              </div>
            )}

            {!videoPath && !subiendoVideo && (
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 hover:border-[#02a0e3] hover:bg-[#f4faff]">
                Toca aquí para elegir el video desde tu celular o computador
                <span className="text-xs text-gray-400">Videos hasta {LIMITE_MB} MB</span>
                <input type="file" accept="video/*" className="hidden" onChange={onSelectVideo} />
              </label>
            )}
          </div>

          <div>
            <span className="mb-1 block text-sm font-semibold text-gray-700">PASO 3 — Agrega una imagen de portada (opcional, pero recomendado)</span>
            <p className="mb-2 text-xs text-gray-400">
              Esta imagen es lo primero que ven las personas antes de pagar el curso. Elige una que se vea clara y llamativa. Tamaño ideal:{' '}
              <span className="font-semibold text-gray-500">1280 x 720 px</span> (horizontal, como una foto de YouTube) — así se ve completa y sin cortes en celular y computador.
            </p>
            {thumbnailUrl && (
              <div className="mb-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura en Supabase Storage */}
                <img src={thumbnailUrl} alt="" className="aspect-video w-28 rounded bg-gray-100 object-contain" />
                <button type="button" onClick={() => setThumbnailUrl(null)} className="text-xs font-semibold text-gray-500 underline">
                  cambiar imagen
                </button>
              </div>
            )}
            {subiendoThumb && <p className="mb-2 text-xs text-gray-500">Subiendo imagen...</p>}
            {!thumbnailUrl && !subiendoThumb && (
              <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-4 py-4 text-center text-sm text-gray-500 hover:border-[#02a0e3] hover:bg-[#f4faff]">
                Toca aquí para elegir una imagen
                <input type="file" accept="image/*" className="hidden" onChange={onSelectThumbnail} />
              </label>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-gray-700">PASO 4 — Escribe una descripción cortita (opcional)</span>
            <p className="mb-2 text-xs text-gray-400">Este texto también lo ven las personas antes de pagar, para animarlas a inscribirse.</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ej: Vas a aprender los 3 pasos para cerrar cualquier venta por WhatsApp"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#02a0e3]"
            />
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100">
              Cerrar sin guardar
            </button>
            <button
              type="submit"
              disabled={!puedeGuardar || guardando}
              className="rounded-full bg-gradient-to-r from-[#0177a8] to-[#02a0e3] px-5 py-2 text-sm font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : leccion?.id ? '✅ Guardar cambios' : '✅ Guardar esta clase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
