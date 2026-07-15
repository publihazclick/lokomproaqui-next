'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { solicitarRetiroProveedor, type CuentaBancaria } from '@/lib/bank';
import { formatCOP } from '@/lib/cartStore';
import { useToast, Toast } from './Toast';

// Port de FormDisbursementComponent (Angular, "Solicitar retiro") -- version real: pide TODO el
// saldo disponible de la billetera 'supplier' (mismo criterio que Cobros), no un desglose de
// transacciones (ese desglose ya no existe en el backend real, ver lib/bank.ts).

export function FormDisbursementModal({
  userId,
  saldo,
  cuentas,
  onClose,
  onGuardado,
}: {
  userId: string;
  saldo: number;
  cuentas: CuentaBancaria[];
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { mensaje, mostrar } = useToast();
  const [bankId, setBankId] = useState(cuentas[0]?.id || 0);
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    if (!bankId) {
      mostrar('¡Lo Sentimos primero debes agregar los datos bancarios!');
      return;
    }
    setGuardando(true);
    const res = await solicitarRetiroProveedor(userId, bankId, saldo);
    setGuardando(false);
    if (!res.success) {
      mostrar(res.message || 'No se pudo confirmar el retiro');
      return;
    }
    mostrar('Proceso de retiro confirmado! Tu proceso estará en proceso demora 3 - 6 días hábiles');
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Solicitar Retiro</h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {cuentas.length === 0 ? (
          <p className="text-sm text-amber-600">¡Lo Sentimos primero debes agregar los datos bancarios!</p>
        ) : (
          <>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-xs text-gray-600">Monto a retirar</p>
              <p className="text-2xl font-bold text-green-700">$ {formatCOP(saldo)}</p>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-gray-700">Cuenta bancaria</label>
              <select value={bankId} onChange={(e) => setBankId(Number(e.target.value))} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.banco} — {c.numeroCuenta}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={confirmar} disabled={guardando} className="rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {guardando ? 'Procesando…' : 'Confirmar retiro'}
              </button>
            </div>
          </>
        )}
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
