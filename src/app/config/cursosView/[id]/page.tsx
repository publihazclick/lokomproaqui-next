'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchCursos, type Curso } from '@/lib/cursos';

// Port de CursosViewComponent (Angular, "/config/cursosView/:id") -- reproductor de video del
// curso seleccionado + lista lateral. CursosService.get() ya estaba bien implementado (sin bugs),
// se porta directo. `mat-video` se reemplaza por un <video> nativo (misma fuente, sin dependencia
// nueva).

export default function CursosViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [seleccionado, setSeleccionado] = useState<Curso | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const lista = await fetchCursos();
      setCursos(lista);
      setSeleccionado(lista.find((c) => String(c.id) === id) || lista[0] || null);
      setEstado('listo');
    });
  }, [id]);

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <div className="sm:col-span-8">
          {seleccionado ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption -- video de curso, sin subtitulos en el original */}
              <video
                key={seleccionado.id}
                src={seleccionado.url || undefined}
                poster={seleccionado.img || undefined}
                controls
                autoPlay
                className="w-full rounded-lg bg-black"
              />
              <h2 className="mt-3 text-xl font-bold text-gray-800">{seleccionado.titulo}</h2>
              {seleccionado.descripcion && (
                <p className="mt-1 text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: seleccionado.descripcion }} />
              )}
            </>
          ) : (
            <p className="py-10 text-center text-gray-500">No hay cursos disponibles.</p>
          )}
        </div>
        <div className="sm:col-span-4">
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {cursos.map((item) => (
              <li
                key={item.id}
                onClick={() => setSeleccionado(item)}
                className={`flex cursor-pointer items-center gap-3 p-3 hover:bg-gray-50 ${seleccionado?.id === item.id ? 'bg-blue-50' : ''}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de curso (Supabase Storage) */}
                <img src={item.img || '/assets/noimagen.jpg'} alt="" className="h-14 w-24 rounded object-cover" />
                <h5 className="text-sm font-medium text-gray-800">{item.titulo}</h5>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
