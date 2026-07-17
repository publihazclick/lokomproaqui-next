'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto } from '@/lib/usuarios';
import { fetchTiposTallaAdmin, desactivarTipoTalla, type TipoTallaRow } from '@/lib/tiposTallaAdmin';
import { FormTipoTallaModal } from '@/components/FormTipoTallaModal';
import { useToast, Toast } from '@/components/Toast';

// Port de ListSizeComponent (Angular, panel admin "Tipo de Tallas"). Ver
// src/lib/tiposTallaAdmin.ts para el bug real corregido y por que "listaPlatform" no se porta
// (PlatformService es un no-op documentado desde la migracion a Mipaquete).
//
// Bug real de seguridad encontrado y corregido: sin chequeo de rol. Se agrega el mismo chequeo de
// /config/usuarios.

export default function ListaTallaPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-autorizado'>('revisando');
  const [tipos, setTipos] = useState<TipoTallaRow[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState<'crear' | number | null>(null);

  const cargar = useCallback(async (search: string) => {
    setCargando(true);
    setTipos(await fetchTiposTallaAdmin(search));
    setCargando(false);
  }, []);

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
      setEstado('listo');
      cargar('');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function eliminar(id: number) {
    const ok = await desactivarTipoTalla(id);
    if (!ok) return mostrar('Error de servidor');
    setTipos((prev) => prev.filter((t) => t.id !== id));
    mostrar('Eliminado');
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
    <div className="mx-auto w-full max-w-[900px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Tipo de Tallas</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex min-w-0 flex-1 gap-2">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && cargar(busqueda)}
              placeholder="Buscar"
              className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button onClick={() => cargar(busqueda)} disabled={cargando} className="shrink-0 rounded bg-[#0d6efd] px-3 py-2 text-sm text-white disabled:opacity-60">
              Buscar
            </button>
          </div>
          <button onClick={() => setModalAbierto('crear')} className="flex shrink-0 items-center justify-center gap-1 rounded bg-[#198754] px-3 py-2 text-sm font-medium text-white">
            <Plus className="h-4 w-4" /> Nuevo
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          {cargando ? (
            <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
          ) : (
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-3">Acciones</th>
                  <th className="py-2 pr-3">Tipo de Talla</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((t) => (
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
                    <td className="py-2 pr-3">{t.nombre}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {t.activo ? 'Activo' : 'Eliminado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!cargando && tipos.length === 0 && <p className="py-10 text-center text-gray-500">No hay tipos de talla para mostrar.</p>}
        </div>
      </div>

      <Toast mensaje={mensaje} />

      {modalAbierto !== null && (
        <FormTipoTallaModal
          tipoTallaId={modalAbierto === 'crear' ? null : modalAbierto}
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
