'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchReferidosNivel, fetchIdsReferidosNivel, fetchTodosLosVendedores, fetchComisionMesActual, type ReferidoRow } from '@/lib/referidos';
import { fetchDataUserCompleto } from '@/lib/usuarios';
import { fechaMedium } from '@/lib/format';

// Port 1:1 (diseno) de ReferidosComponent (Angular, "Referidos"). Verificado el mismo estandar de
// fidelidad que Ventas Posibles/Ventas/Cobros (cero margen de error, tutoriales grabados con esta
// interfaz). Header real de Angular: ['Nombre','lider','E-mail','Telefonos','Nivel','Fecha
// Registro','Activo'] -- se replica exacto, incluida la columna "E-mail" (siempre vacia, el email
// vive en auth.users y nunca fue accesible desde este componente en Angular tampoco) y la columna
// "Activo" (el codigo original tiene `pro_estado == 0 ? 'Activo' : 'Activo'` -- ambas ramas del
// ternario devuelven lo mismo, texto plano SIEMPRE "Activo", nunca "Inactivo" ni con color).
//
// Se mantiene (no se revierte) el arreglo real de seguridad ya hecho en una sesion anterior: en
// Angular, buscar() reemplaza el query completo y pierde el filtro por referente -- cualquier
// usuario logueado veia la lista COMPLETA de la plataforma al buscar. Eso es un bug de datos, no
// de diseno, se sigue corrigiendo aca (ver src/lib/referidos.ts).
const TABS = ['primer nivel', 'segundo nivel', 'tercer nivel', 'cuarto nivel', 'quinto nivel'];
const LIMIT = 20;
// Pedido explicito del usuario 2026-07-19: el rol "lider general" (vendedor normal + esta funcion
// extra, profiles.es_lider_general) tiene una 6ta pestaña que muestra a TODOS los vendedores de la
// plataforma, se hayan registrado con su link o no -- distinto de las 5 pestañas normales, que solo
// muestran la cadena de referidos real (referrer_id).
const TAB_TODOS = 5;
// Sistema de comisiones multinivel (pedido explicito del usuario 2026-07-21): minimo de entregas
// mensuales que activa el pago a un upline (referral_commission_config.min_deliveries_per_month,
// migracion 068) -- se muestra solo como texto informativo, la validacion real vive en el RPC
// pay_referral_commissions del lado del servidor.
const MIN_ENTREGAS_MES = 2;

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
  const [esLiderGeneral, setEsLiderGeneral] = useState(false);
  const [tabs, setTabs] = useState<TabState[]>(() => Array.from({ length: 6 }, tabVacio));
  const [activeTab, setActiveTab] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [comisionMes, setComisionMes] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const uid = sessionData.session.user.id;
      setDataUserId(uid);
      const usuario = await fetchDataUserCompleto(uid);
      setEsLiderGeneral(usuario.esLiderGeneral);
      setEstado('listo');
      fetchComisionMesActual(uid).then(setComisionMes);
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
    // Pestaña "todos los vendedores" (solo lider general) -- fuente de datos distinta, sin cadena
    // de referidos de por medio.
    if (tabIndex === TAB_TODOS) {
      const setLoader = page === 0 ? setCargando : setCargandoMas;
      setLoader(true);
      const res = await fetchTodosLosVendedores({ page, limit: LIMIT, search });
      setLoader(false);
      setTabs((prev) => {
        const next = [...prev];
        const base = reemplazar ? [] : next[tabIndex].dataRows;
        const existentes = new Set(base.map((r) => r.id));
        next[tabIndex] = {
          dataRows: [...base, ...res.data.filter((r) => !existentes.has(r.id))],
          idsCompletos: [],
          page,
          notEmptyPost: res.data.length > 0,
          cargado: true,
        };
        return next;
      });
      return;
    }

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
      <div className="border-b border-gray-200 pb-3">
        <h4 className="text-lg font-bold text-gray-900">Referidos</h4>
      </div>

      {/* Sistema de comisiones multinivel (pedido explicito del usuario 2026-07-21): comision
          acreditada este mes por las entregas de toda tu cadena de referidos, hasta 5 niveles. */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Comisión generada este mes</p>
        <p className="m-0 mt-1 text-2xl font-extrabold text-gray-900">
          {comisionMes === null ? '—' : `$ ${comisionMes.toLocaleString('es-CO')}`}
        </p>
        <p className="m-0 mt-1 text-xs text-gray-500">
          Se paga por cada pedido entregado en tu cadena (hasta 5 niveles), siempre que la persona que vendió tenga mínimo {MIN_ENTREGAS_MES} entregas exitosas ese mes.
        </p>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => cambiarTab(idx)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-semibold ${
              activeTab === idx ? 'border-b-2 border-[#0066FF] text-[#0066FF]' : 'text-gray-500'
            }`}
          >
            Referidos {label}
          </button>
        ))}
        {esLiderGeneral && (
          <button
            type="button"
            onClick={() => cambiarTab(TAB_TODOS)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-semibold ${
              activeTab === TAB_TODOS ? 'border-b-2 border-[#0066FF] text-[#0066FF]' : 'text-gray-500'
            }`}
          >
            Todos los vendedores
          </button>
        )}
      </div>

      <div className="mt-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          placeholder="Buscar Referidos"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-2">
        <button type="button" onClick={buscar} disabled={cargando} className="rounded bg-[#0066FF] p-3 text-white disabled:opacity-60">
          <Search className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {cargando ? (
          <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm font-bold text-gray-900">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">lider</th>
                <th className="py-2 pr-3">E-mail</th>
                <th className="py-2 pr-3">Telefonos</th>
                <th className="py-2 pr-3">Nivel</th>
                <th className="py-2 pr-3">Fecha Registro</th>
                <th className="py-2 pr-3">Activo</th>
                <th className="py-2 pr-3">Entregas este mes</th>
              </tr>
            </thead>
            <tbody>
              {tabActual.dataRows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="py-3 pr-3 align-top">{row.nombre}</td>
                  <td className="py-3 pr-3 align-top">{row.liderNombre}</td>
                  <td className="py-3 pr-3 align-top"></td>
                  <td className="py-3 pr-3 align-top">{row.telefono}</td>
                  <td className="py-3 pr-3 align-top">{row.nivelVendedor}</td>
                  <td className="py-3 pr-3 align-top">{fechaMedium(row.fechaRegistro)}</td>
                  <td className="py-3 pr-3 align-top">Activo</td>
                  <td className="py-3 pr-3 align-top">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={
                        row.entregasMes >= MIN_ENTREGAS_MES
                          ? { background: '#f0fdf4', color: '#16a34a' }
                          : { background: '#fef2f2', color: '#dc2626' }
                      }
                    >
                      {row.entregasMes} / {MIN_ENTREGAS_MES}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!cargando && tabActual.dataRows.length === 0 && (
          <p className="py-10 text-center text-gray-500">{activeTab === TAB_TODOS ? 'No hay vendedores registrados.' : 'No hay referidos en este nivel.'}</p>
        )}
      </div>

      {!cargando && tabActual.notEmptyPost && tabActual.dataRows.length > 0 && (
        <div className="mt-4 text-center">
          <button onClick={verMas} disabled={cargandoMas} className="text-sm font-medium text-[#0066FF] hover:underline disabled:opacity-60">
            {cargandoMas ? 'Cargando…' : 'Ver más'}
          </button>
        </div>
      )}
    </div>
  );
}
