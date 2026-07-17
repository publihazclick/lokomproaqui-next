'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Plus, Eye, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchRetiros, fetchSaldoDisponible, fetchTotalPagado, eliminarRetiro, type RetiroRow } from '@/lib/cobros';
import { fechaMedium } from '@/lib/format';
import { FormCobroModal } from '@/components/FormCobroModal';
import { useToast, Toast } from '@/components/Toast';

// Port 1:1 (diseno) de CobrosComponent (Angular, "Cobrar"). Mismo criterio que Ventas Posibles y
// Ventas: cero margen de error, replicar exacto lo que muestra Angular real, no una version
// simplificada. Ver src/lib/cobros.ts para los bugs reales de datos ya corregidos antes (filtro
// que ocultaba todos los retiros, busqueda ignorada).
//
// Las 8 cajas de resumen del header son reales en Angular (dataInfo.*), pero el backend real
// (UsuariosService.getInfo()) SOLO llena "Por Cobrar" -- las otras 7 siempre mostraban $0, ya
// documentado en una sesion anterior. Se mantienen las 8 cajas en el mismo orden/nombres exactos
// de Angular; "Por Cobrar" y "Total Pagado" usan datos reales (ya se habian arreglado antes),
// las otras 6 quedan en $0 igual que el original -- no existe cálculo real detrás para inventarlas.
//
// "Pais" y "Email" de la tabla quedan siempre vacios -- no existe columna de pais en
// withdrawal_requests, y el email vive en auth.users (no accesible desde el cliente), mismo bug
// real que en Angular (columna vendedor siempre vacia, ya documentado antes).
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
    if (!window.confirm('¿Deseas Eliminar Dato?')) return;
    const ok = await eliminarRetiro(id);
    if (!ok) return mostrar('Error de servidor');
    setRetiros((prev) => prev.filter((r) => r.id !== id));
    mostrar('Eliminado');
  }

  if (estado === 'revisando' || !dataUser) return null;

  const cero = '$ 0 COP';
  const cajas: { label: string; valor: string }[] = [
    { label: 'Total Ganado', valor: cero },
    { label: 'Total Cobrado', valor: cero },
    { label: 'Total Pagado', valor: `$ ${totalPagado.toLocaleString('es-CO')} COP` },
    { label: 'Por Cobrar', valor: `$ ${saldo.toLocaleString('es-CO')} COP` },
    { label: 'Devoluciones', valor: cero },
    { label: 'Ventas Pendientes Por Entregar', valor: cero },
    { label: 'Ventas Totales del calzado (Exitoso)', valor: cero },
    { label: 'Ventas Totales del calzado ( Despachado )', valor: cero },
  ];

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <div className="border-b border-gray-200 pb-4">
        <h4 className="text-lg font-bold text-gray-900">Cobrar</h4>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cajas.map((c) => (
            <div key={c.label}>
              <span className="block text-xs text-gray-500">{c.label}</span>
              <p className="text-sm font-semibold text-gray-900">{c.valor}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          placeholder="Buscar Retiros"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-2 flex items-start gap-2">
        <button type="button" onClick={buscar} disabled={cargando} className="rounded bg-[#0066FF] p-3 text-white disabled:opacity-60">
          <Search className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => setModalAbierto('crear')} title="Solicitar retiro" className="rounded bg-[#0066FF] p-3 text-white">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {cargando ? (
          <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
        ) : (
          <table className="w-full min-w-[1200px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm font-bold text-gray-900">
                <th className="py-2 pr-3">Acciones</th>
                <th className="py-2 pr-3">Monto</th>
                <th className="py-2 pr-3">Método de pago</th>
                <th className="py-2 pr-3">Pais</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Fecha Cobro</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Cédula</th>
                <th className="py-2 pr-3">Celular</th>
                <th className="py-2 pr-3">Cuenta Bancaria</th>
                <th className="py-2 pr-3">Fecha Pago</th>
              </tr>
            </thead>
            <tbody>
              {retiros.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-3 pr-3 align-top">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setModalAbierto(r)} className="rounded bg-[#0066FF] p-2.5 text-white">
                        <Eye className="h-5 w-5" />
                      </button>
                      {esAdmin && (
                        <button type="button" onClick={() => eliminar(r.id)} className="rounded bg-[#FF3B30] p-2.5 text-white">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3 align-top">$ {r.monto.toLocaleString('es-CO')} COP</td>
                  <td className="py-3 pr-3 align-top">{r.metodo}</td>
                  <td className="py-3 pr-3 align-top"></td>
                  <td className="py-3 pr-3 align-top">
                    <span className={r.estado === 0 ? 'text-[#FF3B30]' : r.estado === 1 ? 'text-[#0066FF]' : 'text-gray-500'}>{r.estadoLabel}</span>
                  </td>
                  <td className="py-3 pr-3 align-top">{fechaMedium(r.fecha)}</td>
                  <td className="py-3 pr-3 align-top"></td>
                  <td className="py-3 pr-3 align-top">{r.cedula}</td>
                  <td className="py-3 pr-3 align-top">{r.celular}</td>
                  <td className="py-3 pr-3 align-top">{r.cuenta}</td>
                  <td className="py-3 pr-3 align-top">{fechaMedium(r.fechaPago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!cargando && retiros.length === 0 && <p className="py-10 text-center text-gray-500">No hay retiros para mostrar.</p>}
      </div>

      {!cargando && notEmptyPost && retiros.length > 0 && (
        <div className="mt-4 text-center">
          <button onClick={() => cargar(dataUser.id, esAdmin, page + 1, false, busqueda)} disabled={cargandoMas} className="text-sm font-medium text-[#0066FF] hover:underline disabled:opacity-60">
            {cargandoMas ? 'Cargando…' : 'Ver más'}
          </button>
        </div>
      )}

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
