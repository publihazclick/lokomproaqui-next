'use client';

import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import {
  crearCatalogo,
  actualizarCatalogo,
  fetchCatalogoItems,
  agregarProductoACatalogo,
  agregarFotoACatalogo,
  eliminarCatalogoItem,
  type CatalogoRow,
  type CatalogoItem,
} from '@/lib/catalogoAdmin';
import { fetchProductosAdmin, type ProductoAdminRow } from '@/lib/productosAdmin';
import { subirArchivoPublico } from '@/lib/perfil';
import { formatCOP } from '@/lib/cartStore';
import { useToast, Toast } from './Toast';

// Port de FormcatalogoComponent (Angular): crear/editar un catalogo + asignarle productos (picker
// con checkbox sobre el listado de productos activos) o fotos sueltas (sin producto asociado).

export function FormCatalogoModal({ catalogo, onClose, onGuardado }: { catalogo: CatalogoRow | null; onClose: () => void; onGuardado: () => void }) {
  const { mensaje, mostrar } = useToast();
  const [id, setId] = useState<number | null>(catalogo?.id ?? null);
  const [titulo, setTitulo] = useState(catalogo?.titulo || '');
  const [estado, setEstado] = useState(catalogo?.estado ?? 1);
  const [precio, setPrecio] = useState(catalogo?.precio?.toString() || '');
  const [precioMayor, setPrecioMayor] = useState(catalogo?.precioMayor?.toString() || '');
  const [guardando, setGuardando] = useState(false);

  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [productos, setProductos] = useState<ProductoAdminRow[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  useEffect(() => {
    fetchProductosAdmin({ modo: 'mios', userId: '', esAdmin: true, search: busqueda, page: 0, limit: 30 }).then((res) => setProductos(res.data));
  }, [busqueda]);

  useEffect(() => {
    if (id) fetchCatalogoItems(id).then(setItems);
  }, [id]);

  async function guardarDatos(): Promise<number | null> {
    if (!titulo.trim()) {
      mostrar('El título es obligatorio');
      return null;
    }
    setGuardando(true);
    const data = { titulo: titulo.trim(), estado, precio: precio ? Number(precio) : null, precioMayor: precioMayor ? Number(precioMayor) : null };
    let ok = false;
    let newId = id;
    if (id) {
      ok = await actualizarCatalogo(id, data);
    } else {
      newId = await crearCatalogo(data);
      ok = newId != null;
      if (newId) setId(newId);
    }
    setGuardando(false);
    if (!ok) {
      mostrar('Error de servidor');
      return null;
    }
    return newId;
  }

  async function guardar() {
    const savedId = await guardarDatos();
    if (savedId) {
      mostrar(id ? 'Actualizado' : 'Exitoso');
      onGuardado();
    }
  }

  async function toggleProducto(prod: ProductoAdminRow, yaAgregado: CatalogoItem | undefined) {
    let catalogoId = id;
    if (!catalogoId) catalogoId = await guardarDatos();
    if (!catalogoId) return;
    if (yaAgregado) {
      await eliminarCatalogoItem(yaAgregado.id);
      setItems((prev) => prev.filter((i) => i.id !== yaAgregado.id));
      mostrar('Eliminado');
    } else {
      const itemId = await agregarProductoACatalogo(catalogoId, prod.id);
      if (itemId) {
        setItems((prev) => [...prev, { id: itemId, productoId: prod.id, nombre: prod.nombre, foto: prod.foto }]);
        mostrar('Agregado');
      }
    }
  }

  async function subirFotoSuelta(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    let catalogoId = id;
    if (!catalogoId) catalogoId = await guardarDatos();
    if (!catalogoId) return;
    setSubiendoFoto(true);
    const url = await subirArchivoPublico(file);
    if (url) {
      const itemId = await agregarFotoACatalogo(catalogoId, url);
      if (itemId) setItems((prev) => [...prev, { id: itemId, productoId: null, nombre: null, foto: url }]);
    } else {
      mostrar('Error subiendo la foto');
    }
    setSubiendoFoto(false);
    e.target.value = '';
  }

  async function quitarItem(item: CatalogoItem) {
    await eliminarCatalogoItem(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    mostrar('Eliminado');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">{catalogo ? 'Actualizar' : 'Crear'} Catálogo</h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Estado</label>
            <select value={estado} onChange={(e) => setEstado(Number(e.target.value))} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
              <option value={1}>Activo</option>
              <option value={0}>Inactivo</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Precio</label>
            <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Precio Mayorista</label>
            <input type="number" value={precioMayor} onChange={(e) => setPrecioMayor(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button onClick={guardar} disabled={guardando} className="rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {guardando ? 'Guardando…' : catalogo ? 'Actualizar' : 'Crear'}
          </button>
        </div>

        <hr className="my-4" />

        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">Productos en el catálogo ({items.length})</h4>
          <label className="cursor-pointer rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
            {subiendoFoto ? 'Subiendo…' : 'Agregar foto suelta'}
            <input type="file" accept="image/*" className="hidden" disabled={subiendoFoto} onChange={subirFotoSuelta} />
          </label>
        </div>

        {items.length > 0 && (
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {items.map((item) => (
              <div key={item.id} className="relative rounded border border-gray-100 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de producto/foto del catalogo */}
                <img src={item.foto || '/assets/noimagen.jpg'} alt="" className="h-16 w-full rounded object-cover" />
                {item.nombre && <p className="mt-1 truncate text-[10px] text-gray-600">{item.nombre}</p>}
                <button onClick={() => quitarItem(item)} className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto para agregar…"
          className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
          {productos.map((prod) => {
            const yaAgregado = items.find((i) => i.productoId === prod.id);
            return (
              <button
                key={prod.id}
                onClick={() => toggleProducto(prod, yaAgregado)}
                className={`rounded border p-1 text-left ${yaAgregado ? 'border-green-500 bg-green-50' : 'border-gray-100'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de producto en el picker */}
                <img src={prod.foto || '/assets/noimagen.jpg'} alt="" className="h-16 w-full rounded object-cover" />
                <p className="mt-1 truncate text-[10px] text-gray-700">{prod.nombre}</p>
                <p className="text-[10px] text-gray-500">$ {formatCOP(prod.precio)}</p>
              </button>
            );
          })}
        </div>
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
