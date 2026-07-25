'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Layers, FileSpreadsheet } from 'lucide-react';

// Pedido explicito del usuario 2026-07-25: cambios reales desplegados no se veian en produccion --
// el shell HTML de esta pagina (contenido 100% client-side, autenticado) quedaba cacheado en el
// edge de Vercel (ISR) y no se invalidaba entre deploys sucesivos. Se fuerza render dinamico para
// que cada visita sirva el HTML mas reciente en vez de una version potencialmente vieja en cache.
export const dynamic = 'force-dynamic';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { TableProductosPanel } from '@/components/TableProductosPanel';
import { FormProductoModal } from '@/components/FormProductoModal';
import { CargaMasivaExcelModal } from '@/components/CargaMasivaExcelModal';
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
  const [modalId, setModalId] = useState<number | null | 'crear' | 'masiva' | 'excel'>(null);
  const [refrescarKey, setRefrescarKey] = useState(0);
  // Pedido explicito del usuario 2026-07-25 ("quiero que el proveedor pueda subir productos de
  // manera masiva"): cada vez que se termina un producto en carga masiva, se bumpea esta key para
  // remontar FormProductoModal desde cero (formulario vacio para el siguiente), y se suma 1 al
  // contador que ve el proveedor arriba del formulario.
  const [masivaKey, setMasivaKey] = useState(0);
  const [masivaContador, setMasivaContador] = useState(0);

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
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-gray-700" />
          <h4 className="text-lg font-bold text-gray-900">Productos</h4>
        </div>
        {!esAdmin && (
          <div className="flex flex-wrap gap-2">
            {/* Pedido explicito del usuario 2026-07-25 ("no sabes como hacen las plataformas de
                dropshipping"): la carga masiva DE VERDAD es con una plantilla de Excel que crea
                muchos productos de un solo archivo -- va primero/mas destacada. La version
                "uno por uno" (antes llamada "Carga Masiva de Productos" por error) queda como
                opcion secundaria para cuando no se tienen las fotos hospedadas en ningun link. */}
            <button
              onClick={() => setModalId('excel')}
              className="flex items-center gap-1.5 rounded-full bg-[#198754] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
            >
              <FileSpreadsheet className="h-4 w-4" /> Carga Masiva con Excel
            </button>
            <button
              onClick={() => {
                setMasivaContador(0);
                setMasivaKey((k) => k + 1);
                setModalId('masiva');
              }}
              className="flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Layers className="h-4 w-4" /> Carga Rápida (uno por uno)
            </button>
          </div>
        )}
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

      {modalId === 'excel' && (
        <CargaMasivaExcelModal
          ownerProfileId={dataUser.id}
          esAdmin={esAdmin}
          onClose={() => setModalId(null)}
          onTerminado={() => {
            setModalId(null);
            setRefrescarKey((k) => k + 1);
          }}
        />
      )}

      {modalId !== null && modalId !== 'masiva' && modalId !== 'excel' && (
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

      {modalId === 'masiva' && (
        <FormProductoModal
          key={masivaKey}
          productoId={null}
          modoMasivo
          contadorMasivo={masivaContador}
          ownerProfileId={dataUser.id}
          esAdmin={esAdmin}
          // "Terminar carga masiva": cierra la sesion y refresca la tabla para ver todo lo subido.
          onClose={() => {
            setModalId(null);
            setRefrescarKey((k) => k + 1);
          }}
          // "Guardar y Agregar Otro Producto": NO cierra la sesion -- bumpea la key para remontar
          // un formulario vacio (siguiente producto) y suma 1 al contador.
          onGuardado={() => {
            setMasivaContador((n) => n + 1);
            setMasivaKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
