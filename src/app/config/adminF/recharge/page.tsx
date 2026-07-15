'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchRechargeAdmin, eliminarRecharge, type RechargeAdminRow } from '@/lib/rechargeAdmin';
import { formatCOP } from '@/lib/cartStore';
import { FormRechargeModal } from '@/components/FormRechargeModal';
import { useToast, Toast } from '@/components/Toast';

// Port de RechargeComponent (Angular, "/config/adminF/recharge", solo admin) -- CRUD de los
// paquetes de recarga de billetera que ya se muestran en /config/recharge.

export default function AdminRechargePage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [paquetes, setPaquetes] = useState<RechargeAdminRow[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState<'nuevo' | RechargeAdminRow | null>(null);

  async function cargar() {
    setPaquetes(await fetchRechargeAdmin(busqueda));
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      await cargar();
      setEstado('listo');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (estado === 'listo') cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  async function eliminar(row: RechargeAdminRow) {
    if (!window.confirm('Deseas Eliminar Dato')) return;
    const ok = await eliminarRecharge(row.id);
    if (!ok) {
      mostrar('Error de servidor');
      return;
    }
    setPaquetes((prev) => prev.filter((p) => p.id !== row.id));
    mostrar('Eliminado');
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1000px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Paquetes de Recarga</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar paquete…"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={() => setModalAbierto('nuevo')} className="rounded bg-[#0d6efd] px-3 py-2 text-sm font-medium text-white">
            + Crear
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="py-2 pr-3">Acciones</th>
                <th className="py-2 pr-3">Foto</th>
                <th className="py-2 pr-3">Titulo</th>
                <th className="py-2 pr-3">Descripcion</th>
                <th className="py-2 pr-3">Precio</th>
              </tr>
            </thead>
            <tbody>
              {paquetes.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="space-x-2 py-2 pr-3">
                    <button onClick={() => setModalAbierto(p)} className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                      Editar
                    </button>
                    <button onClick={() => eliminar(p)} className="inline-flex items-center gap-1 rounded bg-[#dc3545] px-2 py-1 text-xs font-medium text-white">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- miniatura del paquete de recarga */}
                    <img src={p.foto || '/assets/noimagen.jpg'} alt="" className="h-10 w-10 rounded object-cover" />
                  </td>
                  <td className="py-2 pr-3">{p.titulo}</td>
                  <td className="py-2 pr-3 max-w-xs truncate">{p.descripcion}</td>
                  <td className="py-2 pr-3">$ {formatCOP(p.precio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {paquetes.length === 0 && <p className="py-10 text-center text-gray-500">No hay paquetes para mostrar.</p>}
        </div>
      </div>

      <Toast mensaje={mensaje} />

      {modalAbierto && (
        <FormRechargeModal
          paquete={modalAbierto === 'nuevo' ? null : modalAbierto}
          onClose={() => setModalAbierto(null)}
          onGuardado={() => {
            setModalAbierto(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}
