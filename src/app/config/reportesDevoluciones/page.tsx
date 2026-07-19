'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto } from '@/lib/usuarios';
import {
  fetchResumenGlobal,
  fetchMotivosDevolucion,
  fetchRankingVendedores,
  fetchRankingProductos,
  MOTIVO_LABEL,
  type ResumenGlobal,
  type MotivoDevolucionStat,
  type RankingVendedor,
  type RankingProducto,
} from '@/lib/reportesDevoluciones';

// Fase 4 del plan de reduccion de devoluciones (pedido explicito del usuario 2026-07-19): dashboard
// admin -- causas reales de devolucion (Fase 0) + ranking de vendedores/productos con tasa de
// devolucion alta (Fase 1). Mismo patron de auth que /config/admin (solo rolname='administrador').
// Sin libreria de graficos en el proyecto -- barras simples con CSS, no vale la pena la dependencia
// nueva para esto.

function Barra({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(pct * 100))}%`, background: color }} />
    </div>
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default function ReportesDevolucionesPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-autorizado'>('revisando');
  const [resumen, setResumen] = useState<ResumenGlobal | null>(null);
  const [motivos, setMotivos] = useState<MotivoDevolucionStat[]>([]);
  const [rankingVendedores, setRankingVendedores] = useState<RankingVendedor[]>([]);
  const [rankingProductos, setRankingProductos] = useState<RankingProducto[]>([]);

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
      const [r, m, rv, rp] = await Promise.all([fetchResumenGlobal(), fetchMotivosDevolucion(), fetchRankingVendedores(), fetchRankingProductos()]);
      setResumen(r);
      setMotivos(m);
      setRankingVendedores(rv);
      setRankingProductos(rp);
      setEstado('listo');
    });
  }, []);

  if (estado === 'no-autorizado') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-gray-500">Esta sección es solo para administradores.</p>
      </div>
    );
  }

  if (estado === 'revisando' || !resumen) return null;

  const totalMotivos = motivos.reduce((s, m) => s + m.total, 0);

  return (
    <div className="mx-auto w-full max-w-[900px] px-3 py-6">
      <h2 className="text-2xl font-bold text-gray-800">Reportes de Devoluciones</h2>
      <p className="mt-1 text-sm text-gray-500">Fase 0-4 del plan de reducción de devoluciones. Se llena solo a medida que hay pedidos resueltos.</p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-400">Pedidos resueltos</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{resumen.totalOrders.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-400">Devueltos</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{resumen.totalReturns.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-400">Tasa de devolución global</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{pct(resumen.returnRate)}</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800">Causas de devolución</h3>
        {motivos.length === 0 ? (
          <p className="mt-2 text-xs text-gray-400">Todavía no hay devoluciones registradas.</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {motivos.map((m) => (
              <div key={m.motivo}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">{MOTIVO_LABEL[m.motivo] || m.motivo}</span>
                  <span className="text-gray-500">
                    {m.total} ({pct(totalMotivos > 0 ? m.total / totalMotivos : 0)})
                  </span>
                </div>
                <div className="mt-1">
                  <Barra pct={totalMotivos > 0 ? m.total / totalMotivos : 0} color="#dc2626" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800">Vendedores con mayor tasa de devolución</h3>
        <p className="mt-0.5 text-xs text-gray-400">Mínimo 3 pedidos resueltos para aparecer aquí.</p>
        {rankingVendedores.length === 0 ? (
          <p className="mt-2 text-xs text-gray-400">Todavía no hay suficientes pedidos para calcular esto.</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {rankingVendedores.map((v) => (
              <div key={v.sellerId}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">{v.nombre}</span>
                  <span className="text-gray-500">
                    {v.totalReturns}/{v.totalOrders} ({pct(v.returnRate)})
                  </span>
                </div>
                <div className="mt-1">
                  <Barra pct={v.returnRate} color="#f59e0b" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800">Productos con mayor tasa de devolución</h3>
        <p className="mt-0.5 text-xs text-gray-400">Mínimo 3 pedidos resueltos para aparecer aquí.</p>
        {rankingProductos.length === 0 ? (
          <p className="mt-2 text-xs text-gray-400">Todavía no hay suficientes pedidos para calcular esto.</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {rankingProductos.map((p) => (
              <div key={p.productId}>
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate pr-2 font-medium text-gray-700">{p.titulo}</span>
                  <span className="shrink-0 text-gray-500">
                    {p.totalReturns}/{p.totalOrders} ({pct(p.returnRate)})
                  </span>
                </div>
                <div className="mt-1">
                  <Barra pct={p.returnRate} color="#f59e0b" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
