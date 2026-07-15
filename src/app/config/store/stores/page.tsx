'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchTiendasProveedor, type TiendaProveedor } from '@/lib/bodega';
import { agregarTodosLosProductos } from '@/lib/verProveedor';
import { useToast, Toast } from '@/components/Toast';

// Port de StoreComponent (Angular, "/config/store/stores") -- directorio buscable de bodegas
// certificadas (rol proveedor). UsuariosService.getStore() ya estaba bien implementado, sin bugs.
// "Agregar Todos los Productos de Esta Bodega" reusa agregarTodosLosProductos (lib/verProveedor.ts,
// ya construido para /config/storeProductActivated).

const LIMIT = 24;

export default function StoresPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [tiendas, setTiendas] = useState<TiendaProveedor[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [agregandoId, setAgregandoId] = useState<string | null>(null);

  async function cargar(search: string, page: number, reemplazar: boolean) {
    const res = await fetchTiendasProveedor(search, page, LIMIT);
    setTiendas((prev) => {
      const base = reemplazar ? [] : prev;
      const existentes = new Set(base.map((t) => t.id));
      return [...base, ...res.data.filter((t) => !existentes.has(t.id))];
    });
    setNotEmptyPost(res.data.length > 0);
    setPage(page);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      setDataUser(await fetchDataUserCompleto(sessionData.session.user.id));
      await cargar('', 0, true);
      setEstado('listo');
    });
  }, []);

  function buscar() {
    cargar(busqueda, 0, true);
  }

  async function agregarTodos(tienda: TiendaProveedor) {
    if (!dataUser) return;
    if (!window.confirm('Deseas! Agregar Todos Los Productos de Esta Bodega')) return;
    setAgregandoId(tienda.id);
    const res = await agregarTodosLosProductos(dataUser.id, tienda.id);
    setAgregandoId(null);
    mostrar(res.message);
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Bodegas Certificadas</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Buscar por nombre, telefono, ciudad…"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={buscar} className="rounded bg-[#0d6efd] px-3 py-2 text-sm text-white">
            Buscar
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {tiendas.map((t) => (
            <div key={t.id} className="rounded-xl border border-gray-100 p-3 text-center shadow-sm">
              <a href={`/config/verProveedor/${t.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- foto de perfil (Supabase Storage) */}
                <img src={t.foto || '/assets/imagenes/todos.png'} alt="" className="mx-auto h-24 w-24 rounded-full object-cover" />
                <h6 className="mt-2 truncate text-sm font-semibold text-gray-800">{t.nombre}</h6>
                <p className="text-xs text-gray-500">{t.telefono}</p>
              </a>
              <button
                onClick={() => agregarTodos(t)}
                disabled={agregandoId === t.id}
                className="mt-2 w-full rounded-full bg-green-600 px-2 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
              >
                {agregandoId === t.id ? 'Agregando…' : 'Agregar Todos'}
              </button>
            </div>
          ))}
        </div>
        {tiendas.length === 0 && <p className="py-10 text-center text-gray-500">No hay bodegas para mostrar.</p>}

        {notEmptyPost && tiendas.length > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={async () => {
                setCargandoMas(true);
                await cargar(busqueda, page + 1, false);
                setCargandoMas(false);
              }}
              disabled={cargandoMas}
              className="text-sm font-medium text-[#0d6efd] hover:underline disabled:opacity-60"
            >
              {cargandoMas ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        )}
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
