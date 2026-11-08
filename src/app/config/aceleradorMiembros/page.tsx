'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto } from '@/lib/usuarios';
import { fetchMiembrosAcelerador, fetchSeguridadMiembro, bloquearMiembro, reiniciarAparatosMiembro, type MiembroAcelerador, type SeguridadMiembro } from '@/lib/acelerador';
import { fechaMedium } from '@/lib/format';

// Pedido explicito del usuario 2026-07-19: apartado exclusivo para el rol "lider general" (y
// administradores) -- lista SOLO a quienes ya pagaron el curso Acelerador al menos una vez
// (acelerador_subscriptions), separados en Activos/Vencidos para hacer seguimiento personalizado.
// Distinto de /config/referidos, que muestra vendedores en general sin importar si pagaron el curso.
// 08-11-2026: boton Seguridad por miembro -- aparatos registrados, ciudades de los ultimos 30 dias,
// bloquear/desbloquear el acceso y reiniciar aparatos (curso-anticompartir.sql).
const TABS: { key: 'todos' | 'activos' | 'vencidos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'activos', label: 'Activos' },
  { key: 'vencidos', label: 'Vencidos' },
];
const LIMIT = 20;

export default function AceleradorMiembrosPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-autorizado'>('revisando');
  const [tab, setTab] = useState<'todos' | 'activos' | 'vencidos'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [miembros, setMiembros] = useState<MiembroAcelerador[]>([]);
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [seguridad, setSeguridad] = useState<{ miembro: MiembroAcelerador; datos: SeguridadMiembro | null } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function abrirSeguridad(m: MiembroAcelerador) {
    setSeguridad({ miembro: m, datos: null });
    setSeguridad({ miembro: m, datos: await fetchSeguridadMiembro(m.profileId) });
  }

  async function accionSeguridad(fn: () => Promise<boolean>) {
    if (!seguridad) return;
    setOcupado(true);
    await fn();
    setSeguridad({ miembro: seguridad.miembro, datos: await fetchSeguridadMiembro(seguridad.miembro.profileId) });
    setOcupado(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      if (!usuario.esLiderGeneral && usuario.rolname !== 'administrador') {
        setEstado('no-autorizado');
        return;
      }
      setEstado('listo');
      cargar(tab, 0, true, '');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, []);

  async function cargar(tabActual: 'todos' | 'activos' | 'vencidos', pageActual: number, reemplazar: boolean, search: string) {
    const setLoader = pageActual === 0 ? setCargando : setCargandoMas;
    setLoader(true);
    const res = await fetchMiembrosAcelerador({
      page: pageActual,
      limit: LIMIT,
      search,
      soloActivos: tabActual === 'activos',
      soloVencidos: tabActual === 'vencidos',
    });
    setLoader(false);
    setMiembros((prev) => {
      const base = reemplazar ? [] : prev;
      const existentes = new Set(base.map((m) => m.profileId));
      return [...base, ...res.data.filter((m) => !existentes.has(m.profileId))];
    });
    setNotEmptyPost(res.data.length > 0);
    setPage(pageActual);
  }

  function cambiarTab(nuevo: 'todos' | 'activos' | 'vencidos') {
    setTab(nuevo);
    setBusqueda('');
    cargar(nuevo, 0, true, '');
  }

  function buscar() {
    cargar(tab, 0, true, busqueda);
  }

  function verMas() {
    cargar(tab, page + 1, false, busqueda);
  }

  function contactar(telefono: string | null) {
    const numero = (telefono || '').replace(/\D/g, '');
    if (!numero) return;
    window.open(`https://wa.me/57${numero}`, '_blank');
  }

  if (estado === 'no-autorizado') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-gray-500">Esta sección es solo para administradores y líder general.</p>
      </div>
    );
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1000px] px-3 py-6">
      <div className="border-b border-gray-200 pb-3">
        <h4 className="text-lg font-bold text-gray-900">Miembros Acelerador</h4>
        <p className="mt-1 text-xs text-gray-500">Solo usuarios que ya pagaron el curso al menos una vez.</p>
      </div>

      <div className="mt-4 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => cambiarTab(t.key)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-semibold ${
              tab === t.key ? 'border-b-2 border-[#0066FF] text-[#0066FF]' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          placeholder="Buscar por nombre o teléfono"
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
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm font-bold text-gray-900">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Teléfono</th>
                <th className="py-2 pr-3">Ciudad</th>
                <th className="py-2 pr-3">Vencimiento</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((m) => (
                <tr key={m.profileId} className="border-b border-gray-100">
                  <td className="py-3 pr-3 align-top">{m.nombre}</td>
                  <td className="py-3 pr-3 align-top">{m.telefono}</td>
                  <td className="py-3 pr-3 align-top">{m.ciudad}</td>
                  <td className="py-3 pr-3 align-top">{fechaMedium(m.vencimiento)}</td>
                  <td className="py-3 pr-3 align-top">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {m.activo ? 'Activo' : 'Vencido'}
                    </span>
                  </td>
                  <td className="py-3 pr-3 align-top">
                    <button
                      type="button"
                      onClick={() => contactar(m.telefono)}
                      className="rounded bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white"
                    >
                      Contactar
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirSeguridad(m)}
                      className="ml-2 rounded bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-white"
                    >
                      Seguridad
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!cargando && miembros.length === 0 && <p className="py-10 text-center text-gray-500">No hay miembros para mostrar.</p>}
      </div>

      {!cargando && notEmptyPost && miembros.length > 0 && (
        <div className="mt-4 text-center">
          <button onClick={verMas} disabled={cargandoMas} className="text-sm font-medium text-[#0066FF] hover:underline disabled:opacity-60">
            {cargandoMas ? 'Cargando…' : 'Ver más'}
          </button>
        </div>
      )}
      {seguridad && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3" onClick={() => setSeguridad(null)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-base font-bold text-gray-900">Seguridad del curso</h4>
            <p className="text-sm text-gray-600">{seguridad.miembro.nombre} · {seguridad.miembro.telefono}</p>
            {!seguridad.datos ? (
              <p className="py-6 text-center text-sm text-gray-500">Cargando…</p>
            ) : (
              <>
                <p className={`mt-3 rounded px-3 py-2 text-sm font-semibold ${seguridad.datos.bloqueado ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {seguridad.datos.bloqueado ? 'Acceso BLOQUEADO' : 'Acceso activo'}
                </p>
                <p className="mt-4 text-sm font-semibold text-gray-800">Aparatos registrados ({seguridad.datos.aparatos.length} de 2)</p>
                {seguridad.datos.aparatos.length === 0 && <p className="text-xs text-gray-500">Ninguno todavía.</p>}
                {seguridad.datos.aparatos.map((a, i) => (
                  <p key={i} className="text-xs text-gray-600">• {a.nombre || 'Aparato'} — desde {fechaMedium(a.creado)}, último uso {fechaMedium(a.ultimo_uso)}</p>
                ))}
                <p className="mt-4 text-sm font-semibold text-gray-800">Ciudades desde donde vio clases (30 días)</p>
                {seguridad.datos.ciudades.length === 0 && <p className="text-xs text-gray-500">Ninguna todavía.</p>}
                {seguridad.datos.ciudades.map((c, i) => (
                  <p key={i} className="text-xs text-gray-600">• {c.ciudad} — {c.veces} vez(ces), última {fechaMedium(c.ultima)}</p>
                ))}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    disabled={ocupado}
                    onClick={() => accionSeguridad(() => bloquearMiembro(seguridad.miembro.profileId, !seguridad.datos!.bloqueado))}
                    className={`rounded px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 ${seguridad.datos.bloqueado ? 'bg-green-600' : 'bg-red-600'}`}
                  >
                    {seguridad.datos.bloqueado ? 'Desbloquear acceso' : 'Bloquear acceso'}
                  </button>
                  <button
                    disabled={ocupado}
                    onClick={() => accionSeguridad(() => reiniciarAparatosMiembro(seguridad.miembro.profileId))}
                    className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-60"
                  >
                    Reiniciar aparatos
                  </button>
                  <button onClick={() => setSeguridad(null)} className="ml-auto rounded px-3 py-2 text-xs text-gray-500">Cerrar</button>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">Reiniciar aparatos: borra sus 2 aparatos; la próxima vez confirma con código por WhatsApp.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
