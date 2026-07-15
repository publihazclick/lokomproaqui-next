'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { crearCuentaBancaria } from '@/lib/bank';
import { useToast, Toast } from './Toast';

// Port de CreateBankComponent (Angular) -- agregar una cuenta bancaria propia (proveedor/bodega).

export function FormBankModal({ userId, onClose, onGuardado }: { userId: string; onClose: () => void; onGuardado: () => void }) {
  const { mensaje, mostrar } = useToast();
  const [banco, setBanco] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('Ahorros');
  const [cedula, setCedula] = useState('');
  const [nombreTitular, setNombreTitular] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!banco.trim()) return mostrar('Error falta el nombre del banco');
    if (!numeroCuenta.trim()) return mostrar('Error falta el numero de cuenta');
    if (!cedula.trim()) return mostrar('Error falta la cedula del cliente');
    if (!nombreTitular.trim()) return mostrar('Error falta el nombre titular');

    setGuardando(true);
    const ok = await crearCuentaBancaria(userId, { banco: banco.trim(), numeroCuenta: numeroCuenta.trim(), tipoCuenta, cedula: cedula.trim(), nombreTitular: nombreTitular.trim() });
    setGuardando(false);
    if (!ok) {
      mostrar('Error');
      return;
    }
    mostrar('Exitoso');
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Agregar Cuenta Bancaria</h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Banco</label>
            <input value={banco} onChange={(e) => setBanco(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Numero de cuenta</label>
            <input value={numeroCuenta} onChange={(e) => setNumeroCuenta(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Tipo de cuenta</label>
            <select value={tipoCuenta} onChange={(e) => setTipoCuenta(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
              <option value="Ahorros">Ahorros</option>
              <option value="Corriente">Corriente</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Cedula del titular</label>
            <input value={cedula} onChange={(e) => setCedula(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Nombre del titular</label>
            <input value={nombreTitular} onChange={(e) => setNombreTitular(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={guardar} disabled={guardando} className="rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Crear'}
          </button>
        </div>
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
