'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Trash2, Copy } from 'lucide-react';
import { fetchProductosAdmin, eliminarProducto, duplicarProducto, activarProducto, type ProductoAdminRow, type ModoListaProductos } from '@/lib/productosAdmin';
import { useToast, Toast } from '@/components/Toast';

// Port de TableProductComponent (Angular) -- tabla compartida por las 3 pestañas de
// /config/productos. Ver src/lib/productosAdmin.ts para los 2 bugs reales corregidos (filtro roto
// de la pestaña "Productos" y checkbox "Activar" que leia el valor viejo).

const ESTADO_LABEL: Record<number, string> = { 0: 'Activo', 1: 'Eliminado', 3: 'Pendiente' };
const LIMIT = 20;

interface TableProductosPanelProps {
  modo: ModoListaProductos;
  userId: string;
  esAdmin: boolean;
  onEditar: (id: number) => void;
}

export function TableProductosPanel({ modo, userId, esAdmin, onEditar }: TableProductosPanelProps) {
  const { mensaje, mostrar } = useToast();
  const [productos, setProductos] = useState<ProductoAdminRow[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [duplicando, setDuplicando] = useState<number | null>(null);

  const cargar = useCallback(
    async (page: number, reemplazar: boolean, search: string) => {
      const setLoader = page === 0 ? setCargando : setCargandoMas;
      setLoader(true);
      const res = await fetchProductosAdmin({ modo, userId, esAdmin, search, page, limit: LIMIT });
      setLoader(false);
      setProductos((prev) => {
        const base = reemplazar ? [] : prev;
        const existentes = new Set(base.map((p) => p.id));
        return [...base, ...res.data.filter((p) => !existentes.has(p.id))];
      });
      setNotEmptyPost(res.data.length > 0);
      setPage(page);
    },
    [modo, userId, esAdmin],
  );

  useEffect(() => {
    cargar(0, true, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  function buscar() {
    cargar(0, true, busqueda);
  }

  async function eliminar(id: number) {
    if (!window.confirm('Deseas Eliminar Dato')) return;
    const ok = await eliminarProducto(id);
    if (!ok) return mostrar('Error de servidor');
    setProductos((prev) => prev.filter((p) => p.id !== id));
    mostrar('Eliminado');
  }

  async function duplicar(id: number) {
    if (!window.confirm('¿Deseas duplicar este producto?')) return;
    setDuplicando(id);
    const nuevoId = await duplicarProducto(id);
    setDuplicando(null);
    if (!nuevoId) return mostrar('Problemas actualizar pagina...');
    mostrar('Duplicado exitoso');
    cargar(0, true, busqueda);
    onEditar(nuevoId);
  }

  async function toggleActivar(row: ProductoAdminRow, checked: boolean) {
    if (!window.confirm('¿Deseas cambiar de estado este producto?')) return;
    if (!checked) return; // el original solo activa, nunca desactiva desde este checkbox
    const ok = await activarProducto(row.id);
    if (!ok) return mostrar('Error pro_estado');
    setProductos((prev) => prev.filter((p) => p.id !== row.id));
    mostrar('Actualizado pro_estado');
  }

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          placeholder="Buscar Producto"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button onClick={buscar} disabled={cargando} className="rounded bg-[#0d6efd] px-3 py-2 text-sm text-white disabled:opacity-60">
          Buscar
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {cargando ? (
          <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="py-2 pr-3">Acciones</th>
                <th className="py-2 pr-3">Foto</th>
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Cantidades</th>
                <th className="py-2 pr-3">Precio</th>
                <th className="py-2 pr-3">Categoría</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Creado</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => onEditar(p.id)} className="rounded bg-[#0d6efd] px-2 py-1 text-xs text-white">
                        <Eye className="h-3 w-3" />
                      </button>
                      <button onClick={() => eliminar(p.id)} className="rounded bg-[#dc3545] px-2 py-1 text-xs text-white">
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <button onClick={() => duplicar(p.id)} disabled={duplicando === p.id} className="flex items-center gap-1 rounded bg-[#ffc107] px-2 py-1 text-xs text-gray-900 disabled:opacity-60">
                        <Copy className="h-3 w-3" /> Duplicar
                      </button>
                      {modo === 'porActivar' && esAdmin && (
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" onChange={(e) => toggleActivar(p, e.target.checked)} /> Activar
                        </label>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
                    <img src={p.foto || '/assets/noimagen.jpg'} alt="" className="h-12 w-12 rounded object-cover" />
                  </td>
                  <td className="py-2 pr-3">{p.nombre}</td>
                  <td className="py-2 pr-3">{p.codigo}</td>
                  <td className="py-2 pr-3">{p.cantidadTallas}</td>
                  <td className="py-2 pr-3">$ {(p.precio || 0).toLocaleString('es-CO')} COP</td>
                  <td className="py-2 pr-3">{p.categoriaNombre || '—'}</td>
                  <td className="py-2 pr-3">{ESTADO_LABEL[p.estado] || '—'}</td>
                  <td className="py-2 pr-3 text-xs">{new Date(p.fecha).toLocaleString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!cargando && productos.length === 0 && <p className="py-10 text-center text-gray-500">No hay productos para mostrar.</p>}
      </div>

      {!cargando && notEmptyPost && productos.length > 0 && (
        <div className="mt-4 text-center">
          <button onClick={() => cargar(page + 1, false, busqueda)} disabled={cargandoMas} className="text-sm font-medium text-[#0d6efd] hover:underline disabled:opacity-60">
            {cargandoMas ? 'Cargando…' : 'Ver más'}
          </button>
        </div>
      )}

      <Toast mensaje={mensaje} />
    </div>
  );
}
