'use client';

import { useEffect, useState } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import {
  fetchCategoriaAdminDetalle,
  guardarCategoria,
  guardarSubcategoria,
  eliminarSubcategoria,
  type SubcategoriaAdmin,
} from '@/lib/categoriasAdmin';
import { subirArchivoPublico } from '@/lib/perfil';
import { useToast, Toast } from '@/components/Toast';

// Port 1:1 de FormcategoriasComponent (Angular) -- a diferencia de la mayoria de Fase 5, el
// backend ya estaba bien conectado aca, no hubo bugs reales que corregir.

interface FormCategoriaModalProps {
  categoriaId: number | null;
  onClose: () => void;
  onGuardado: () => void;
}

export function FormCategoriaModal({ categoriaId, onClose, onGuardado }: FormCategoriaModalProps) {
  const { mensaje, mostrar } = useToast();
  const [cargando, setCargando] = useState(!!categoriaId);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [imagen, setImagen] = useState<string | null>(null);
  const [ordenador, setOrdenador] = useState('');
  const [activo, setActivo] = useState(true);
  const [subcategorias, setSubcategorias] = useState<SubcategoriaAdmin[]>([]);
  const [nuevaSub, setNuevaSub] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!categoriaId) return;
    fetchCategoriaAdminDetalle(categoriaId).then((d) => {
      if (d) {
        setNombre(d.nombre);
        setDescripcion(d.descripcion);
        setImagen(d.imagen);
        setOrdenador(d.ordenador);
        setActivo(d.activo);
        setSubcategorias(d.subcategorias);
      }
      setCargando(false);
    });
  }, [categoriaId]);

  async function subirImagen(file: File) {
    setSubiendo(true);
    const url = await subirArchivoPublico(file);
    setSubiendo(false);
    if (!url) return mostrar('Error de servidor');
    setImagen(url);
  }

  function agregarSub() {
    const valor = nuevaSub.trim();
    if (!valor) return;
    if (subcategorias.some((s) => s.nombre === valor)) return;
    setSubcategorias((prev) => [...prev, { id: null, nombre: valor }]);
    setNuevaSub('');
  }

  async function quitarSub(sub: SubcategoriaAdmin) {
    if (sub.id) {
      const ok = await eliminarSubcategoria(sub.id);
      if (!ok) return mostrar('Error de servidor');
      mostrar('Eliminado');
    }
    setSubcategorias((prev) => prev.filter((s) => s !== sub));
  }

  async function guardar() {
    if (!nombre.trim()) return mostrar('Falta el nombre de la categoría');
    setGuardando(true);
    const id = await guardarCategoria({ id: categoriaId, nombre, descripcion, imagen, ordenador, activo });
    if (!id) {
      setGuardando(false);
      return mostrar('Error de servidor');
    }
    for (const sub of subcategorias) {
      if (!sub.id) await guardarSubcategoria(id, sub);
    }
    setGuardando(false);
    mostrar(categoriaId ? 'Actualizado' : 'Exitoso');
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h4 className="text-base font-bold text-gray-900">{categoriaId ? 'Actualizar' : 'Crear'} Categoria</h4>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {cargando ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">Cargando…</p>
        ) : (
          <div className="space-y-3 px-4 py-4">
            {imagen && (
              <div className="mx-auto w-40">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto de categoria (Supabase Storage) */}
                <img src={imagen} alt="" className="w-full rounded" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Categoria</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Descripción</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Categorías Hijas</label>
              <div className="flex flex-wrap gap-2">
                {subcategorias.map((s) => (
                  <span key={s.id ?? s.nombre} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs">
                    {s.nombre}
                    <button onClick={() => quitarSub(s)} className="text-gray-500 hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={nuevaSub}
                  onChange={(e) => setNuevaSub(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && agregarSub()}
                  placeholder="Nueva categoría…"
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <button onClick={agregarSub} className="rounded bg-[#0d6efd] px-3 py-2 text-xs font-medium text-white">
                  Agregar
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Ordenador</label>
              <input value={ordenador} onChange={(e) => setOrdenador(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Subir imagen</label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm">
                <Upload className="h-4 w-4" />
                {subiendo ? 'Subiendo…' : 'Elegir archivo'}
                <input type="file" accept="image/*" hidden disabled={subiendo} onChange={(e) => e.target.files?.[0] && subirImagen(e.target.files[0])} />
              </label>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Estado de la categoría</label>
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
            {guardando ? 'Guardando…' : categoriaId ? 'Actualizar Cambios' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
      <Toast mensaje={mensaje} />
    </div>
  );
}
