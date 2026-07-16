'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto } from '@/lib/usuarios';
import { fetchSiteConfig, guardarSiteConfig, fetchBanners, crearBanner, actualizarBanner, eliminarBanner, type SiteConfigForm, type BannerRow } from '@/lib/adminConfig';
import { useToast, Toast } from '@/components/Toast';

// Port de ConfiguracionComponent (Angular, "/config/configuracion"). Ver src/lib/adminConfig.ts
// sobre los 2 bugs reales corregidos (filtro de banners ignorado, titulo de banner que nunca se
// guardaba al editar). "Numero de celular de Pedidos/Retiros" se omiten: estaban comentados en el
// HTML original, nunca se mostraron ni guardaron realmente.
//
// Bug real de seguridad encontrado y corregido: sin chequeo de rol. Se agrega el mismo chequeo de
// /config/usuarios.

interface BannerLocal extends BannerRow {
  check?: boolean;
  esNuevo?: boolean;
}

export default function ConfiguracionPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-autorizado'>('revisando');
  const [data, setData] = useState<SiteConfigForm | null>(null);
  const [banners, setBanners] = useState<BannerLocal[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      if (usuario.rolname !== 'administrador') {
        setEstado('no-autorizado');
        return;
      }
      const [config, listaBanners] = await Promise.all([fetchSiteConfig(), fetchBanners()]);
      setData(config);
      setBanners(listaBanners);
      setEstado('listo');
    });
  }, []);

  function setCampo(key: keyof SiteConfigForm, value: string) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function guardar() {
    if (!data) return;
    setGuardando(true);
    const ok = await guardarSiteConfig(data);
    setGuardando(false);
    mostrar(ok ? 'Actualizado...' : 'Erro al actualizar');
    if (ok) setData(await fetchSiteConfig());
  }

  function nuevoComentario() {
    setBanners((prev) => [{ id: -Date.now(), titulo: '', descripcion: '', esNuevo: true }, ...prev]);
  }

  function actualizarLocal(idx: number, patch: Partial<BannerLocal>) {
    setBanners((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  async function crearBanners() {
    const nuevos = banners.filter((b) => b.esNuevo);
    for (const banner of nuevos) {
      const nuevoId = await crearBanner(banner.titulo || '', banner.descripcion || '');
      if (nuevoId) mostrar('Creando...');
    }
    setBanners(await fetchBanners());
  }

  async function guardarBanner(banner: BannerLocal) {
    const ok = await actualizarBanner(banner.id, banner.titulo || '', banner.descripcion || '');
    mostrar(ok ? 'Actualizado' : 'Error de servidor');
  }

  async function eliminarBanners() {
    const marcados = banners.filter((b) => b.check && !b.esNuevo);
    for (const banner of marcados) await eliminarBanner(banner.id);
    setBanners((prev) => prev.filter((b) => !(b.check && !b.esNuevo)));
    mostrar('Eliminado...');
  }

  if (estado === 'no-autorizado') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-gray-500">Esta sección es solo para administradores.</p>
      </div>
    );
  }

  if (estado === 'revisando' || !data) return null;

  return (
    <div className="mx-auto w-full max-w-[900px] px-3 py-6">
      <h3 className="text-center text-2xl font-bold text-gray-800">Configuraciones</h3>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Numero de celular de informacion</label>
          <input value={data.clInformacion} onChange={(e) => setCampo('clInformacion', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Numero de celular de Ventas</label>
          <input value={data.cdVentas} onChange={(e) => setCampo('cdVentas', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Video gancho 1 (link de YouTube, no listado)</label>
          <input
            value={data.aceleradorVideoGancho1}
            onChange={(e) => setCampo('aceleradorVideoGancho1', e.target.value)}
            placeholder="Pega el link de YouTube o solo el ID"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Video gancho 2 (link de YouTube, no listado)</label>
          <input
            value={data.aceleradorVideoGancho2}
            onChange={(e) => setCampo('aceleradorVideoGancho2', e.target.value)}
            placeholder="Pega el link de YouTube o solo el ID"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">Al guardar se convierte automaticamente al ID del video.</p>

      <div className="mt-4">
        <button onClick={guardar} disabled={guardando} className="rounded bg-green-600 px-6 py-2 text-sm font-medium text-white disabled:opacity-60">
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <hr className="my-8" />

      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={nuevoComentario} className="rounded bg-[#0d6efd] px-3 py-1.5 text-sm font-medium text-white">
          +
        </button>
        <button onClick={crearBanners} className="rounded bg-[#0d6efd] px-3 py-1.5 text-sm font-medium text-white">
          Crear banner
        </button>
        <button onClick={eliminarBanners} className="rounded bg-[#dc3545] px-3 py-1.5 text-sm font-medium text-white">
          Eliminar banner
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {banners.map((banner, idx) => (
          <div key={banner.id} className="rounded-lg border border-gray-100 p-3 shadow-sm">
            <input
              value={banner.titulo || ''}
              onChange={(e) => actualizarLocal(idx, { titulo: e.target.value })}
              placeholder="Titulo"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              value={banner.descripcion || ''}
              onChange={(e) => actualizarLocal(idx, { descripcion: e.target.value })}
              placeholder="Descripcion"
              rows={3}
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={!!banner.check} onChange={(e) => actualizarLocal(idx, { check: e.target.checked })} />
                eliminar
              </label>
              {!banner.esNuevo && (
                <button onClick={() => guardarBanner(banner)} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                  Guardar
                </button>
              )}
            </div>
          </div>
        ))}
        {banners.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No hay banners todavía.</p>}
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
