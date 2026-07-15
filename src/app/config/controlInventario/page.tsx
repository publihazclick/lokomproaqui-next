'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchProductos, type ProductoLegacy } from '@/lib/productos';
import { fetchMovimientos, eliminarMovimiento, crearMovimiento, type MovimientoInventario, type ItemNuevoMovimiento } from '@/lib/controlInventario';
import { useToast, Toast } from '@/components/Toast';

// Port de ControlInventarioComponent (Angular, "Entrada / Salida Inventario"). Ver
// src/lib/controlInventario.ts para el bug real encontrado y corregido: el original perdia todos
// los productos/cantidades seleccionados al guardar (el payload no coincidia con lo que el
// servicio esperaba, y nunca se llamaba al metodo que crea los items).

const TIPOS = [
  { value: 1, label: 'Entrada' },
  { value: 2, label: 'Salida' },
  { value: 3, label: 'Devolución' },
];

interface ItemSeleccionado extends ItemNuevoMovimiento {
  producto: ProductoLegacy;
  cantidad: number;
}

export default function ControlInventarioPage() {
  const { mensaje, mostrar } = useToast();

  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const esAdmin = dataUser?.rolname === 'administrador';

  const [tab, setTab] = useState<'lista' | 'crear'>('lista');
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  const [tipoEntrada, setTipoEntrada] = useState(1);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState<ProductoLegacy[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<ItemSeleccionado[]>([]);
  const [guardando, setGuardando] = useState(false);

  const cargarLista = useCallback(async (uid: string, admin: boolean) => {
    setCargandoLista(true);
    setMovimientos(await fetchMovimientos(uid, admin));
    setCargandoLista(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      setEstado('listo');
      cargarLista(usuario.id, usuario.rolname === 'administrador');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscarProductos() {
    if (!dataUser) return;
    setBuscando(true);
    const res = await fetchProductos({ ownerProfileId: esAdmin ? undefined : dataUser.id, search: busqueda, page: 0, limit: 30 });
    setBuscando(false);
    setProductos(res.data);
  }

  function agregarProducto(p: ProductoLegacy) {
    setSeleccionados((prev) => {
      if (prev.some((s) => s.productId === p.id)) return prev;
      return [...prev, { productId: p.id, producto: p, cantidad: 1 }];
    });
  }

  function quitarProducto(productId: number) {
    setSeleccionados((prev) => prev.filter((s) => s.productId !== productId));
  }

  function cambiarCantidad(productId: number, cantidad: number) {
    setSeleccionados((prev) => prev.map((s) => (s.productId === productId ? { ...s, cantidad } : s)));
  }

  async function guardar() {
    if (!dataUser) return;
    if (!seleccionados.length) {
      mostrar('Debes seleccionar al menos un producto');
      return;
    }
    setGuardando(true);
    const ok = await crearMovimiento({
      userId: dataUser.id,
      tipoEntrada,
      fecha,
      descripcion,
      items: seleccionados.map((s) => ({ productId: s.productId, cantidad: s.cantidad })),
    });
    setGuardando(false);
    if (!ok) {
      mostrar('Error de servidor');
      return;
    }
    mostrar('Guardado exitoso');
    setDescripcion('');
    setSeleccionados([]);
    setTab('lista');
    cargarLista(dataUser.id, esAdmin);
  }

  async function eliminar(id: number) {
    if (!window.confirm('Deseas Eliminar Dato')) return;
    const ok = await eliminarMovimiento(id);
    if (!ok) {
      mostrar('Error de servidor');
      return;
    }
    setMovimientos((prev) => prev.filter((m) => m.id !== id));
    mostrar('Eliminado');
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1140px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Entrada / Salida Inventario</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex gap-2 border-b border-gray-200">
          <button onClick={() => setTab('lista')} className={`px-4 py-2 text-sm font-semibold ${tab === 'lista' ? 'border-b-2 border-[#0d6efd] text-[#0d6efd]' : 'text-gray-500'}`}>
            Lista de movimientos
          </button>
          <button onClick={() => setTab('crear')} className={`px-4 py-2 text-sm font-semibold ${tab === 'crear' ? 'border-b-2 border-[#0d6efd] text-[#0d6efd]' : 'text-gray-500'}`}>
            Crear movimiento
          </button>
        </div>

        {tab === 'lista' && (
          <div className="mt-4">
            {cargandoLista ? (
              <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
            ) : movimientos.length === 0 ? (
              <p className="py-10 text-center text-gray-500">No hay movimientos registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Descripción</th>
                    <th className="py-2 pr-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium">{m.tipoLabel}</td>
                      <td className="py-2 pr-3">{new Date(m.fecha).toLocaleDateString('es-CO')}</td>
                      <td className="py-2 pr-3">{m.descripcion}</td>
                      <td className="py-2 pr-3">
                        <button onClick={() => eliminar(m.id)} className="flex items-center gap-1 rounded bg-[#dc3545] px-2 py-1 text-xs text-white">
                          <Trash2 className="h-3 w-3" /> Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'crear' && (
          <div className="mt-4 space-y-4">
            <div className="flex justify-end">
              <button onClick={guardar} disabled={guardando} className="rounded bg-[#198754] px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Tipo de Entrada</label>
                <select value={tipoEntrada} onChange={(e) => setTipoEntrada(Number(e.target.value))} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Observación</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <h5 className="mb-2 font-semibold text-gray-800">Buscar productos</h5>
              <div className="flex gap-2">
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscarProductos()}
                  placeholder="Buscar por código o nombre"
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <button onClick={buscarProductos} disabled={buscando} className="flex items-center gap-1 rounded bg-[#0d6efd] px-3 py-2 text-sm text-white disabled:opacity-60">
                  <Search className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {productos.map((p) => {
                  const yaElegido = seleccionados.some((s) => s.productId === p.id);
                  return (
                    <div key={p.id} className={`rounded-lg border p-2 text-center ${yaElegido ? 'border-[#0d6efd] bg-blue-50' : 'border-gray-200'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
                      <img src={p.foto} alt={p.pro_nombre} className="h-20 w-full rounded object-cover" />
                      <p className="mt-1 truncate text-xs font-medium">{p.pro_codigo}</p>
                      <button
                        onClick={() => (yaElegido ? quitarProducto(p.id) : agregarProducto(p))}
                        className={`mt-1 w-full rounded px-2 py-1 text-xs font-medium text-white ${yaElegido ? 'bg-[#dc3545]' : 'bg-[#0d6efd]'}`}
                      >
                        {yaElegido ? 'Quitar' : 'Seleccionar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h5 className="mb-2 font-semibold text-gray-800">Seleccionados ({seleccionados.length})</h5>
              {seleccionados.length === 0 ? (
                <p className="text-sm text-gray-500">Todavía no seleccionaste productos.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {seleccionados.map((s) => (
                    <div key={s.productId} className="rounded-lg border border-gray-200 p-2 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
                      <img src={s.producto.foto} alt={s.producto.pro_nombre} className="h-20 w-full rounded object-cover" />
                      <p className="mt-1 truncate text-xs font-medium">{s.producto.pro_codigo}</p>
                      <label className="mt-1 block text-[11px] text-gray-500">Cantidad</label>
                      <input
                        type="number"
                        min={1}
                        value={s.cantidad}
                        onChange={(e) => cambiarCantidad(s.productId, Number(e.target.value))}
                        className="w-full rounded border border-gray-300 px-1 py-1 text-center text-xs"
                      />
                      <button onClick={() => quitarProducto(s.productId)} className="mt-1 w-full rounded bg-[#dc3545] px-2 py-1 text-xs text-white">
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
