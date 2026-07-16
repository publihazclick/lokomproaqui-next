'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto } from '@/lib/usuarios';
import { fetchCategoriasCursos, crearCategoriaCurso, actualizarCurso, eliminarCurso, type CategoriaCursos, type CursoAdminRow } from '@/lib/cursos';
import { FormTutorialModal } from '@/components/FormTutorialModal';
import { useToast, Toast } from '@/components/Toast';

// Port de CursosComponent (Angular, "/config/cursos") -- administracion de "Tutoriales" (pagina
// publica /tutoriales): categorias + videos de YouTube dentro de cada una. Sin bugs reales -- ver
// nota en lib/cursos.ts sobre por que se borran los videos antes que la categoria al eliminar.
//
// Bug real de seguridad encontrado y corregido: sin chequeo de rol. Se agrega el mismo chequeo de
// /config/usuarios.

export default function CursosPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-autorizado'>('revisando');
  const [categorias, setCategorias] = useState<CategoriaCursos[]>([]);
  const [nuevaCategoriaTitulo, setNuevaCategoriaTitulo] = useState('');
  const [modalVideo, setModalVideo] = useState<{ video: CursoAdminRow | null; categoriaId: number; orden: number } | null>(null);
  const [creandoCategoria, setCreandoCategoria] = useState(false);

  async function cargar() {
    setCategorias(await fetchCategoriasCursos());
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      if (usuario.rolname !== 'administrador') {
        setEstado('no-autorizado');
        return;
      }
      await cargar();
      setEstado('listo');
    });
  }, []);

  async function crearCategoria() {
    if (!nuevaCategoriaTitulo.trim()) return;
    setCreandoCategoria(true);
    const ok = await crearCategoriaCurso(nuevaCategoriaTitulo.trim(), categorias.length);
    setCreandoCategoria(false);
    if (!ok) {
      mostrar('Error de servidor');
      return;
    }
    setNuevaCategoriaTitulo('');
    mostrar('Categoria creada');
    cargar();
  }

  async function guardarTituloCategoria(cat: CategoriaCursos) {
    const ok = await actualizarCurso(cat.id, { titulo: cat.titulo });
    mostrar(ok ? 'Actualizado' : 'Error de servidor');
  }

  async function eliminarCategoria(cat: CategoriaCursos) {
    if (!window.confirm(`¿Eliminar la categoria "${cat.titulo}"? Esto tambien borra sus ${cat.videos.length} videos, sin poder deshacerlo.`)) return;
    for (const video of cat.videos) await eliminarCurso(video.id);
    await eliminarCurso(cat.id);
    mostrar('Eliminado');
    cargar();
  }

  async function moverCategoria(index: number, direccion: number) {
    const vecino = index + direccion;
    if (vecino < 0 || vecino >= categorias.length) return;
    const actual = categorias[index];
    const otro = categorias[vecino];
    await actualizarCurso(actual.id, { orden: otro.orden });
    await actualizarCurso(otro.id, { orden: actual.orden });
    cargar();
  }

  async function moverVideo(cat: CategoriaCursos, index: number, direccion: number) {
    const vecino = index + direccion;
    if (vecino < 0 || vecino >= cat.videos.length) return;
    const actual = cat.videos[index];
    const otro = cat.videos[vecino];
    await actualizarCurso(actual.id, { orden: otro.orden });
    await actualizarCurso(otro.id, { orden: actual.orden });
    cargar();
  }

  async function eliminarVideo(video: CursoAdminRow) {
    if (!window.confirm(`¿Eliminar el video "${video.titulo}"?`)) return;
    await eliminarCurso(video.id);
    mostrar('Eliminado');
    cargar();
  }

  function actualizarTituloLocal(catId: number, titulo: string) {
    setCategorias((prev) => prev.map((c) => (c.id === catId ? { ...c, titulo } : c)));
  }

  if (estado === 'no-autorizado') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-gray-500">Esta sección es solo para administradores.</p>
      </div>
    );
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1000px] px-3 py-6">
      <h3 className="text-xl font-bold text-gray-800">Tutoriales — Categorias y videos</h3>
      <p className="mt-1 text-sm text-gray-500">
        Organiza los videos de YouTube que enseñan a usar LokomproAqui. Crea una categoria (ej: &quot;Para vendedores&quot;, &quot;Para proveedores&quot;) y agrega los videos dentro de cada una.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          value={nuevaCategoriaTitulo}
          onChange={(e) => setNuevaCategoriaTitulo(e.target.value)}
          placeholder="Nombre de la categoria nueva"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button onClick={crearCategoria} disabled={creandoCategoria} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          + Crear categoria
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {categorias.map((cat, i) => (
          <div key={cat.id} className="rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <button onClick={() => moverCategoria(i, -1)} disabled={i === 0} className="rounded border border-gray-300 p-1 disabled:opacity-30">
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button onClick={() => moverCategoria(i, 1)} disabled={i === categorias.length - 1} className="rounded border border-gray-300 p-1 disabled:opacity-30">
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <input
                value={cat.titulo}
                onChange={(e) => actualizarTituloLocal(cat.id, e.target.value)}
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <button onClick={() => guardarTituloCategoria(cat)} className="rounded bg-[#0d6efd] px-3 py-2 text-xs font-medium text-white">
                Guardar
              </button>
              <button onClick={() => eliminarCategoria(cat)} className="rounded bg-[#dc3545] px-3 py-2 text-xs font-medium text-white">
                Eliminar categoria
              </button>
            </div>

            <ul className="mt-3 divide-y divide-gray-100 rounded border border-gray-100">
              {cat.videos.map((video, j) => (
                <li key={video.id} className="flex items-center justify-between p-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex flex-col gap-0.5">
                      <button onClick={() => moverVideo(cat, j, -1)} disabled={j === 0} className="rounded border border-gray-300 p-0.5 disabled:opacity-30">
                        <ArrowUp className="h-2.5 w-2.5" />
                      </button>
                      <button onClick={() => moverVideo(cat, j, 1)} disabled={j === cat.videos.length - 1} className="rounded border border-gray-300 p-0.5 disabled:opacity-30">
                        <ArrowDown className="h-2.5 w-2.5" />
                      </button>
                    </span>
                    {video.titulo}
                    {!video.url && <span className="text-xs text-gray-400">(sin link de YouTube)</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    {video.url && (
                      <a href={`https://youtu.be/${video.url}`} target="_blank" rel="noreferrer" className="rounded border border-gray-300 px-2 py-1 text-xs">
                        Ver
                      </a>
                    )}
                    <button onClick={() => setModalVideo({ video, categoriaId: cat.id, orden: video.orden })} className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700">
                      Editar
                    </button>
                    <button onClick={() => eliminarVideo(video)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">
                      Eliminar
                    </button>
                  </span>
                </li>
              ))}
              {cat.videos.length === 0 && <li className="p-2 text-sm text-gray-400">Esta categoria todavia no tiene videos.</li>}
            </ul>

            <button
              onClick={() => setModalVideo({ video: null, categoriaId: cat.id, orden: cat.videos.length })}
              className="mt-2 rounded bg-gray-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              + Agregar video
            </button>
          </div>
        ))}

        {categorias.length === 0 && (
          <p className="py-10 text-center text-gray-500">Todavia no hay ninguna categoria. Crea la primera arriba para empezar a organizar los tutoriales.</p>
        )}
      </div>

      <Toast mensaje={mensaje} />

      {modalVideo && (
        <FormTutorialModal
          video={modalVideo.video}
          categoriaId={modalVideo.categoriaId}
          orden={modalVideo.orden}
          onClose={() => setModalVideo(null)}
          onGuardado={() => {
            setModalVideo(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}
