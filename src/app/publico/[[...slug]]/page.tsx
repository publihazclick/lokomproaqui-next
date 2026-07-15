'use client';

import { use, useEffect, useState } from 'react';
import { fetchCatalogoPublico, fetchGaleriaCatalogo, descargarImagen, detectarRango, type CatalogoPublico, type ItemGaleria } from '@/lib/publico';
import { formatCOP } from '@/lib/cartStore';

// Port de CatalogoComponent (Angular, modulo `publico`) -- ver src/lib/publico.ts para el detalle
// del bug real de descarga corregido y la regla de geolocalizacion (precio minorista/mayorista).

function extraerId(slug: string[] | undefined): number | null {
  if (!slug || slug.length === 0) return null;
  const ultimo = slug[slug.length - 1];
  if (ultimo === 'catalago') return null;
  const n = Number(ultimo);
  return Number.isFinite(n) ? n : null;
}

export default function PublicoCatalogoPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = use(params);
  const id = extraerId(slug);

  const [estado, setEstado] = useState<'cargando' | 'listo' | 'no-encontrado'>('cargando');
  const [catalogo, setCatalogo] = useState<CatalogoPublico | null>(null);
  const [galeria, setGaleria] = useState<ItemGaleria[]>([]);
  const [rango, setRango] = useState(true);
  const [descargandoTodas, setDescargandoTodas] = useState(false);

  useEffect(() => {
    (async () => {
      detectarRango().then(setRango);
      if (id) {
        const cat = await fetchCatalogoPublico(id);
        if (!cat) {
          setEstado('no-encontrado');
          return;
        }
        setCatalogo(cat);
        setGaleria(await fetchGaleriaCatalogo(id));
      } else {
        setGaleria(await fetchGaleriaCatalogo());
      }
      setEstado('listo');
    })();
  }, [id]);

  async function descargarUna(item: ItemGaleria) {
    await descargarImagen(item.foto, `producto-${item.id}.jpg`);
  }

  async function descargarTodas() {
    setDescargandoTodas(true);
    for (const item of galeria) await descargarUna(item);
    setDescargandoTodas(false);
  }

  if (estado === 'cargando') return null;
  if (estado === 'no-encontrado') {
    return <p className="py-16 text-center text-gray-500">Lo sentimos este catálogo no está disponible.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          {catalogo?.titulo}{' '}
          {catalogo && (
            <span className="text-green-600">
              Precio {formatCOP(rango ? catalogo.precio : catalogo.precioMayor)}
            </span>
          )}
        </h1>
        {galeria.length > 0 && (
          <button onClick={descargarTodas} disabled={descargandoTodas} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {descargandoTodas ? 'Descargando…' : 'Descargar todas las fotos'}
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {galeria.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-100 p-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
            <img src={item.foto} alt="" className="h-40 w-full rounded object-cover" />
            <button onClick={() => descargarUna(item)} className="mt-2 w-full rounded bg-[#0d6efd] px-2 py-1.5 text-xs font-medium text-white">
              Descargar
            </button>
          </div>
        ))}
      </div>

      {galeria.length === 0 && <h5 className="py-10 text-center text-gray-500">No Hay imagenes</h5>}
    </div>
  );
}
