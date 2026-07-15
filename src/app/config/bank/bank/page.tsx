'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchCuentasBancarias, eliminarCuentaBancaria, type CuentaBancaria } from '@/lib/bank';
import { FormBankModal } from '@/components/FormBankModal';
import { useToast, Toast } from '@/components/Toast';

// Port de BankComponent (Angular, "/config/bank/bank") -- listado de cuentas bancarias propias.

export default function BankAccountsPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);

  async function cargar(userId: string) {
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

  async function eliminar(cuenta: CuentaBancaria) {
    if (!window.confirm('Deseas Eliminar Dato')) return;
    const ok = await eliminarCuentaBancaria(cuenta.id);
    if (!ok) {
      mostrar('Error de servidor');
      return;
    }
    setCuentas((prev) => prev.filter((c) => c.id !== cuenta.id));
    mostrar('Eliminado');
  }

  if (estado === 'revisando' || !dataUser) return null;

  return (
    <div className="mx-auto w-full max-w-[900px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Mis Cuentas Bancarias</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <button onClick={() => setMostrarForm(true)} className="rounded bg-[#0d6efd] px-3 py-2 text-sm font-medium text-white">
          + Agregar cuenta
        </button>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="py-2 pr-3">Acciones</th>
                <th className="py-2 pr-3">Banco</th>
                <th className="py-2 pr-3">Numero de Cuenta</th>
                <th className="py-2 pr-3">Tipo de Cuenta</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3">
                    <button onClick={() => eliminar(c)} className="inline-flex items-center gap-1 rounded bg-[#dc3545] px-2 py-1 text-xs font-medium text-white">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                  <td className="py-2 pr-3">{c.banco}</td>
                  <td className="py-2 pr-3">{c.numeroCuenta}</td>
                  <td className="py-2 pr-3">{c.tipoCuenta}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cuentas.length === 0 && <p className="py-10 text-center text-gray-500">No hay cuentas bancarias para mostrar.</p>}
        </div>
      </div>

      <Toast mensaje={mensaje} />

      {mostrarForm && (
        <FormBankModal
          userId={dataUser.id}
          onClose={() => setMostrarForm(false)}
          onGuardado={() => {
            setMostrarForm(false);
            cargar(dataUser.id);
          }}
        />
      )}
    </div>
  );
}
