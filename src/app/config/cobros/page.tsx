'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchRetiros, fetchSaldoDisponible, fetchTotalPagado, eliminarRetiro, type RetiroRow } from '@/lib/cobros';
import { FormCobroModal } from '@/components/FormCobroModal';
import { useToast, Toast } from '@/components/Toast';

// Port de CobrosComponent (Angular, "Cobrar") -- retiro de saldo de la billetera de referidos.
// Ver src/lib/cobros.ts para el detalle completo de los bugs reales encontrados y corregidos
// (filtro de estado por defecto que ocultaba TODOS los retiros, busqueda ignorada, columna de
// email del vendedor siempre vacia, y 6 de 7 tarjetas de resumen que siempre mostraban $0).

const LIMIT = 15;

export default function CobrosPage() {
  const { mensaje, mostrar } = useToast();

  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const esAdmin = dataUser?.rolname === 'administrador';

  const [saldo, setSaldo] = useState(0);
  const [totalPagado, setTotalPagado] = useState(0);
  const [retiros, setRetiros] = useState<RetiroRow[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [modalAbierto, setModalAbierto] = useState<'crear' | RetiroRow | null>(null);

  const cargar = useCallback(async (uid: string, admin: boolean, page: number, reemplazar: boolean, search: string) => {
    const setLoader = page === 0 ? setCargando : setCargandoMas;
    setLoader(true);
    const res = await fetchRetiros({ userId: admin ? undefined : uid, search, page, limit: LIMIT });
    setLoader(false);
    setRetiros((prev) => {
      const base = reemplazar ? [] : prev;
      const existentes = new Set(base.map((r) => r.id));
      return [...base, ...res.data.filter((r) => !existentes.has(r.id))];
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
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      const admin = usuario.rolname === 'administrador';
      setEstado('listo');
      const [s, tp] = await Promise.all([fetchSaldoDisponible(usuario.id), fetchTotalPagado(usuario.id, admin)]);
      setSaldo(s);
      setTotalPagado(tp);
      cargar(usuario.id, admin, 0, true, '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar() {
    if (!dataUser) return;
    cargar(dataUser.id, esAdmin, 0, true, busqueda);
  }

  function recargarTodo() {
    if (!dataUser) return;
    cargar(dataUser.id, esAdmin, 0, true, busqueda);
    fetchSaldoDisponible(dataUser.id).then(setSaldo);
    fetchTotalPagado(dataUser.id, esAdmin).then(setTotalPagado);
    setModalAbierto(null);
  }

  async function eliminar(id: number) {
    if (!window.confirm('Deseas Eliminar Dato')) return;
    const ok = await eliminarRetiro(id);
    if (!ok) return mostrar('Error de servidor');
    setRetiros((prev) => prev.filter((r) => r.id !== id));
    mostrar('Eliminado');
  }

  if (estado === 'revisando' || !dataUser) return null;

  return (
    <div className="mx-auto w-full max-w-[1140px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Cobrar</h4>
        <div className="mt-2 flex flex-wrap gap-6">
          <div>
            <span className="text-xs opacity-80">Por Cobrar</span>
            <p className="text-lg font-bold">$ {saldo.toLocaleString('es-CO')} COP</p>
          </div>
          <div>
            <span className="text-xs opacity-80">Total Pagado</span>
            <p className="text-lg font-bold">$ {totalPagado.toLocaleString('es-CO')} COP</p>
          </div>
        </div>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Buscar Retiros (cédula, celular, cuenta, método)"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={buscar} disabled={cargando} className="rounded bg-[#0d6efd] px-3 py-2 text-sm text-white disabled:opacity-60">
            Buscar
          </button>
          <button onClick={() => setModalAbierto('crear')} className="flex items-center gap-1 rounded bg-[#198754] px-3 py-2 text-sm font-medium text-white">
            <Plus className="h-4 w-4" /> Solicitar retiro
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          {cargando ? (
            <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-3">Acciones</th>
                  <th className="py-2 pr-3">Monto</th>
                  <th className="py-2 pr-3">Método</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Fecha</th>
                  {esAdmin && <th className="py-2 pr-3">Vendedor</th>}
                  <th className="py-2 pr-3">Cédula</th>
                  <th className="py-2 pr-3">Celular</th>
                  <th className="py-2 pr-3">Cuenta</th>
                </tr>
              </thead>
              <tbody>
                {retiros.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <div className="flex gap-1">
                        <button onClick={() => setModalAbierto(r)} className="flex items-center gap-1 rounded bg-[#0d6efd] px-2 py-1 text-xs text-white">
                          <Eye className="h-3 w-3" /> Ver
                        </button>
                        {esAdmin && (
                          <button onClick={() => eliminar(r.id)} className="flex items-center gap-1 rounded bg-[#dc3545] px-2 py-1 text-xs text-white">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3">$ {r.monto.toLocaleString('es-CO')} COP</td>
                    <td className="py-2 pr-3">{r.metodo}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.estado === 1 ? 'bg-blue-100 text-blue-700' : r.estado === 2 ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {r.estadoLabel}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{new Date(r.fecha).toLocaleString('es-CO')}</td>
                    {esAdmin && <td className="py-2 pr-3">{r.vendedorNombre || '—'}</td>}
                    <td className="py-2 pr-3">{r.cedula}</td>
                    <td className="py-2 pr-3">{r.celular}</td>
                    <td className="py-2 pr-3">{r.cuenta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!cargando && retiros.length === 0 && <p className="py-10 text-center text-gray-500">No hay retiros para mostrar.</p>}
        </div>

        {!cargando && notEmptyPost && retiros.length > 0 && (
          <div className="mt-4 text-center">
            <button onClick={() => cargar(dataUser.id, esAdmin, page + 1, false, busqueda)} disabled={cargandoMas} className="text-sm font-medium text-[#0d6efd] hover:underline disabled:opacity-60">
              {cargandoMas ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        )}
      </div>

      <Toast mensaje={mensaje} />

      {modalAbierto && (
        <FormCobroModal
          userId={dataUser.id}
          saldoDisponible={saldo}
          retiroExistente={modalAbierto === 'crear' ? undefined : modalAbierto}
          esAdmin={esAdmin}
          onClose={() => setModalAbierto(null)}
          onGuardado={recargarTodo}
        />
      )}
    </div>
  );
}
