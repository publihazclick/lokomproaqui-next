'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchCatalogos, eliminarCatalogo, type CatalogoRow } from '@/lib/catalogoAdmin';
import { FormCatalogoModal } from '@/components/FormCatalogoModal';
import { useToast, Toast } from '@/components/Toast';

// Port de CatalogoComponent (Angular, "/config/catalago") -- catalogos publicos armados a mano.
// CatalogoService ya estaba bien implementado (sin bugs), se porta directo. Ver
// src/lib/catalogoAdmin.ts sobre el link "Copiar" (apunta a /publico/:id, pagina publica que aun
// no se porto -- pieza separada).

const URL_CATALOGO = 'https://lokomproaqui.com/publico/';

export default function CatalagoPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [catalogos, setCatalogos] = useState<CatalogoRow[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState<'nuevo' | CatalogoRow | null>(null);

  async function cargar() {
    setCatalogos(await fetchCatalogos(busqueda));
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      await cargar();
      setEstado('listo');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (estado === 'listo') cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  function copiarLink(row: CatalogoRow) {
    navigator.clipboard.writeText(URL_CATALOGO + row.id);
    mostrar('Copiado: ' + URL_CATALOGO + row.id);
  }

  async function eliminar(row: CatalogoRow) {
    if (!window.confirm('Deseas Eliminar Dato')) return;
    const ok = await eliminarCatalogo(row.id);
    if (!ok) {
      mostrar('Error de servidor');
      return;
    }
    setCatalogos((prev) => prev.filter((c) => c.id !== row.id));
    mostrar('Eliminado');
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Catálogos</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar catálogo…"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={() => setModalAbierto('nuevo')} className="flex items-center gap-1 rounded bg-[#0d6efd] px-3 py-2 text-sm font-medium text-white">
            <Plus className="h-4 w-4" /> Crear
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="py-2 pr-3">Acciones</th>
                <th className="py-2 pr-3">Título</th>
                <th className="py-2 pr-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {catalogos.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="space-x-2 py-2 pr-3">
                    <button onClick={() => setModalAbierto(row)} className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                      Editar
                    </button>
                    <button onClick={() => copiarLink(row)} className="inline-flex items-center gap-1 rounded bg-[#0dcaf0] px-2 py-1 text-xs font-medium text-white">
                      <LinkIcon className="h-3 w-3" /> Copiar
                    </button>
                    <button onClick={() => eliminar(row)} className="inline-flex items-center gap-1 rounded bg-[#dc3545] px-2 py-1 text-xs font-medium text-white">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                  <td className="py-2 pr-3">{row.titulo}</td>
                  <td className="py-2 pr-3">{row.estado === 1 ? 'Activo' : 'Inactivo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {catalogos.length === 0 && <p className="py-10 text-center text-gray-500">No hay catálogos para mostrar.</p>}
        </div>
      </div>

      <Toast mensaje={mensaje} />

      {modalAbierto && (
        <FormCatalogoModal
          catalogo={modalAbierto === 'nuevo' ? null : modalAbierto}
          onClose={() => setModalAbierto(null)}
          onGuardado={() => {
            setModalAbierto(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}
