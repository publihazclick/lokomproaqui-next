'use client';

import { useEffect, useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { TableProductosPanel } from '@/components/TableProductosPanel';
import { FormProductoModal } from '@/components/FormProductoModal';
import type { ModoListaProductos } from '@/lib/productosAdmin';
import { fetchEstadoProveedor, enviarProveedorARevision, MINIMO_PRODUCTOS_PROVEEDOR, type EstadoProveedor } from '@/lib/proveedorEstado';
import { PickupAddressCard } from '@/components/PickupAddressCard';
import { useToast, Toast } from '@/components/Toast';

// Port de ProductosComponent (Angular, panel admin "Productos", la pieza mas grande de Fase 5).
// 3 pestañas -> TableProductosPanel compartido, igual que el original con app-table-product.
// Ver src/lib/productosAdmin.ts y src/components/FormProductoModal.tsx para el detalle completo
// de los bugs reales corregidos y las simplificaciones documentadas.

const ESTADO_PROVEEDOR_ESTILO: Record<string, { bg: string; border: string; color: string }> = {
  incompleto: { bg: '#f8fafc', border: '#e5e7eb', color: '#374151' },
  en_revision: { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
  aprobado: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
  rechazado: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
};

export default function ProductosPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [tab, setTab] = useState<ModoListaProductos>('mios');
  const [modalId, setModalId] = useState<number | null | 'crear'>(null);
  const [refrescarKey, setRefrescarKey] = useState(0);
  const [estadoProveedor, setEstadoProveedor] = useState<EstadoProveedor | null>(null);
  const [enviando, setEnviando] = useState(false);

  const esAdmin = dataUser?.rolname === 'administrador';
  const esProveedor = dataUser?.rolname === 'proveedor';

  async function cargarEstadoProveedor(userId: string) {
    setEstadoProveedor(await fetchEstadoProveedor(userId));
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      setTab(usuario.rolname === 'administrador' ? 'otros' : 'mios');
      if (usuario.rolname === 'proveedor') await cargarEstadoProveedor(usuario.id);
      setEstado('listo');
    });
  }, []);

  async function enviarARevision() {
    if (!dataUser || enviando) return;
    setEnviando(true);
    const res = await enviarProveedorARevision(dataUser.id);
    setEnviando(false);
    if (!res.ok) {
      mostrar(res.message || 'No pudimos enviar tu cuenta a revisión');
      return;
    }
    mostrar('¡Listo! Tu cuenta quedó en revisión, te avisamos apenas la aprueben.');
    await cargarEstadoProveedor(dataUser.id);
  }

  if (estado === 'revisando' || !dataUser) return null;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      {esProveedor && <PickupAddressCard profileId={dataUser.id} />}

      {esProveedor && estadoProveedor && (
        <div
          className="mb-3 rounded-2xl border p-4"
          style={{ background: ESTADO_PROVEEDOR_ESTILO[estadoProveedor.status].bg, borderColor: ESTADO_PROVEEDOR_ESTILO[estadoProveedor.status].border }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: ESTADO_PROVEEDOR_ESTILO[estadoProveedor.status].color }} />
              <div>
                <p className="m-0 text-sm font-bold" style={{ color: ESTADO_PROVEEDOR_ESTILO[estadoProveedor.status].color }}>
                  {estadoProveedor.status === 'incompleto' && 'Completa tu perfil de proveedor para aparecer en Explorar Bodegas'}
                  {estadoProveedor.status === 'en_revision' && 'Tu cuenta está en revisión'}
                  {estadoProveedor.status === 'aprobado' && '¡Tu cuenta está aprobada!'}
                  {estadoProveedor.status === 'rechazado' && 'Tu cuenta fue rechazada'}
                </p>
                <p className="m-0 mt-1 text-xs leading-relaxed" style={{ color: ESTADO_PROVEEDOR_ESTILO[estadoProveedor.status].color }}>
                  {estadoProveedor.status === 'incompleto' &&
                    `Sube mínimo ${MINIMO_PRODUCTOS_PROVEEDOR} referencias de producto (llevas ${estadoProveedor.productCount}/${MINIMO_PRODUCTOS_PROVEEDOR}) y envíalas a revisión. Nuestro equipo de proveedores las revisa y, una vez aprobadas, tu bodega aparece en "Explorar Bodegas" para que los vendedores te encuentren.`}
                  {estadoProveedor.status === 'en_revision' &&
                    'Nuestro equipo de proveedores está revisando tus productos. Te avisamos apenas quede aprobada y aparezcas en "Explorar Bodegas".'}
                  {estadoProveedor.status === 'aprobado' && 'Tu bodega ya aparece en "Explorar Bodegas" para que los vendedores te encuentren.'}
                  {estadoProveedor.status === 'rechazado' &&
                    (estadoProveedor.rejectionReason
                      ? `Motivo: "${estadoProveedor.rejectionReason}". Ajusta tus productos y vuelve a enviar tu cuenta a revisión.`
                      : 'Ajusta tus productos y vuelve a enviar tu cuenta a revisión.')}
                </p>
              </div>
            </div>
            {(estadoProveedor.status === 'incompleto' || estadoProveedor.status === 'rechazado') && (
              <button
                onClick={enviarARevision}
                disabled={enviando || estadoProveedor.productCount < MINIMO_PRODUCTOS_PROVEEDOR}
                className="shrink-0 rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                style={{ background: '#02a0e3' }}
              >
                {enviando ? 'Enviando…' : 'Enviar a revisión'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Productos</h4>
        <button
          onClick={() => setModalId('crear')}
          className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#0d6efd]"
        >
          <Plus className="h-4 w-4" /> Nuevo
        </button>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-gray-200">
          {esAdmin && (
            <button onClick={() => setTab('otros')} className={`px-4 py-2 text-sm font-semibold ${tab === 'otros' ? 'border-b-2 border-[#0d6efd] text-[#0d6efd]' : 'text-gray-500'}`}>
              Productos
            </button>
          )}
          <button onClick={() => setTab('mios')} className={`px-4 py-2 text-sm font-semibold ${tab === 'mios' ? 'border-b-2 border-[#0d6efd] text-[#0d6efd]' : 'text-gray-500'}`}>
            Mis Productos
          </button>
          <button onClick={() => setTab('porActivar')} className={`px-4 py-2 text-sm font-semibold ${tab === 'porActivar' ? 'border-b-2 border-[#0d6efd] text-[#0d6efd]' : 'text-gray-500'}`}>
            Productos por Activar de proveedor
          </button>
        </div>

        <TableProductosPanel key={`${tab}-${refrescarKey}`} modo={tab} userId={dataUser.id} esAdmin={esAdmin} onEditar={(id) => setModalId(id)} />
      </div>

      {modalId !== null && (
        <FormProductoModal
          productoId={modalId === 'crear' ? null : modalId}
          ownerProfileId={dataUser.id}
          esAdmin={esAdmin}
          onClose={() => setModalId(null)}
          onGuardado={() => {
            setModalId(null);
            setRefrescarKey((k) => k + 1);
            if (esProveedor && dataUser) cargarEstadoProveedor(dataUser.id);
          }}
        />
      )}

      <Toast mensaje={mensaje} />
    </div>
  );
}
