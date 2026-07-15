'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { crearRecharge, actualizarRecharge, type RechargeAdminRow } from '@/lib/rechargeAdmin';
import { subirArchivoPublico } from '@/lib/perfil';
import { useToast, Toast } from './Toast';

// Port de FormRechargeComponent (Angular) -- crear/editar un paquete de recarga de billetera.

export function FormRechargeModal({ paquete, onClose, onGuardado }: { paquete: RechargeAdminRow | null; onClose: () => void; onGuardado: () => void }) {
  const { mensaje, mostrar } = useToast();
  const [titulo, setTitulo] = useState(paquete?.titulo || '');
  const [descripcion, setDescripcion] = useState(paquete?.descripcion || '');
  const [precio, setPrecio] = useState(paquete?.precio?.toString() || '');
  const [foto, setFoto] = useState(paquete?.foto || '');
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function subirFoto(file: File) {
    setSubiendo(true);
    const url = await subirArchivoPublico(file);
    setSubiendo(false);
    if (url) setFoto(url);
    else mostrar('Error de servidor');
  }

  async function guardar() {
    if (!titulo.trim() || !precio) {
      mostrar('Completa el titulo y el precio');
      return;
    }
    setGuardando(true);
    const data = { titulo: titulo.trim(), descripcion: descripcion.trim(), foto: foto || null, precio: Number(precio) };
    const ok = paquete ? await actualizarRecharge(paquete.id, data) : await crearRecharge(data);
    setGuardando(false);
    if (!ok) {
      mostrar('Error');
      return;
    }
    mostrar(paquete ? 'update' : 'Create');
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">{paquete ? 'Actualizar' : 'Crear'} Paquete de Recarga</h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Titulo</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Descripcion</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Precio</label>
            <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Foto</label>
            <input type="file" accept="image/*" disabled={subiendo} onChange={(e) => e.target.files?.[0] && subirFoto(e.target.files[0])} className="w-full text-xs" />
            {foto && (
              // eslint-disable-next-line @next/next/no-img-element -- previsualizacion de la foto del paquete
              <img src={foto} alt="" className="mt-2 h-20 w-20 rounded object-cover" />
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={guardar} disabled={guardando || subiendo} className="rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {guardando ? 'Guardando…' : paquete ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
