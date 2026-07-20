'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { crearVideoCurso, actualizarCurso, type CursoAdminRow } from '@/lib/cursos';
import { useToast, Toast } from './Toast';

// Port de FormTutorialComponent (Angular) -- crear/editar un video tutorial dentro de una
// categoria. El link de YouTube se normaliza (extraerIdYoutube) aceptando cualquier formato.

export function FormTutorialModal({
  video,
  categoriaId,
  orden,
  onClose,
  onGuardado,
}: {
  video: CursoAdminRow | null;
  categoriaId: number;
  orden: number;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { mensaje, mostrar } = useToast();
  const [titulo, setTitulo] = useState(video?.titulo || '');
  const [url, setUrl] = useState(video?.url || '');
  const [descripcion, setDescripcion] = useState(video?.descripcion || '');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!titulo.trim() || !url.trim()) {
      mostrar('Completa el titulo y el link de YouTube');
      return;
    }
    setGuardando(true);
    const ok = video
      ? await actualizarCurso(video.id, { titulo: titulo.trim(), url: url.trim(), descripcion: descripcion.trim() })
      : await crearVideoCurso(categoriaId, orden, titulo.trim(), url.trim(), descripcion.trim());
    setGuardando(false);
    if (!ok) {
      mostrar('Error de servidor');
      return;
    }
    mostrar(video ? 'Actualizado' : 'Creado');
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">{video ? 'Actualizar' : 'Crear'} Video</h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Link de YouTube</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/…" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Descripción (opcional, se ve debajo del título en Academia Gratis)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Ej: Aprende a activar tu tienda y publicar tu primer producto en 5 minutos."
              className="w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={guardar} disabled={guardando} className="rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {guardando ? 'Guardando…' : video ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
