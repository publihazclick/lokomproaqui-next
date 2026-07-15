'use client';

import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import {
  fetchTipoTallaDetalle,
  guardarTipoTalla,
  agregarTallaHija,
  actualizarOrdenTalla,
  eliminarTallaHija,
  type TallaHija,
} from '@/lib/tiposTallaAdmin';
import { useToast, Toast } from '@/components/Toast';

// Port de FormListSizeComponent (Angular) -- ver src/lib/tiposTallaAdmin.ts para el bug real
// corregido (el selector de estado guardaba en el campo equivocado, copiado de categorias).

interface FormTipoTallaModalProps {
  tipoTallaId: number | null;
  onClose: () => void;
  onGuardado: () => void;
}

export function FormTipoTallaModal({ tipoTallaId, onClose, onGuardado }: FormTipoTallaModalProps) {
  const { mensaje, mostrar } = useToast();
  const [cargando, setCargando] = useState(!!tipoTallaId);
  const [nombre, setNombre] = useState('');
  const [activo, setActivo] = useState(true);
  const [ordenador, setOrdenador] = useState(0);
  const [tallas, setTallas] = useState<TallaHija[]>([]);
  const [nuevaTalla, setNuevaTalla] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!tipoTallaId) return;
    fetchTipoTallaDetalle(tipoTallaId).then((d) => {
      if (d) {
        setNombre(d.nombre);
        setActivo(d.activo);
        setOrdenador(d.ordenar);
        setTallas(d.tallas);
      }
      setCargando(false);
    });
  }, [tipoTallaId]);

  async function agregarTalla() {
    const valor = nuevaTalla.trim();
    if (!valor) return;
    if (tallas.some((t) => t.nombre === valor)) return;
    if (tipoTallaId) {
      const ok = await agregarTallaHija(tipoTallaId, valor);
      if (!ok) return mostrar('Error de servidor');
    }
    setTallas((prev) => [...prev, { id: null, nombre: valor, ordenar: 0 }]);
    setNuevaTalla('');
    if (tipoTallaId) mostrar('Exitoso');
  }

  async function quitarTalla(t: TallaHija) {
    if (t.id) {
      const ok = await eliminarTallaHija(t.id);
      if (!ok) return mostrar('Error de servidor');
      mostrar('Eliminado');
    }
    setTallas((prev) => prev.filter((x) => x !== t));
  }

  async function cambiarOrden(t: TallaHija, ordenar: number) {
    setTallas((prev) => prev.map((x) => (x === t ? { ...x, ordenar } : x)));
    if (t.id) await actualizarOrdenTalla(t.id, ordenar);
  }

  async function guardar() {
    if (!nombre.trim()) return mostrar('Falta el nombre del tipo de talla');
    setGuardando(true);
    const id = await guardarTipoTalla({ id: tipoTallaId, nombre, activo, ordenar: ordenador });
    if (id && !tipoTallaId) {
      for (const t of tallas) await agregarTallaHija(id, t.nombre);
    }
    setGuardando(false);
    if (!id) return mostrar('Error de servidor');
    mostrar(tipoTallaId ? 'Actualizado' : 'Exitoso');
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h4 className="text-base font-bold text-gray-900">{tipoTallaId ? 'Actualizar' : 'Crear'} Tipo de Talla</h4>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {cargando ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">Cargando…</p>
        ) : (
          <div className="space-y-3 px-4 py-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Tipo de talla</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Tipo talla Hijas</label>
              <div className="flex gap-2">
                <input
                  value={nuevaTalla}
                  onChange={(e) => setNuevaTalla(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && agregarTalla()}
                  placeholder="Nueva Talla…"
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <button onClick={agregarTalla} className="rounded bg-[#0d6efd] px-3 py-2 text-xs font-medium text-white">
                  Agregar
                </button>
              </div>
            </div>

            <div>
              <h5 className="mb-2 text-sm font-semibold text-gray-700">Lista de Tallas Hijas</h5>
              <ul className="divide-y divide-gray-100 rounded border border-gray-200">
                {tallas.map((t) => (
                  <li key={t.id ?? t.nombre} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm">{t.nombre}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Ordenar"
                        value={t.ordenar}
                        onChange={(e) => cambiarOrden(t, Number(e.target.value))}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                      <button onClick={() => quitarTalla(t)} className="rounded bg-[#dc3545] p-1 text-white">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
                {tallas.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">Sin tallas todavía.</li>}
              </ul>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Ordenador</label>
              <input type="number" value={ordenador} onChange={(e) => setOrdenador(Number(e.target.value))} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Estado del tipo Talla</label>
              <select value={activo ? '0' : '1'} onChange={(e) => setActivo(e.target.value === '0')} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                <option value="0">Activo</option>
                <option value="1">Eliminado</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-gray-600">
            Cerrar
          </button>
          <button onClick={guardar} disabled={cargando || guardando} className="rounded bg-[#0d6efd] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
            {guardando ? 'Guardando…' : tipoTallaId ? 'Actualizar Cambios' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
      <Toast mensaje={mensaje} />
    </div>
  );
}
