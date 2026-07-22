'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto } from '@/lib/usuarios';
import {
  fetchSiteConfig,
  guardarSiteConfig,
  fetchBannersAdmin,
  subirImagenBanner,
  crearBannerImagen,
  actualizarBannerImagen,
  eliminarBannerImagen,
  type SiteConfigForm,
  type BannerImagen,
} from '@/lib/adminConfig';
import { useToast, Toast } from '@/components/Toast';

// Port de ConfiguracionComponent (Angular, "/config/configuracion"). "Numero de celular de
// Pedidos/Retiros" se omiten: estaban comentados en el HTML original, nunca se mostraron ni
// guardaron realmente.
//
// Bug real de seguridad encontrado y corregido: sin chequeo de rol. Se agrega el mismo chequeo de
// /config/usuarios.
//
// Banners de imagen (pedido explicito del usuario 2026-07-22, ver adminConfig.ts): reemplaza el
// CRUD viejo de banners de solo texto -- el usuario ya trae sus propias imagenes con las medidas
// correctas, se muestran como carrusel arriba de /articulo.

export default function ConfiguracionPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-autorizado'>('revisando');
  const [data, setData] = useState<SiteConfigForm | null>(null);
  const [banners, setBanners] = useState<BannerImagen[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      const [config, listaBanners] = await Promise.all([fetchSiteConfig(), fetchBannersAdmin()]);
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

  async function subirBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSubiendo(true);
    const url = await subirImagenBanner(file);
    if (url) {
      await crearBannerImagen(url, banners.length);
      setBanners(await fetchBannersAdmin());
      mostrar('Banner agregado');
    } else {
      mostrar('Error al subir la imagen');
    }
    setSubiendo(false);
  }

  function actualizarLocal(idx: number, patch: Partial<BannerImagen>) {
    setBanners((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  async function guardarLink(banner: BannerImagen) {
    const ok = await actualizarBannerImagen(banner.id, { linkUrl: banner.linkUrl || undefined });
    mostrar(ok ? 'Link guardado' : 'Error de servidor');
  }

  async function toggleActivo(banner: BannerImagen) {
    const ok = await actualizarBannerImagen(banner.id, { active: !banner.active });
    if (ok) setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, active: !b.active } : b)));
  }

  async function mover(idx: number, direccion: -1 | 1) {
    const otro = idx + direccion;
    if (otro < 0 || otro >= banners.length) return;
    const a = banners[idx];
    const b = banners[otro];
    await Promise.all([
      actualizarBannerImagen(a.id, { sortOrder: b.sortOrder }),
      actualizarBannerImagen(b.id, { sortOrder: a.sortOrder }),
    ]);
    setBanners(await fetchBannersAdmin());
  }

  async function eliminar(id: number) {
    if (!window.confirm('¿Eliminar este banner?')) return;
    const ok = await eliminarBannerImagen(id);
    if (ok) setBanners((prev) => prev.filter((b) => b.id !== id));
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
          {/* Pedido explicito del usuario 2026-07-19: numero de WhatsApp de la empresa que recibe un
              aviso cada vez que alguien se registra (ver notificarRegistroWhatsapp en adminConfig.ts). */}
          <label className="mb-1 block text-xs font-medium text-gray-700">Numero de WhatsApp para avisos de nuevos registros</label>
          <input
            value={data.cdRegistro}
            onChange={(e) => setCampo('cdRegistro', e.target.value)}
            placeholder="Ej: 3001234567 (sin indicativo 57)"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          {/* Pedido explicito del usuario 2026-07-19: numero de WhatsApp que recibe el aviso cada
              vez que alguien paga el curso Acelerador (ver notificarPagoAceleradorWhatsapp en
              adminConfig.ts). */}
          <label className="mb-1 block text-xs font-medium text-gray-700">Numero de WhatsApp para avisos de pago del curso Acelerador</label>
          <input
            value={data.cdAcelerador}
            onChange={(e) => setCampo('cdAcelerador', e.target.value)}
            placeholder="Ej: 3001234567 (sin indicativo 57)"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
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

      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800">Banners de imagen (arriba de Productos/Bodegas)</h4>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={subirBanner} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={subiendo}
            className="rounded bg-[#0d6efd] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {subiendo ? 'Subiendo…' : 'Subir banner'}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">Sube la imagen con las medidas que ya tengas listas. El orden de abajo hacia arriba/abajo define el orden del carrusel.</p>

      <div className="mt-4 space-y-3">
        {banners.map((banner, idx) => (
          <div key={banner.id} className="flex flex-col gap-3 rounded-lg border border-gray-100 p-3 shadow-sm sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- Storage, tamaño variable */}
            <img src={banner.imageUrl} alt="" className="h-20 w-36 shrink-0 rounded object-cover" />
            <div className="flex-1">
              <input
                value={banner.linkUrl || ''}
                onChange={(e) => actualizarLocal(idx, { linkUrl: e.target.value })}
                onBlur={() => guardarLink(banner)}
                placeholder="Link al hacer click (opcional, ej: https://wa.me/57... o /listproduct/categoria/1)"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => toggleActivo(banner)} className={`rounded-full px-2 py-1 text-xs font-semibold ${banner.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {banner.active ? 'Activo' : 'Inactivo'}
              </button>
              <button onClick={() => mover(idx, -1)} disabled={idx === 0} className="rounded bg-gray-100 p-1.5 text-gray-600 disabled:opacity-30">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button onClick={() => mover(idx, 1)} disabled={idx === banners.length - 1} className="rounded bg-gray-100 p-1.5 text-gray-600 disabled:opacity-30">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button onClick={() => eliminar(banner.id)} className="rounded bg-red-100 p-1.5 text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {banners.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No hay banners todavía.</p>}
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
