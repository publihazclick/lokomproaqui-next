'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto } from '@/lib/usuarios';
import { fetchUsuariosAdmin, fetchRolesAsignables, actualizarUsuarioAdmin, type UsuarioAdminRow, type RolOpcion } from '@/lib/usuariosAdmin';
import { FormUsuarioModal } from '@/components/FormUsuarioModal';
import { useToast, Toast } from '@/components/Toast';

// Port de ProvedoresComponent (Angular, panel admin "Proveedores" -- directorio de usuarios con
// rol proveedor). Mismo bug de siempre: `UsuariosService.get()` nunca soporto filtrar por rol
// (`where.rolName`), asi que en produccion HOY esta pantalla en realidad muestra TODOS los
// usuarios, no solo proveedores. Se corrige filtrando de verdad por `roles.name = 'proveedor'`.
// Reusa el mismo directorio/formulario que /config/usuarios (FormUsuarioModal), ya migrado.

const LIMIT = 20;

export default function ProvedoresPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [usuarios, setUsuarios] = useState<UsuarioAdminRow[]>([]);
  const [roles, setRoles] = useState<RolOpcion[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const cargar = useCallback(async (page: number, reemplazar: boolean, search: string) => {
    const setLoader = page === 0 ? setCargando : setCargandoMas;
    setLoader(true);
    const res = await fetchUsuariosAdmin({ search, soloRol: 'proveedor', page, limit: LIMIT });
    setLoader(false);
    setUsuarios((prev) => {
      const base = reemplazar ? [] : prev;
      const existentes = new Set(base.map((u) => u.id));
      return [...base, ...res.data.filter((u) => !existentes.has(u.id))];
    });
    setNotEmptyPost(res.data.length > 0);
    setPage(page);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      await fetchDataUserCompleto(sessionData.session.user.id);
      setEstado('listo');
      setRoles(await fetchRolesAsignables());
      cargar(0, true, '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar() {
    cargar(0, true, busqueda);
  }

  async function desactivar(id: string) {
    if (!window.confirm('Deseas Eliminar Dato')) return;
    const ok = await actualizarUsuarioAdmin(id, { activo: false });
    if (!ok) return mostrar('Error de servidor');
    setUsuarios((prev) => prev.filter((u) => u.id !== id));
    mostrar('Eliminado');
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1140px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Proveedores</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Buscar Proveedor"
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
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-3">Acciones</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Teléfono</th>
                  <th className="py-2 pr-3">Fecha Registro</th>
                  <th className="py-2 pr-3">Activo</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <div className="flex gap-1">
                        <button onClick={() => setEditando(u.id)} className="rounded bg-[#0d6efd] px-2 py-1 text-xs text-white">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => desactivar(u.id)} className="rounded bg-[#dc3545] px-2 py-1 text-xs text-white">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2 pr-3">{u.nombre}</td>
                    <td className="py-2 pr-3">{u.telefono || '—'}</td>
                    <td className="py-2 pr-3 text-xs">{new Date(u.fechaRegistro).toLocaleDateString('es-CO')}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!cargando && usuarios.length === 0 && <p className="py-10 text-center text-gray-500">No hay proveedores para mostrar.</p>}
        </div>

        {!cargando && notEmptyPost && usuarios.length > 0 && (
          <div className="mt-4 text-center">
            <button onClick={() => cargar(page + 1, false, busqueda)} disabled={cargandoMas} className="text-sm font-medium text-[#0d6efd] hover:underline disabled:opacity-60">
              {cargandoMas ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        )}
      </div>

      <Toast mensaje={mensaje} />

      {editando && (
        <FormUsuarioModal
          userId={editando}
          roles={roles}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            cargar(0, true, busqueda);
          }}
        />
      )}
    </div>
  );
}
