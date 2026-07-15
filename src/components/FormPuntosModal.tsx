'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { buscarUsuarioPorTelefonoOTienda, otorgarPuntos, type UsuarioBusqueda } from '@/lib/usuarios';
import { useToast, Toast } from '@/components/Toast';

// Port desde src/app/dashboard-config/form/formpuntos (Angular, FormpuntosComponent) -- bono
// manual de puntos/ganancias que el admin le acredita a un usuario (boton "Dar puntos" en
// /config/ventas).
//
// Cambio real de comportamiento (documentado): el original buscaba por EMAIL, pero eso nunca fue
// posible desde el cliente -- el correo vive en auth.users, no en `profiles`, y
// UsuariosService.get() jamas soporto ese filtro (buscarEmail() estaba rota desde la migracion a
// Supabase, no habia forma de encontrar a nadie con ella). Se cambia el campo de busqueda a
// telefono o nombre de tienda, los identificadores reales que si existen y funcionan.

interface FormPuntosModalProps {
  onClose: () => void;
}

export function FormPuntosModal({ onClose }: FormPuntosModalProps) {
  const { mensaje, mostrar } = useToast();
  const [termino, setTermino] = useState('');
  const [usuario, setUsuario] = useState<UsuarioBusqueda | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [monto, setMonto] = useState<number | ''>('');
  const [guardando, setGuardando] = useState(false);

  async function buscar() {
    if (!termino.trim()) return;
    setBuscando(true);
    const res = await buscarUsuarioPorTelefonoOTienda(termino);
    setBuscando(false);
    setUsuario(res);
    mostrar(res ? 'Usuario Encontrado' : 'Usuario no encontrado por favor verificar');
  }

  async function guardar() {
    if (!usuario) {
      mostrar('Error usuario no Asignado');
      return;
    }
    if (!monto) {
      mostrar('Error monto no valido');
      return;
    }
    setGuardando(true);
    const ok = await otorgarPuntos(usuario.id, Number(monto));
    setGuardando(false);
    if (!ok) {
      mostrar('Error de servidor');
      return;
    }
    mostrar('Puntos asignados');
    setUsuario(null);
    setTermino('');
    setMonto('');
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h4 className="text-base font-bold text-gray-900">Asignar Puntos</h4>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Teléfono o nombre de tienda</label>
            <input
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              onBlur={buscar}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            {buscando && <p className="mt-1 text-xs text-gray-400">Buscando…</p>}
            {usuario && <p className="mt-1 text-xs text-green-700">Encontrado: {usuario.nombre}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Monto</label>
            <input type="number" value={monto} onChange={(e) => setMonto(e.target.value ? Number(e.target.value) : '')} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-gray-600">
            Cerrar
          </button>
          <button
            onClick={guardar}
            disabled={!usuario || guardando}
            className="rounded bg-[#0d6efd] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
      <Toast mensaje={mensaje} />
    </div>
  );
}
