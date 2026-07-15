'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchTestimonioDetalle, crearTestimonio, actualizarTestimonio } from '@/lib/testimoniosAdmin';
import { buscarUsuarioPorTelefonoOTienda, type UsuarioBusqueda } from '@/lib/usuarios';
import { useToast, Toast } from '@/components/Toast';

// Port simplificado de FormtestimoniosComponent (Angular) -- ver src/lib/testimoniosAdmin.ts para
// los bugs reales corregidos. Editor de texto enriquecido simplificado a textarea (mismo criterio
// que /config/productos).

interface FormTestimonioModalProps {
  testimonioId: number | null;
  usuarioActualId: string;
  esAdmin: boolean;
  onClose: () => void;
  onGuardado: () => void;
}

export function FormTestimonioModal({ testimonioId, usuarioActualId, esAdmin, onClose, onGuardado }: FormTestimonioModalProps) {
  const { mensaje, mostrar } = useToast();
  const [cargando, setCargando] = useState(!!testimonioId);
  const [descripcion, setDescripcion] = useState('');
  const [estado, setEstado] = useState(0);
  const [usuarioId, setUsuarioId] = useState(usuarioActualId);
  const [usuarioNombre, setUsuarioNombre] = useState<string | null>(null);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!testimonioId) return;
    fetchTestimonioDetalle(testimonioId).then((d) => {
      if (d) {
        setDescripcion(d.descripcion);
        setEstado(d.estado);
        setUsuarioId(d.usuarioId);
        setUsuarioNombre(d.usuarioNombre);
      }
      setCargando(false);
    });
  }, [testimonioId]);

  async function buscarUsuario() {
    if (!terminoBusqueda.trim()) return mostrar('Por favor introducir un teléfono o nombre de tienda');
    setBuscando(true);
    const res = await buscarUsuarioPorTelefonoOTienda(terminoBusqueda);
    setBuscando(false);
    if (!res) return mostrar('Usuario no encontrado');
    setUsuarioId(res.id);
    setUsuarioNombre(res.nombre);
    mostrar('Usuario encontrado');
  }

  async function guardar() {
    if (!descripcion.trim()) return mostrar('Falta el testimonio');
    setGuardando(true);
    const ok = testimonioId ? await actualizarTestimonio(testimonioId, descripcion, estado) : await crearTestimonio(usuarioId, descripcion);
    setGuardando(false);
    if (!ok) return mostrar('Error de servidor');
    mostrar(testimonioId ? 'Gracias Por tu testimonio' : 'testimonio actualizado');
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h4 className="text-base font-bold text-gray-900">Datos necesarios para hacer un testimonio</h4>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {cargando ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">Cargando…</p>
        ) : (
          <div className="space-y-3 px-4 py-4">
            {esAdmin && testimonioId && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Estado del Testimonio</label>
                <select value={estado} onChange={(e) => setEstado(Number(e.target.value))} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                  <option value={0}>Activo</option>
                  <option value={1}>Eliminado</option>
                  <option value={2}>Pendiente de aprobación</option>
                </select>
              </div>
            )}

            {!testimonioId && esAdmin && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Teléfono o nombre de tienda del usuario</label>
                <div className="flex gap-2">
                  <input value={terminoBusqueda} onChange={(e) => setTerminoBusqueda(e.target.value)} className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm" />
                  <button onClick={buscarUsuario} disabled={buscando} className="rounded bg-[#0d6efd] px-3 py-2 text-xs font-medium text-white disabled:opacity-60">
                    Buscar
                  </button>
                </div>
                {usuarioNombre && <p className="mt-1 text-xs text-green-700">Usuario: {usuarioNombre}</p>}
              </div>
            )}

            {testimonioId && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Usuario</label>
                <input value={usuarioNombre || ''} disabled className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm" />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Testimonio</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={5} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-gray-600">
            Cerrar
          </button>
          <button onClick={guardar} disabled={cargando || guardando} className="rounded bg-[#0d6efd] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
            {guardando ? 'Guardando…' : testimonioId ? 'Actualizar Cambios' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
      <Toast mensaje={mensaje} />
    </div>
  );
}
