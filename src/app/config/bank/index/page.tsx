'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchSaldoProveedor, fetchCuentasBancarias, type CuentaBancaria } from '@/lib/bank';
import { formatCOP } from '@/lib/cartStore';
import { FormBankModal } from '@/components/FormBankModal';
import { FormDisbursementModal } from '@/components/FormDisbursementModal';
import { useToast, Toast } from '@/components/Toast';

// Port de IndexComponent (Angular, "/config/bank/index") -- panel de billetera del proveedor.
// Ver lib/bank.ts para el alcance real: "Ganancia por flete de compra" (getVentaCompleteEarningBuy)
// se omite por ser un no-op confirmado en el backend.

export default function BankIndexPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [mostrarCuenta, setMostrarCuenta] = useState(false);
  const [mostrarRetiro, setMostrarRetiro] = useState(false);

  async function cargar(userId: string) {
    setSaldo(await fetchSaldoProveedor(userId));
    setCuentas(await fetchCuentasBancarias(userId));
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      await cargar(usuario.id);
      setEstado('listo');
    });
  }, []);

  if (estado === 'revisando' || !dataUser) return null;

  return (
    <div className="mx-auto w-full max-w-[1000px] px-3 py-6">
      <h3 className="text-xl font-bold text-gray-800">Mi Billetera</h3>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Saldo disponible</p>
          <p className="mt-1 text-3xl font-bold text-green-700">$ {formatCOP(saldo)}</p>
          <button onClick={() => setMostrarRetiro(true)} className="mt-3 rounded-full bg-[#0d6efd] px-4 py-2 text-xs font-bold text-white hover:opacity-90">
            Solicitar Retiro
          </button>
        </div>

        <div className="rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">Cuentas bancarias</p>
            <button onClick={() => setMostrarCuenta(true)} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              + Agregar
            </button>
          </div>
          {cuentas.length === 0 ? (
            <p className="mt-2 text-xs text-gray-400">Todavía no tienes cuentas bancarias registradas.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {cuentas.map((c) => (
                <li key={c.id}>
                  {c.banco} — {c.numeroCuenta}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Link href="/config/bank/listPayment" className="text-sm text-[#0d6efd] hover:underline">
          Ver historial de pagos →
        </Link>
      </div>

      <Toast mensaje={mensaje} />

      {mostrarCuenta && (
        <FormBankModal
          userId={dataUser.id}
          onClose={() => setMostrarCuenta(false)}
          onGuardado={() => {
            setMostrarCuenta(false);
            cargar(dataUser.id);
          }}
        />
      )}

      {mostrarRetiro && (
        <FormDisbursementModal
          userId={dataUser.id}
          saldo={saldo}
          cuentas={cuentas}
          onClose={() => setMostrarRetiro(false)}
          onGuardado={() => {
            setMostrarRetiro(false);
            cargar(dataUser.id);
          }}
        />
      )}
    </div>
  );
}
