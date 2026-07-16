'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto } from '@/lib/usuarios';
import { fetchPagosProveedorAdmin, type PagoProveedorAdmin } from '@/lib/bank';
import { formatCOP } from '@/lib/cartStore';
import { FormPaymentDetailModal } from '@/components/FormPaymentDetailModal';

// Port de VendorPaymentsComponent (Angular, "/config/adminF/vendorpayment", solo admin) --
// solicitudes de retiro de proveedores/bodega, aprobar subiendo el comprobante (ver
// FormPaymentDetailModal, ahora conectado al RPC real process_supplier_payout).
//
// Bug real de seguridad encontrado y corregido: esta pantalla aprueba pagos reales (debita
// wallet_balances) pero no tenia NINGUN chequeo de rol (el guard de Angular original,
// AuthService.canActivate, solo exige sesion iniciada, no rol admin -- cualquier usuario logueado
// podia entrar y aprobar pagos). Se agrega el mismo chequeo ya usado en /config/usuarios.

export default function VendorPaymentsPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-autorizado'>('revisando');
  const [pagos, setPagos] = useState<PagoProveedorAdmin[]>([]);
  const [pagoAbierto, setPagoAbierto] = useState<PagoProveedorAdmin | null>(null);

  async function cargar() {
    setPagos(await fetchPagosProveedorAdmin());
  }

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
      await cargar();
      setEstado('listo');
    });
  }, []);

  if (estado === 'revisando') return null;

  if (estado === 'no-autorizado') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-gray-500">Esta sección es solo para administradores.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Pagos a Proveedores</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="py-2 pr-3">Usuario</th>
                <th className="py-2 pr-3">Banco</th>
                <th className="py-2 pr-3">Monto</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Fecha pago</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50" onClick={() => setPagoAbierto(p)}>
                  <td className="py-2 pr-3">{p.proveedorNombre || '—'}</td>
                  <td className="py-2 pr-3">
                    {p.bancoNombre} — {p.bancoNumeroCuenta}
                  </td>
                  <td className="py-2 pr-3">$ {formatCOP(p.monto)}</td>
                  <td className="py-2 pr-3">{p.estado === 1 ? <span className="text-green-700">Pagado</span> : <span className="text-amber-600">Pendiente</span>}</td>
                  <td className="py-2 pr-3">{p.fechaPago ? new Date(p.fechaPago).toLocaleString('es-CO') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagos.length === 0 && <p className="py-10 text-center text-gray-500">No hay pagos para mostrar.</p>}
        </div>
      </div>

      {pagoAbierto && (
        <FormPaymentDetailModal
          pago={pagoAbierto}
          onClose={() => setPagoAbierto(null)}
          onAprobado={() => {
            setPagoAbierto(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}
