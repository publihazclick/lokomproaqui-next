'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { crearRetiro, cambiarEstadoRetiro, type RetiroRow } from '@/lib/cobros';
import { useToast, Toast } from '@/components/Toast';

// Port simplificado de FormcobrosComponent (Angular) -- ver src/lib/cobros.ts para los bugs reales
// corregidos. "Ventas Solicitadas" y el comprobante de pago en imagen no se portan (alcance
// recortado, documentado ahi).

const METODOS_COLOMBIA = [
  { value: 'cuenta_de_ahorro_bancolombia', label: 'Cuenta de ahorro Bancolombia' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'davi_plata', label: 'DaviPlata' },
  { value: 'ahorro_a_la_mano_bancolombia', label: 'Ahorro a la mano Bancolombia' },
];

const METODOS_VENEZUELA = [
  { value: 'Efecty', label: 'Efecty' },
  { value: 'transfer_bancaria', label: 'Transferencia bancaria' },
];

interface FormCobroModalProps {
  userId: string;
  saldoDisponible: number;
  retiroExistente?: RetiroRow;
  esAdmin: boolean;
  onClose: () => void;
  onGuardado: () => void;
}

export function FormCobroModal({ userId, saldoDisponible, retiroExistente, esAdmin, onClose, onGuardado }: FormCobroModalProps) {
  const { mensaje, mostrar } = useToast();
  const [pais, setPais] = useState<'colombia' | 'venezuela'>('colombia');
  const [cedula, setCedula] = useState(retiroExistente?.cedula || '');
  const [celular, setCelular] = useState(retiroExistente?.celular || '');
  const [metodo, setMetodo] = useState(retiroExistente?.metodo || METODOS_COLOMBIA[0].value);
  const [cuenta, setCuenta] = useState(retiroExistente?.cuenta || '');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const metodos = pais === 'colombia' ? METODOS_COLOMBIA : METODOS_VENEZUELA;

  async function enviarSolicitud() {
    if (!cedula) return mostrar('Error no has introducido tu Cedula');
    if (!celular) return mostrar('Error no has introducido tu Celular por si necesitamos mas informacion');
    if (!cuenta) return mostrar('Error no has introducido tu Numero de la cuenta');
    if (!saldoDisponible || saldoDisponible < 5000) return mostrar('Error no tienes suficiente monto a retirar');

    setGuardando(true);
    const ok = await crearRetiro({ userId, pais, cedula, celular, metodo, cuenta, monto: saldoDisponible, descripcion });
    setGuardando(false);
    if (!ok) return mostrar('Error de servidor');
    mostrar('Tu solicitud de retiro se hará efectiva y se verá reflejada en tu cuenta de 1 a 3 días hábiles');
    onGuardado();
  }

  async function cambiarEstado(estado: 1 | 2) {
    if (!retiroExistente) return;
    setGuardando(true);
    const res = await cambiarEstadoRetiro(retiroExistente.id, estado);
    setGuardando(false);
    if (!res.success) return mostrar(res.message || 'Error de servidor');
    mostrar('Actualizado');
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h4 className="text-base font-bold text-gray-900">Datos necesarios para realizar el cobro</h4>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          {retiroExistente && (
            <div className="rounded bg-gray-50 p-3 text-sm">
              <p>
                <span className="text-gray-500">Vendedor:</span> {retiroExistente.vendedorNombre || '—'}
              </p>
              <p>
                <span className="text-gray-500">Estado:</span> {retiroExistente.estadoLabel}
              </p>
              <p>
                <span className="text-gray-500">Fecha solicitud:</span> {new Date(retiroExistente.fecha).toLocaleString('es-CO')}
              </p>
            </div>
          )}

          {!retiroExistente && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">País donde vas a retirar</label>
                <select value={pais} onChange={(e) => setPais(e.target.value as 'colombia' | 'venezuela')} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                  <option value="colombia">Colombiano</option>
                  <option value="venezuela">Venezolano</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Número Cédula</label>
                <input value={cedula} onChange={(e) => setCedula(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Número de celular</label>
                <input value={celular} onChange={(e) => setCelular(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Método de pago</label>
                <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                  {metodos.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Número de cuenta / celular de la cuenta</label>
                <input value={cuenta} onChange={(e) => setCuenta(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Monto a retirar</label>
                <input disabled value={`$ ${saldoDisponible.toLocaleString('es-CO')} COP`} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Descripción</label>
                <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-gray-600">
            Cerrar
          </button>
          {retiroExistente ? (
            esAdmin &&
            retiroExistente.estado === 0 && (
              <>
                <button onClick={() => cambiarEstado(2)} disabled={guardando} className="rounded bg-[#dc3545] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
                  Rechazar
                </button>
                <button onClick={() => cambiarEstado(1)} disabled={guardando} className="rounded bg-[#198754] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
                  Aprobar
                </button>
              </>
            )
          ) : (
            <button onClick={enviarSolicitud} disabled={guardando} className="rounded bg-[#0d6efd] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
              {guardando ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          )}
        </div>
      </div>
      <Toast mensaje={mensaje} />
    </div>
  );
}
