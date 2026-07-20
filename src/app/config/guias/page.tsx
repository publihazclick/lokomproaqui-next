'use client';

import { useEffect, useState } from 'react';
import { Plus, Truck, RefreshCw, PackageX, PackageCheck, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchMisGuias, estadoGuiaLabel, marcarGuiaDevuelta, marcarGuiaEntregada, type GuiaRow } from '@/lib/guias';
import { fechaMedium } from '@/lib/format';
import { useToast, Toast } from '@/components/Toast';
import { GuiaWizard } from '@/components/GuiaWizard';
import { CotizarEnvioModal } from '@/components/CotizarEnvioModal';

// Modulo "Generacion de Guias" (pedido explicito del usuario 2026-07-20): listado de guias sueltas
// generadas por el vendedor (standalone_shipments) + boton para abrir el wizard. Estilo "unicornio"
// nuevo (tarjetas redondeadas), no el port fiel del Angular viejo que usan Ventas/Autorizar Despacho
// -- este modulo no existe en el Angular original, es 100% nuevo.

const ESTADO_ESTILO: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#f1f3f5', color: '#6b7280' },
  quoted: { bg: '#eff6ff', color: '#2563eb' },
  generated: { bg: '#e0f2fe', color: '#0288c2' },
  in_transit: { bg: '#fef3c7', color: '#b45309' },
  delivered: { bg: '#f0fdf4', color: '#16a34a' },
  returned: { bg: '#fef2f2', color: '#dc2626' },
  cancelled: { bg: '#f1f3f5', color: '#6b7280' },
};

export default function GuiasPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [guias, setGuias] = useState<GuiaRow[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarWizard, setMostrarWizard] = useState(false);
  const [mostrarCotizador, setMostrarCotizador] = useState(false);
  const [procesando, setProcesando] = useState<Record<number, boolean>>({});

  async function cargar(userId: string) {
    setCargando(true);
    setGuias(await fetchMisGuias(userId));
    setCargando(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      setEstado('listo');
      cargar(usuario.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function accionMarcar(id: number, tipo: 'devuelta' | 'entregada') {
    if (procesando[id]) return;
    setProcesando((p) => ({ ...p, [id]: true }));
    const ok = tipo === 'devuelta' ? await marcarGuiaDevuelta(id) : await marcarGuiaEntregada(id);
    setProcesando((p) => ({ ...p, [id]: false }));
    if (!ok) {
      mostrar('No pudimos actualizar la guía, intenta de nuevo');
      return;
    }
    mostrar(tipo === 'devuelta' ? 'Guía marcada como devuelta' : 'Guía marcada como entregada');
    if (dataUser) cargar(dataUser.id);
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1000px] px-3 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h4 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Truck className="h-5 w-5" style={{ color: '#0288c2' }} />
            Generación de Guías
          </h4>
          <p className="mt-0.5 text-xs text-gray-500">Cotiza y genera guías de envío para tus propios paquetes, sin necesidad de un pedido.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarCotizador(true)}
            className="flex items-center gap-1.5 rounded-full border-[1.5px] px-4 py-2.5 text-sm font-bold"
            style={{ borderColor: '#02a0e3', color: '#0288c2' }}
          >
            <Search className="h-4 w-4" /> Cotizar Envío
          </button>
          <button
            type="button"
            onClick={() => setMostrarWizard(true)}
            className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-white"
            style={{ background: '#02a0e3', boxShadow: '0 4px 10px rgba(2,160,227,0.3)' }}
          >
            <Plus className="h-4 w-4" /> Nueva Guía
          </button>
        </div>
      </div>

      <div className="mt-4">
        {cargando ? (
          <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
        ) : guias.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#f8fafc' }}>
            <Truck className="mx-auto h-10 w-10" style={{ color: '#93c5fd' }} />
            <p className="mt-3 text-sm font-semibold text-gray-700">Aún no has generado ninguna guía</p>
            <p className="mt-1 text-xs text-gray-500">Toca &quot;Nueva Guía&quot; para cotizar y enviar tu primer paquete.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {guias.map((g) => {
              const estilo = ESTADO_ESTILO[g.estado] || ESTADO_ESTILO.draft;
              return (
                <div key={g.id} className="rounded-2xl border p-3.5" style={{ borderColor: '#e5e7eb' }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-bold text-gray-900">{g.destinatario || 'Sin destinatario'}</p>
                      <p className="m-0 mt-0.5 text-xs text-gray-500">{g.ciudad} · {fechaMedium(g.fecha)}</p>
                      {g.numeroGuia && (
                        <p className="m-0 mt-1 text-xs text-gray-600">
                          Guía <strong>{g.numeroGuia}</strong> · {g.transportadora}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: estilo.bg, color: estilo.color }}>
                      {estadoGuiaLabel(g.estado)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-gray-500">
                      {g.fleteCosto != null && <>Flete: <strong className="text-gray-800">${Math.round(g.fleteCosto).toLocaleString('es-CO')}</strong></>}
                      {g.seguroActivo && <span className="ml-2">🛡️ Asegurada</span>}
                      {g.trackingStatus && <span className="ml-2">· {g.trackingStatus}</span>}
                    </div>
                    {['generated', 'in_transit'].includes(g.estado) && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={procesando[g.id]}
                          onClick={() => accionMarcar(g.id, 'entregada')}
                          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60"
                          style={{ background: '#16a34a' }}
                        >
                          <PackageCheck className="h-3 w-3" /> Entregada
                        </button>
                        <button
                          type="button"
                          disabled={procesando[g.id]}
                          onClick={() => accionMarcar(g.id, 'devuelta')}
                          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60"
                          style={{ background: '#dc2626' }}
                        >
                          <PackageX className="h-3 w-3" /> Devuelta
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!cargando && guias.length > 0 && dataUser && (
        <div className="mt-3 text-center">
          <button onClick={() => cargar(dataUser.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:underline">
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar lista
          </button>
        </div>
      )}

      <Toast mensaje={mensaje} />

      {mostrarWizard && dataUser && (
        <GuiaWizard
          dataUser={dataUser}
          onClose={() => setMostrarWizard(false)}
          onGenerada={() => cargar(dataUser.id)}
        />
      )}

      {mostrarCotizador && dataUser && (
        <CotizarEnvioModal dataUser={dataUser} onClose={() => setMostrarCotizador(false)} />
      )}
    </div>
  );
}
