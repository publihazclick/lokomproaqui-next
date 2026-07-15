'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { aprobarPagoProveedor, subirComprobantePago, type PagoProveedorAdmin } from '@/lib/bank';
import { formatCOP } from '@/lib/cartStore';
import { useToast, Toast } from './Toast';

// Port de FormPaymentDetailComponent (Angular) -- aprobar un pago a proveedor subiendo el
// comprobante. A diferencia del original (que solo cambiaba el estado), esto ahora llama al RPC
// real process_supplier_payout que TAMBIEN descuenta la billetera del proveedor (ver lib/bank.ts).

export function FormPaymentDetailModal({ pago, onClose, onAprobado }: { pago: PagoProveedorAdmin; onClose: () => void; onAprobado: () => void }) {
  const { mensaje, mostrar } = useToast();
  const [subiendo, setSubiendo] = useState(false);

  async function subirYAprobar(file: File) {
    setSubiendo(true);
    const url = await subirComprobantePago(file);
    if (!url) {
      setSubiendo(false);
      mostrar('Error de servidor');
      return;
    }
    const res = await aprobarPagoProveedor(pago.id, url);
    setSubiendo(false);
    if (!res.success) {
      mostrar(res.message || 'Problemas al actualizar');
      return;
    }
    mostrar('Actualizado exitoso');
    onAprobado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Detalle del Pago</h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-1 text-sm text-gray-700">
          <p>
            Proveedor: <b>{pago.proveedorNombre || '—'}</b>
          </p>
          <p>
            Banco: {pago.bancoNombre} — {pago.bancoNumeroCuenta}
          </p>
          <p>
            Monto: <b>$ {formatCOP(pago.monto)}</b>
          </p>
        </div>

        {pago.estado === 1 ? (
          <p className="mt-4 text-sm font-medium text-green-700">Este pago ya fue aprobado.</p>
        ) : (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-700">Subir comprobante de pago para aprobar</label>
            <input
              type="file"
              accept="image/*"
              disabled={subiendo}
              onChange={(e) => e.target.files?.[0] && subirYAprobar(e.target.files[0])}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
            />
            {subiendo && <p className="mt-1 text-xs text-gray-500">Subiendo y aprobando…</p>}
          </div>
        )}
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
