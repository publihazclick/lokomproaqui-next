'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchCategoriasAdmin, eliminarCategoria, type CategoriaAdminRow } from '@/lib/categoriasAdmin';
import { FormCategoriaModal } from '@/components/FormCategoriaModal';
import { useToast, Toast } from '@/components/Toast';

// Port 1:1 de CategoriasComponent (Angular, panel admin "Categorias") -- backend ya bien
// conectado, sin bugs reales que corregir. Solo administra categorias de PRIMER NIVEL (cat_padre
// null), igual que el original -- las subcategorias se gestionan desde el dialogo de cada una.

export default function CategoriasPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [categorias, setCategorias] = useState<CategoriaAdminRow[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState<'crear' | number | null>(null);
  const { mensaje, mostrar } = useToast();

  const cargar = useCallback(async (search: string) => {
    setCargando(true);
    const res = await fetchCategoriasAdmin(search);
    setCargando(false);
    setCategorias(res.data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      setEstado('listo');
      cargar('');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function eliminar(id: number) {
    if (!window.confirm('Deseas Eliminar Dato')) return;
    const ok = await eliminarCategoria(id);
    if (!ok) return mostrar('Error de servidor');
    setCategorias((prev) => prev.filter((c) => c.id !== id));
    mostrar('Eliminado');
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1140px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Categorías</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cargar(busqueda)}
            placeholder="Buscar categorías"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={() => cargar(busqueda)} disabled={cargando} className="rounded bg-[#0d6efd] px-3 py-2 text-sm text-white disabled:opacity-60">
            Buscar
          </button>
          <button onClick={() => setModalAbierto('crear')} className="flex items-center gap-1 rounded bg-[#198754] px-3 py-2 text-sm font-medium text-white">
            <Plus className="h-4 w-4" /> Nueva
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          {cargando ? (
            <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-3">Acciones</th>
                  <th className="py-2 pr-3">Imagen</th>
                  <th className="py-2 pr-3">Categoría</th>
                  <th className="py-2 pr-3">Descripción</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <div className="flex gap-1">
                        <button onClick={() => setModalAbierto(c.id)} className="rounded bg-[#0d6efd] px-2 py-1 text-xs text-white">
                          <Eye className="h-3 w-3" />
                        </button>
                        <button onClick={() => eliminar(c.id)} className="rounded bg-[#dc3545] px-2 py-1 text-xs text-white">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- foto de categoria (Supabase Storage) */}
                      <img src={c.imagen || '/assets/categoria.jpeg'} alt="" className="h-10 w-10 rounded object-cover" />
                    </td>
                    <td className="py-2 pr-3 font-medium">{c.nombre}</td>
                    <td className="py-2 pr-3 text-gray-600">{c.descripcion}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.activo ? 'Activo' : 'Eliminado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!cargando && categorias.length === 0 && <p className="py-10 text-center text-gray-500">No hay categorías para mostrar.</p>}
        </div>
      </div>

      <Toast mensaje={mensaje} />

      {modalAbierto && (
        <FormCategoriaModal
          categoriaId={modalAbierto === 'crear' ? null : modalAbierto}
          onClose={() => setModalAbierto(null)}
          onGuardado={() => {
            setModalAbierto(null);
            cargar(busqueda);
          }}
        />
      )}
    </div>
  );
}
