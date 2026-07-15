'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchTestimoniosAdmin, eliminarTestimonio, type TestimonioAdminRow } from '@/lib/testimoniosAdmin';
import { FormTestimonioModal } from '@/components/FormTestimonioModal';
import { useToast, Toast } from '@/components/Toast';

// Port de TestimonioComponent (Angular, panel admin "Testimonios"). Ver
// src/lib/testimoniosAdmin.ts para el detalle de los bugs reales corregidos: "Eliminar" nunca
// borraba nada de verdad (llamaba a update() con el objeto sin cambios), la columna de usuario
// siempre estaba vacia, y busqueda/paginacion no estaban implementadas en el backend.

const LIMIT = 15;

export default function TestimoniosPage() {
  const { mensaje, mostrar } = useToast();

  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const esAdmin = dataUser?.rolname === 'administrador';

  const [testimonios, setTestimonios] = useState<TestimonioAdminRow[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [modalAbierto, setModalAbierto] = useState<'crear' | number | null>(null);

  const cargar = useCallback(async (page: number, reemplazar: boolean, search: string) => {
    const setLoader = page === 0 ? setCargando : setCargandoMas;
    setLoader(true);
    const res = await fetchTestimoniosAdmin({ search, page, limit: LIMIT });
    setLoader(false);
    setTestimonios((prev) => {
      const base = reemplazar ? [] : prev;
      const existentes = new Set(base.map((t) => t.id));
      return [...base, ...res.data.filter((t) => !existentes.has(t.id))];
    });
    setNotEmptyPost(res.data.length > 0);
    setPage(page);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      setDataUser(await fetchDataUserCompleto(sessionData.session.user.id));
      setEstado('listo');
      cargar(0, true, '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function eliminar(id: number) {
    if (!window.confirm('Deseas Eliminar Dato')) return;
    const ok = await eliminarTestimonio(id);
    if (!ok) return mostrar('Error de servidor');
    setTestimonios((prev) => prev.filter((t) => t.id !== id));
    mostrar('Eliminado');
  }

  if (estado === 'revisando' || !dataUser) return null;

  return (
    <div className="mx-auto w-full max-w-[1140px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Testimonios</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cargar(0, true, busqueda)}
            placeholder="Buscar Testimonios"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={() => cargar(0, true, busqueda)} disabled={cargando} className="rounded bg-[#0d6efd] px-3 py-2 text-sm text-white disabled:opacity-60">
            Buscar
          </button>
          <button onClick={() => setModalAbierto('crear')} className="flex items-center gap-1 rounded bg-[#198754] px-3 py-2 text-sm font-medium text-white">
            <Plus className="h-4 w-4" /> Nuevo
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
                  <th className="py-2 pr-3">Usuario</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Creado</th>
                </tr>
              </thead>
              <tbody>
                {testimonios.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <div className="flex gap-1">
                        <button onClick={() => setModalAbierto(t.id)} className="rounded bg-[#0d6efd] px-2 py-1 text-xs text-white">
                          <Eye className="h-3 w-3" />
                        </button>
                        <button onClick={() => eliminar(t.id)} className="rounded bg-[#dc3545] px-2 py-1 text-xs text-white">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2 pr-3">{t.usuarioNombre || '—'}</td>
                    <td className="py-2 pr-3">{t.estadoLabel}</td>
                    <td className="py-2 pr-3 text-xs">{new Date(t.fecha).toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!cargando && testimonios.length === 0 && <p className="py-10 text-center text-gray-500">No hay testimonios para mostrar.</p>}
        </div>

        {!cargando && notEmptyPost && testimonios.length > 0 && (
          <div className="mt-4 text-center">
            <button onClick={() => cargar(page + 1, false, busqueda)} disabled={cargandoMas} className="text-sm font-medium text-[#0d6efd] hover:underline disabled:opacity-60">
              {cargandoMas ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        )}
      </div>

      <Toast mensaje={mensaje} />

      {modalAbierto !== null && (
        <FormTestimonioModal
          testimonioId={modalAbierto === 'crear' ? null : modalAbierto}
          usuarioActualId={dataUser.id}
          esAdmin={esAdmin}
          onClose={() => setModalAbierto(null)}
          onGuardado={() => {
            setModalAbierto(null);
            cargar(0, true, busqueda);
          }}
        />
      )}
    </div>
  );
}
