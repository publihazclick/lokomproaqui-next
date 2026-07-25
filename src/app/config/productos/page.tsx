'use client';

import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { TableProductosPanel } from '@/components/TableProductosPanel';
import { FormProductoModal } from '@/components/FormProductoModal';
import type { ModoListaProductos } from '@/lib/productosAdmin';

// Port de ProductosComponent (Angular, panel admin "Productos", la pieza mas grande de Fase 5).
// 3 pestañas -> TableProductosPanel compartido, igual que el original con app-table-product.
// Ver src/lib/productosAdmin.ts y src/components/FormProductoModal.tsx para el detalle completo
// de los bugs reales corregidos y las simplificaciones documentadas.
//
// Pedido explicito del usuario 2026-07-24: esta pagina vuelve a ser SOLO subir/editar productos,
// sin nada de onboarding. Los "Paso 1/2/3" (direccion de recogida, alta rapida de producto,
// documentos) y el envio a revision de la cuenta de proveedor se mudaron enteros a
// /config/perfil ("Datos de bodegas" en Mi Cuenta) -- ver ese archivo para el detalle.

export default function ProductosPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [tab, setTab] = useState<ModoListaProductos>('mios');
  const [modalId, setModalId] = useState<number | null | 'crear'>(null);
  const [refrescarKey, setRefrescarKey] = useState(0);

  const esAdmin = dataUser?.rolname === 'administrador';

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      setTab(usuario.rolname === 'administrador' ? 'otros' : 'mios');
      setEstado('listo');
    });
  }, []);

  if (estado === 'revisando' || !dataUser) return null;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <div className="flex items-center gap-2 px-1 py-2">
        <ClipboardList className="h-5 w-5 text-gray-700" />
        <h4 className="text-lg font-bold text-gray-900">Productos</h4>
      </div>
      <div className="rounded-xl border border-gray-100 p-4 shadow-sm">
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

        <TableProductosPanel key={`${tab}-${refrescarKey}`} modo={tab} userId={dataUser.id} esAdmin={esAdmin} onEditar={(id) => setModalId(id)} onCrear={() => setModalId('crear')} />
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
          }}
        />
      )}
    </div>
  );
}
