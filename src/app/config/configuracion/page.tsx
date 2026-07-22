'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
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
  clasesPosicionBoton,
  POSICIONES_BOTON,
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
  const dragIdx = useRef<number | null>(null);

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

  // Pedido explicito del usuario 2026-07-22: subir varias imagenes de una sola vez (antes solo
  // dejaba elegir un archivo). Se suben una por una (no en paralelo, para no saturar Storage con
  // muchas subidas simultaneas si el admin elige 10+ fotos) y cada una se agrega al final del orden
  // actual.
  async function subirBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setSubiendo(true);
    let siguienteOrden = banners.length;
    let fallidos = 0;
    for (const file of files) {
      const url = await subirImagenBanner(file);
      if (url) {
        await crearBannerImagen(url, siguienteOrden);
        siguienteOrden++;
      } else {
        fallidos++;
      }
    }
    setBanners(await fetchBannersAdmin());
    mostrar(fallidos ? `${files.length - fallidos} banner(s) agregados, ${fallidos} fallaron` : 'Banner(s) agregados');
    setSubiendo(false);
  }

  function actualizarLocal(idx: number, patch: Partial<BannerImagen>) {
    setBanners((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  async function guardarLink(banner: BannerImagen) {
    const ok = await actualizarBannerImagen(banner.id, { linkUrl: banner.linkUrl || undefined });
    mostrar(ok ? 'Link guardado' : 'Error de servidor');
  }

  // Boton "Ver ahora" superpuesto (pedido explicito del usuario 2026-07-22): color y posicion se
  // guardan al toque (no hace falta un boton "Guardar" aparte, ya se ve reflejado en la vista
  // previa de al lado en tiempo real).
  async function guardarColor(banner: BannerImagen, color: string) {
    actualizarLocal(banners.indexOf(banner), { buttonColor: color });
    await actualizarBannerImagen(banner.id, { buttonColor: color });
  }

  async function guardarPosicion(banner: BannerImagen, pos: BannerImagen['buttonPosition']) {
    actualizarLocal(banners.indexOf(banner), { buttonPosition: pos });
    await actualizarBannerImagen(banner.id, { buttonPosition: pos });
  }

  async function toggleActivo(banner: BannerImagen) {
    const ok = await actualizarBannerImagen(banner.id, { active: !banner.active });
    if (ok) setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, active: !b.active } : b)));
  }

  // Reordenar arrastrando (pedido explicito del usuario 2026-07-22, reemplaza las flechas
  // subir/bajar). Drag and drop nativo del navegador, sin libreria nueva -- la lista es corta
  // (banners promocionales, no cientos de filas). Al soltar, se recalcula el sort_order de TODOS
  // los banners segun la posicion nueva (mas simple y robusto que tratar de mover solo 2) y se
  // persiste cada fila que cambio.
  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function onDrop(idx: number) {
    const origen = dragIdx.current;
    dragIdx.current = null;
    if (origen === null || origen === idx) return;

    const reordenados = [...banners];
    const [movido] = reordenados.splice(origen, 1);
    reordenados.splice(idx, 0, movido);

    setBanners(reordenados);
    await Promise.all(
      reordenados.map((b, i) => (b.sortOrder !== i ? actualizarBannerImagen(b.id, { sortOrder: i }) : Promise.resolve(true))),
    );
    setBanners(reordenados.map((b, i) => ({ ...b, sortOrder: i })));
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
          {/* Pedido explicito del usuario 2026-07-22: boton de WhatsApp visible en /acelerador
              (junto al precio) -- numero y mensaje editables aca cuando el admin quiera cambiarlos. */}
          <label className="mb-1 block text-xs font-medium text-gray-700">Número de WhatsApp del botón en Acelerador de Ventas</label>
          <input
            value={data.whatsappMentoriaNumero}
            onChange={(e) => setCampo('whatsappMentoriaNumero', e.target.value)}
            placeholder="Ej: 3001234567 (sin indicativo 57)"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">Mensaje que se manda por WhatsApp (el link de la página se agrega solo al final)</label>
          <textarea
            value={data.whatsappMentoriaMensaje}
            onChange={(e) => setCampo('whatsappMentoriaMensaje', e.target.value)}
            rows={3}
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
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={subirBanner} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={subiendo}
            className="rounded bg-[#0d6efd] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {subiendo ? 'Subiendo…' : 'Subir banner'}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">Podés elegir varias imágenes de una vez. Arrastrá desde el ícono de la izquierda para reordenar.</p>

      <div className="mt-4 space-y-3">
        {banners.map((banner, idx) => (
          <div
            key={banner.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(idx)}
            className="flex flex-col gap-3 rounded-lg border border-gray-100 p-3 shadow-sm sm:flex-row"
          >
            <div className="flex shrink-0 cursor-move items-center text-gray-400 sm:self-stretch">
              <GripVertical className="h-5 w-5" />
            </div>

            {/* Vista previa en vivo: mismo componente de posicionamiento (clasesPosicionBoton) que
                usa /articulo, para que el admin vea exactamente como va a quedar antes de guardar. */}
            <div className="relative h-24 w-44 shrink-0 overflow-hidden rounded">
              {/* eslint-disable-next-line @next/next/no-img-element -- Storage, tamaño variable */}
              <img src={banner.imageUrl} alt="" className="h-full w-full object-cover" />
              {banner.linkUrl && (
                <span
                  className={`${clasesPosicionBoton(banner.buttonPosition)} rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow`}
                  style={{ backgroundColor: banner.buttonColor }}
                >
                  Ver ahora
                </span>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <input
                value={banner.linkUrl || ''}
                onChange={(e) => actualizarLocal(idx, { linkUrl: e.target.value })}
                onBlur={() => guardarLink(banner)}
                placeholder="Link al hacer click (opcional, ej: https://wa.me/57... o /listproduct/categoria/1)"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  Color del botón
                  <input
                    type="color"
                    value={banner.buttonColor}
                    onChange={(e) => guardarColor(banner, e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-gray-300"
                  />
                </label>
                <select
                  value={banner.buttonPosition}
                  onChange={(e) => guardarPosicion(banner, e.target.value as BannerImagen['buttonPosition'])}
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                >
                  {POSICIONES_BOTON.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => toggleActivo(banner)} className={`rounded-full px-2 py-1 text-xs font-semibold ${banner.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {banner.active ? 'Activo' : 'Inactivo'}
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
