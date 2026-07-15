'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchUsuarioAdminDetalle, actualizarUsuarioAdmin, type RolOpcion } from '@/lib/usuariosAdmin';
import { useToast, Toast } from '@/components/Toast';

// Port simplificado de FormusuariosComponent (Angular) -- ver src/lib/usuariosAdmin.ts para el
// detalle de los campos que NO se portan (nunca se guardaban en el original tampoco) y el bug real
// del selector de rol, que se conecta de verdad aca.

interface FormUsuarioModalProps {
  userId: string;
  roles: RolOpcion[];
  onClose: () => void;
  onGuardado: () => void;
}

export function FormUsuarioModal({ userId, roles, onClose, onGuardado }: FormUsuarioModalProps) {
  const { mensaje, mostrar } = useToast();
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [nombreTienda, setNombreTienda] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [roleId, setRoleId] = useState<number | null>(null);
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetchUsuarioAdminDetalle(userId).then((d) => {
      if (d) {
        setNombre(d.nombre || '');
        setApellido(d.apellido || '');
        setNombreTienda(d.nombreTienda || '');
        setDocumento(d.documento || '');
        setTelefono(d.telefono || '');
        setDireccion(d.direccion || '');
        setRoleId(d.roleId);
        setActivo(d.activo);
      }
      setCargando(false);
    });
  }, [userId]);

  async function guardar() {
    setGuardando(true);
    const ok = await actualizarUsuarioAdmin(userId, {
      nombre,
      apellido,
      nombreTienda,
      documento,
      telefono,
      direccion,
      roleId: roleId ?? undefined,
      activo,
    });
    setGuardando(false);
    if (!ok) return mostrar('Error de servidor');
    mostrar('Actualizado');
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h4 className="text-base font-bold text-gray-900">Actualizar Usuario</h4>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {cargando ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">Cargando…</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Apellido</label>
              <input value={apellido} onChange={(e) => setApellido(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Username / nombre de tienda</label>
              <input value={nombreTienda} onChange={(e) => setNombreTienda(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">N° Documento</label>
              <input value={documento} onChange={(e) => setDocumento(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Teléfono</label>
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Dirección</label>
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Perfil (rol)</label>
              <select value={roleId ?? ''} onChange={(e) => setRoleId(Number(e.target.value))} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Estado</label>
              <select value={activo ? '1' : '0'} onChange={(e) => setActivo(e.target.value === '1')} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-gray-600">
            Cerrar
          </button>
          <button onClick={guardar} disabled={cargando || guardando} className="rounded bg-[#0d6efd] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Actualizar Cambios'}
          </button>
        </div>
      </div>
      <Toast mensaje={mensaje} />
    </div>
  );
}
