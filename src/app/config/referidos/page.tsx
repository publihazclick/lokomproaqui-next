'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchReferidosNivel, fetchIdsReferidosNivel, type ReferidoRow } from '@/lib/referidos';

// Port desde src/app/dashboard-config/components/referidos (Angular, ReferidosComponent) --
// "Mis Referidos", arbol de 5 niveles de downline.
//
// Corrige un bug real de exposicion de datos (ver src/lib/referidos.ts para el detalle completo):
// UsuariosService.get() nunca soporto el filtro por referente, asi que HOY en produccion cualquier
// usuario logueado ve la lista COMPLETA de usuarios de la plataforma en las 5 pestañas, no solo su
// propio equipo. Se corrige aca en vez de portarse tal cual, mismo criterio que /config/perfil.

const TABS = ['Primer nivel', 'Segundo nivel', 'Tercer nivel', 'Cuarto nivel', 'Quinto nivel'];
const LIMIT = 20;

interface TabState {
  dataRows: ReferidoRow[];
  idsCompletos: string[]; // TODOS los ids de este nivel (sin paginar), para encadenar el siguiente
  page: number;
  notEmptyPost: boolean;
  cargado: boolean;
}

function tabVacio(): TabState {
  return { dataRows: [], idsCompletos: [], page: 0, notEmptyPost: true, cargado: false };
}

export default function ReferidosPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUserId, setDataUserId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<TabState[]>(() => Array.from({ length: 5 }, tabVacio));
  const [activeTab, setActiveTab] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      setDataUserId(sessionData.session.user.id);
      setEstado('listo');
    });
  }, []);

  useEffect(() => {
    if (estado === 'listo' && dataUserId && !tabs[0].cargado) {
      cargarTab(0, 0, true, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, dataUserId]);

  function referrerIdsPara(tabIndex: number, snapshot: TabState[]): string[] {
    if (tabIndex === 0) return dataUserId ? [dataUserId] : [];
    return snapshot[tabIndex - 1].idsCompletos;
  }

  async function cargarTab(tabIndex: number, page: number, reemplazar: boolean, search: string) {
    const referrerIds = referrerIdsPara(tabIndex, tabs);
    if (!referrerIds.length) {
      setTabs((prev) => {
        const next = [...prev];
        next[tabIndex] = { ...next[tabIndex], dataRows: [], notEmptyPost: false, cargado: true };
        return next;
      });
      return;
    }
    const setLoader = page === 0 ? setCargando : setCargandoMas;
    setLoader(true);
    const [res, idsCompletos] = await Promise.all([
      fetchReferidosNivel(referrerIds, { page, limit: LIMIT, search }),
      reemplazar ? fetchIdsReferidosNivel(referrerIds) : Promise.resolve(null),
    ]);
    setLoader(false);
    setTabs((prev) => {
      const next = [...prev];
      const base = reemplazar ? [] : next[tabIndex].dataRows;
      const existentes = new Set(base.map((r) => r.id));
      next[tabIndex] = {
        dataRows: [...base, ...res.data.filter((r) => !existentes.has(r.id))],
        idsCompletos: idsCompletos ?? next[tabIndex].idsCompletos,
        page,
        notEmptyPost: res.data.length > 0,
        cargado: true,
      };
      return next;
    });
  }

  function cambiarTab(idx: number) {
    setActiveTab(idx);
    setBusqueda('');
    if (!tabs[idx].cargado) cargarTab(idx, 0, true, '');
  }

  function buscar() {
    cargarTab(activeTab, 0, true, busqueda);
  }

  function verMas() {
    const t = tabs[activeTab];
    cargarTab(activeTab, t.page + 1, false, busqueda);
  }

  if (estado === 'revisando') return null;

  const tabActual = tabs[activeTab];

  return (
    <div className="mx-auto w-full max-w-[1140px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Referidos</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((label, idx) => (
            <button
              key={label}
              onClick={() => cambiarTab(idx)}
              className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-semibold ${
                activeTab === idx ? 'border-b-2 border-[#0d6efd] text-[#0d6efd]' : 'text-gray-500'
              }`}
            >
              Referidos {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Buscar Referidos"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={buscar} disabled={cargando} className="flex items-center gap-1 rounded bg-[#0d6efd] px-3 py-2 text-sm text-white disabled:opacity-60">
            <Search className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          {cargando ? (
            <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Líder</th>
                  <th className="py-2 pr-3">Teléfono</th>
                  <th className="py-2 pr-3">Ciudad</th>
                  <th className="py-2 pr-3">Categoría</th>
                  <th className="py-2 pr-3">Fecha Registro</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tabActual.dataRows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3">{row.nombre}</td>
                    <td className="py-2 pr-3">{row.liderNombre || '—'}</td>
                    <td className="py-2 pr-3">{row.telefono || '—'}</td>
                    <td className="py-2 pr-3">{row.ciudad || '—'}</td>
                    <td className="py-2 pr-3">{row.nivelVendedor || '—'}</td>
                    <td className="py-2 pr-3">{new Date(row.fechaRegistro).toLocaleDateString('es-CO')}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {row.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!cargando && tabActual.dataRows.length === 0 && <p className="py-10 text-center text-gray-500">No hay referidos en este nivel.</p>}
        </div>

        {!cargando && tabActual.notEmptyPost && tabActual.dataRows.length > 0 && (
          <div className="mt-4 text-center">
            <button onClick={verMas} disabled={cargandoMas} className="text-sm font-medium text-[#0d6efd] hover:underline disabled:opacity-60">
              {cargandoMas ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
