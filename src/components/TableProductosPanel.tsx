'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Trash2, Copy, Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchProductosAdmin, eliminarProducto, duplicarProducto, activarProducto, type ProductoAdminRow, type ModoListaProductos } from '@/lib/productosAdmin';
import { useToast, Toast } from '@/components/Toast';

// Port de TableProductComponent (Angular) -- tabla compartida por las 3 pestañas de
// /config/productos. Ver src/lib/productosAdmin.ts para los 2 bugs reales corregidos (filtro roto
// de la pestaña "Productos" y checkbox "Activar" que leia el valor viejo).
//
// Pedido explicito del usuario 2026-07-25: paginacion real "Items per page / X of Y / < >" igual a
// la captura de referencia, en vez del "Ver mas" -- fetchProductosAdmin ya devolvia `count` exacto
// (Supabase `{ count: 'exact' }`), simplemente no se usaba.

const ESTADO_LABEL: Record<number, string> = { 0: 'Activo', 1: 'Eliminado', 3: 'Pendiente' };
const OPCIONES_POR_PAGINA = [10, 25, 50];

interface TableProductosPanelProps {
  modo: ModoListaProductos;
  userId: string;
  esAdmin: boolean;
  onEditar: (id: number) => void;
  // Pedido explicito del usuario 2026-07-24: el boton para crear producto va como circulo azul "+"
  // junto a la barra de busqueda (igual al diseño de referencia), no arriba en un banner aparte.
  onCrear?: () => void;
}

export function TableProductosPanel({ modo, userId, esAdmin, onEditar, onCrear }: TableProductosPanelProps) {
  const { mensaje, mostrar } = useToast();
  const [productos, setProductos] = useState<ProductoAdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(0);
  const [porPagina, setPorPagina] = useState(10);
  const [cargando, setCargando] = useState(false);
  const [duplicando, setDuplicando] = useState<number | null>(null);

  const cargar = useCallback(
    async (page: number, search: string, limit: number) => {
      setCargando(true);
      const res = await fetchProductosAdmin({ modo, userId, esAdmin, search, page, limit });
      setCargando(false);
      setProductos(res.data);
      setTotal(res.count);
      setPage(page);
    },
    [modo, userId, esAdmin],
  );

  useEffect(() => {
    cargar(0, '', porPagina);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  function buscar() {
    cargar(0, busqueda, porPagina);
  }

  function cambiarPorPagina(valor: number) {
    setPorPagina(valor);
    cargar(0, busqueda, valor);
  }

  async function eliminar(id: number) {
    if (!window.confirm('Deseas Eliminar Dato')) return;
    const ok = await eliminarProducto(id);
    if (!ok) return mostrar('Error de servidor');
    mostrar('Eliminado');
    cargar(page, busqueda, porPagina);
  }

  async function duplicar(id: number) {
    if (!window.confirm('¿Deseas duplicar este producto?')) return;
    setDuplicando(id);
    const nuevoId = await duplicarProducto(id);
    setDuplicando(null);
    if (!nuevoId) return mostrar('Problemas actualizar pagina...');
    mostrar('Duplicado exitoso');
    cargar(0, busqueda, porPagina);
    onEditar(nuevoId);
  }

  async function toggleActivar(row: ProductoAdminRow, checked: boolean) {
    if (!window.confirm('¿Deseas cambiar de estado este producto?')) return;
    if (!checked) return; // el original solo activa, nunca desactiva desde este checkbox
    const ok = await activarProducto(row.id);
    if (!ok) return mostrar('Error pro_estado');
    mostrar('Actualizado pro_estado');
    cargar(page, busqueda, porPagina);
  }

  const desde = total === 0 ? 0 : page * porPagina + 1;
  const hasta = Math.min((page + 1) * porPagina, total);

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Buscar Producto"
            className="w-full rounded border border-gray-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        {onCrear && (
          <button
            onClick={onCrear}
            aria-label="Nuevo producto"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white hover:opacity-90"
            style={{ background: '#0d6efd' }}
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
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

      <div className="mt-4 flex flex-wrap items-center justify-end gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span>Items per page:</span>
          <select
            value={porPagina}
            onChange={(e) => cambiarPorPagina(Number(e.target.value))}
            className="rounded border border-gray-300 px-1.5 py-1 text-sm"
          >
            {OPCIONES_POR_PAGINA.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <span>
          {desde === hasta ? desde : `${desde}-${hasta}`} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => cargar(page - 1, busqueda, porPagina)}
            disabled={page === 0 || cargando}
            aria-label="Anterior"
            className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30 hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => cargar(page + 1, busqueda, porPagina)}
            disabled={hasta >= total || cargando}
            aria-label="Siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30 hover:bg-gray-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
