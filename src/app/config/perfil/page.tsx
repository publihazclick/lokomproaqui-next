'use client';

import { useEffect, useMemo, useState } from 'react';
import { Upload, Package, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchPerfilCompleto,
  nombreTiendaTomado,
  actualizarPerfil,
  cambiarPassword,
  subirArchivoPublico,
  type PerfilCompleto,
} from '@/lib/perfil';
import { Indicativo } from '@/lib/indicativo';
import { DANEGROUP } from '@/lib/dane-cities';
import { useToast, Toast } from '@/components/Toast';
import { EquipoVendedoresInfoModal } from '@/components/EquipoVendedoresInfoModal';
import { PickupAddressCard } from '@/components/PickupAddressCard';
import { Paso3Documentos } from '@/components/Paso3Documentos';
import { FormProductoModal } from '@/components/FormProductoModal';
import { fetchEstadoProveedor, enviarProveedorARevision, MINIMO_PRODUCTOS_PROVEEDOR, type EstadoProveedor } from '@/lib/proveedorEstado';

// Pedido explicito del usuario 2026-07-25: cambios reales desplegados no se veian en produccion --
// el shell HTML de esta pagina (contenido 100% client-side, autenticado) quedaba cacheado en el
// edge de Vercel (ISR) y no se invalidaba entre deploys sucesivos. Se fuerza render dinamico para
// que cada visita sirva el HTML mas reciente en vez de una version potencialmente vieja en cache.
export const dynamic = 'force-dynamic';

const ESTADO_PROVEEDOR_ESTILO: Record<string, { bg: string; border: string; color: string }> = {
  incompleto: { bg: '#f8fafc', border: '#e5e7eb', color: '#374151' },
  en_revision: { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
  aprobado: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
  rechazado: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
};

// Port 1:1 desde src/app/dashboard-config/components/perfil (Angular, PerfilComponent) -- "Mi
// Cuenta", pantalla usada por todos los roles logueados. Primera pieza de Fase 5 (panel admin).
//
// Fideidad visual identica al original (Bootstrap), como el resto de paginas desde Fase 3.
//
// CORRECCION REAL DE BUGS (decision del usuario 2026-07-15, "arreglarlos de una vez"): 12 campos
// de este formulario (correo de contacto, redes sociales, fecha de nacimiento, genero, color de
// tienda, indicativo, y toda la pestaña de verificacion de proveedor con sus 3 PDFs) se veian en
// el formulario de Angular pero UsuariosService.update() nunca los guardaba desde la migracion a
// Supabase -- se perdian en silencio. Se agregaron las columnas que faltaban (migracion
// 032_perfil_extra_fields.sql, ya corrida en produccion) y aca se conecta el guardado real. Ver
// src/lib/perfil.ts para el detalle completo, incluido que supplier_doc_rut_url/cc_url/comercio_url
// YA EXISTIAN desde el Hito 0 y nunca se habian usado.
//
// ALCANCE RECORTADO Y DOCUMENTADO:
// - Recortador de imagen (image-cropper) para la foto de tienda: se simplifica a una subida plana
//   sin recorte -- el usuario sube la foto ya del tamaño que quiera, sin UI de crop.
// - "SUBIR 5 IMAGENES..." (iniciarClick, abre FormproductosComponent) y el flujo de "solicitud"
//   que dispara: sin ningun boton real en el HTML original que lo dispare (dead code confirmado
//   leyendo la plantilla), no se porta.
// - openPdf(): genera un PDF de contenido placeholder ("This header has both top and bottom
//   margins..."), nunca conectado a datos reales, sin boton que lo dispare en el HTML. No se porta.
// - "IMPRIMIR" (tarjeta VIP): sigue linkeando a /imprimirTarjeta, ruta que se queda en Angular
//   (no es parte de esta migracion).
// - Pedido explicito del usuario 2026-07-24: los "Paso 1/2/3" del onboarding de proveedor
//   (PickupAddressCard, alta rapida de producto, Paso3Documentos) antes solo vivian en
//   /config/productos y encima desaparecian ahi mismo apenas el proveedor dejaba de estar
//   "incompleto" -- ya no habia forma de editar la direccion de recogida o resubir un documento
//   vencido despues de aprobado. Se agregan aca, dentro de "Datos de bodegas", sin la logica de
//   gating de onboarding (siempre visibles para cualquier proveedor, sin importar su estado).
// - Pedido explicito del usuario 2026-07-24 (segunda vuelta): /config/productos vuelve a ser
//   SOLO subir/editar productos -- el banner de estado de cuenta (incompleto/en_revision/
//   aprobado/rechazado) y el boton "Enviar a revisión" tambien se mudaron para aca completos,
//   junto con los pasos. Ver src/app/config/productos/page.tsx (ya sin ninguna logica de
//   onboarding).
// - Pedido explicito del usuario 2026-07-24 (tercera vuelta): "Datos Iniciales" solo debe mostrar
//   los campos que el formulario de registro (/registro y /singUp) realmente pide -- se quitan
//   correo de contacto, redes sociales, fecha de nacimiento y genero (nunca se piden en ningun
//   registro, quedaban ahi sin ningun uso real en el resto de la app). Ciudad/Direccion solo se
//   muestran para rolname==='proveedor' porque son las UNICAS con esa pregunta en el registro (el
//   de vendedor no la hace). Foto y color de tienda quedan a proposito aunque tampoco se piden en
//   el registro -- son la unica forma de configurarlos y se usan de verdad en la tienda publica.
// - Bug real encontrado y NO corregido a proposito (bajo impacto, cosmetic): `disableBtn` en el
//   original decide si mostrar "Link para crear mi equipo de vendedores" con una condicion OR que
//   termina siendo SIEMPRE verdadera sin importar el rol (bug de logica, deberia ser AND). Se
//   replica la realidad actual: el boton se muestra siempre.

export default function PerfilPage() {
  const { mensaje, mostrar } = useToast();

  const [estado, setEstado] = useState<'revisando' | 'cargando' | 'listo'>('revisando');
  const [data, setData] = useState<PerfilCompleto | null>(null);
  const [tab, setTab] = useState<'datos' | 'bodega'>('datos');

  const [nombreTiendaTomadoFlag, setNombreTiendaTomadoFlag] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [claveNueva, setClaveNueva] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [mostrarInfoEquipo, setMostrarInfoEquipo] = useState(false);

  const [estadoProveedor, setEstadoProveedor] = useState<EstadoProveedor | null>(null);
  const [inlineFormKey, setInlineFormKey] = useState(0);
  const [pickupConfirmado, setPickupConfirmado] = useState(false);
  const [documentosOk, setDocumentosOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const ciudadesOrdenadas = useMemo(() => [...DANEGROUP].sort((a: any, b: any) => (a.city || '').localeCompare(b.city || '')), []);

  async function cargarEstadoProveedor(uid: string) {
    setEstadoProveedor(await fetchEstadoProveedor(uid));
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      setEstado('cargando');
      const uid = sessionData.session.user.id;
      const perfil = await fetchPerfilCompleto(uid);
      setData(perfil);
      if (perfil?.rolname === 'proveedor') await cargarEstadoProveedor(uid);
      setEstado('listo');
    });
  }, []);

  async function enviarARevision() {
    if (!data || enviando) return;
    setEnviando(true);
    const res = await enviarProveedorARevision(data.id);
    setEnviando(false);
    if (!res.ok) {
      mostrar(res.message || 'No pudimos enviar tu cuenta a revisión');
      return;
    }
    mostrar('¡Listo! Tu cuenta quedó en revisión, te avisamos apenas la aprueben.');
    await cargarEstadoProveedor(data.id);
  }

  if (estado === 'revisando' || estado === 'cargando') return null;

  // Bug real encontrado 2026-07-17: fetchPerfilCompleto devuelve null en silencio si la consulta
  // falla (ej. columna faltante en la base de datos) -- antes esto dejaba la pantalla en blanco
  // para siempre, sin ningun aviso. Ahora se muestra un error real en vez de nada.
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[600px] px-3 py-16 text-center">
        <p className="text-lg font-semibold text-red-700">No pudimos cargar tu cuenta.</p>
        <p className="mt-2 text-sm text-gray-500">Intenta recargar la página. Si el problema sigue, avísale al equipo de soporte.</p>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const urlTienda = `${origin}/portada/index/${data.telefono || ''}`;
  const urlRegistro = `${origin}/singUp/vendedor/${data.telefono || ''}`;

  function set<K extends keyof PerfilCompleto>(campo: K, valor: PerfilCompleto[K]) {
    setData((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  async function onNombreTiendaChange(valor: string) {
    if (!data) return;
    const limpio = valor.replace(/[^a-zA-Z ]/g, '').replace(/\s+/g, '');
    set('nombreTienda', limpio);
    if (!limpio) {
      setNombreTiendaTomadoFlag(false);
      return;
    }
    setNombreTiendaTomadoFlag(await nombreTiendaTomado(limpio, data.id));
  }

  async function copiar(texto: string, etiqueta: string) {
    if (!data?.telefono) {
      mostrar('Debe registrar un número de teléfono en su perfil antes de compartir su tienda');
      return;
    }
    try {
      await navigator.clipboard.writeText(texto);
    } catch {}
    mostrar(`Copiado: ${etiqueta}`);
  }

  async function onSubirFoto(file: File) {
    if (!data) return;
    setSubiendoFoto(true);
    const url = await subirArchivoPublico(file);
    setSubiendoFoto(false);
    if (!url) {
      mostrar('Error de servidor subiendo la foto');
      return;
    }
    set('avatarUrl', url);
    await actualizarPerfil(data.id, { avatarUrl: url });
    mostrar('Exitoso');
  }

  async function actualizarDatos() {
    if (!data) return;
    if (nombreTiendaTomadoFlag) {
      mostrar('Error tenemos problemas en el formulario por favor revisar gracias');
      return;
    }
    setGuardando(true);
    const ok = await actualizarPerfil(data.id, {
      nombre: data.nombre || '',
      apellido: data.apellido || '',
      nombreTienda: data.nombreTienda || '',
      telefono: data.telefono || '',
      indicativo: data.indicativo,
      ciudad: data.ciudad || '',
      direccion: data.direccion || '',
      colorTienda: data.colorTienda || '',
    });
    setGuardando(false);
    mostrar(ok ? 'Actualizado' : 'Error de Servidor');
  }

  async function actualizarClave() {
    if (!claveNueva) return;
    const res = await cambiarPassword(claveNueva);
    if (res.success) {
      mostrar('Actualizado Password');
      setCambiandoClave(false);
      setClaveNueva('');
    } else {
      mostrar(res.message || 'Error Servidor');
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1140px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Mi cuenta</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <h5 className="font-semibold text-gray-800">{data.nombre}</h5>
        <p className="mt-1 text-sm text-gray-600">Este es el link de su tienda:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => copiar(urlTienda, urlTienda)} className="rounded-full bg-[#0d6efd] px-4 py-2 text-xs font-bold text-white hover:opacity-90">
            TRAER CLIENTES A MI TIENDA
          </button>
          <button onClick={() => setMostrarInfoEquipo(true)} className="rounded-full bg-[#198754] px-4 py-2 text-xs font-bold text-white hover:opacity-90">
            Link para crear mi equipo de vendedores
          </button>
        </div>

        {/* Pedido explicito del usuario 2026-07-21 ("curarme en salud"): el link ya no se copia
            directo al hacer click -- primero se explica, en lenguaje simple, exactamente como
            funcionan las comisiones de equipo (montos por nivel, requisito de actividad, ventana
            de 90 dias, alcance solo marketplace). El copiado real ocurre desde el boton del modal. */}
        {mostrarInfoEquipo && (
          <EquipoVendedoresInfoModal
            urlRegistro={urlRegistro}
            onClose={() => setMostrarInfoEquipo(false)}
            onCopiar={() => {
              copiar(urlRegistro, urlRegistro);
              setMostrarInfoEquipo(false);
            }}
          />
        )}

        <div className="mt-5 flex justify-center">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 p-4 text-center">
            <h4 className="text-sm font-bold">ASO-VIRTUAL-CONNECTED</h4>
            <p className="text-[11px] font-bold text-gray-500">Asociacion de Tiendas Virtuales conectadas</p>
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- avatar de Supabase Storage */}
              <img src={data.avatarUrl || '/assets/noimagen.jpg'} alt="" className="h-20 w-20 rounded object-cover" />
              <div className="flex-1 text-left text-xs">
                <p>ID: {data.id.slice(0, 8)}</p>
                <p>
                  Nombre: {data.nombre} {data.apellido}
                </p>
                <p>Ciudad: {data.ciudad}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-gray-500">Este documento es para uso vip de nuestra plataforma con este documento entras a evento exclusivos</p>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <a href="/imprimirTarjeta" target="_blank" rel="noreferrer" className="rounded bg-[#198754] px-4 py-2 text-sm font-bold text-white hover:opacity-90">
            IMPRIMIR
          </a>
        </div>

        <div className="mt-6 flex gap-2 border-b border-gray-200">
          <button onClick={() => setTab('datos')} className={`px-4 py-2 text-sm font-semibold ${tab === 'datos' ? 'border-b-2 border-[#0d6efd] text-[#0d6efd]' : 'text-gray-500'}`}>
            Datos Iniciales
          </button>
          {data.rolname === 'proveedor' && (
            <button onClick={() => setTab('bodega')} className={`px-4 py-2 text-sm font-semibold ${tab === 'bodega' ? 'border-b-2 border-[#0d6efd] text-[#0d6efd]' : 'text-gray-500'}`}>
              Datos de bodegas
            </button>
          )}
        </div>

        {tab === 'datos' && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Subir Foto de tu Tienda 400px / 400px</label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm">
                <Upload className="h-4 w-4" />
                {subiendoFoto ? 'Subiendo…' : 'Elegir archivo'}
                <input type="file" accept="image/*" hidden disabled={subiendoFoto} onChange={(e) => e.target.files?.[0] && onSubirFoto(e.target.files[0])} />
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Nombre de su tienda</label>
              <input value={data.nombreTienda || ''} onChange={(e) => onNombreTiendaChange(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              {nombreTiendaTomadoFlag && <p className="mt-1 rounded bg-red-100 px-2 py-1 text-xs text-red-700">El Nombre de su tienda Ya Se Encuentra Registrado Por Favor Utilizar Otro</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Nombre de usuario</label>
              <input value={data.nombre || ''} onChange={(e) => set('nombre', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Apellido(s)</label>
              <input value={data.apellido || ''} onChange={(e) => set('apellido', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Numero de Whatsapp</label>
              <div className="flex gap-2">
                <select value={data.indicativo} onChange={(e) => set('indicativo', e.target.value)} className="w-32 rounded border border-gray-300 px-2 py-2 text-sm">
                  {Indicativo.map((i: any) => (
                    <option key={i.iso2} value={i.phone_code}>
                      {i.nombre} +{i.phone_code}
                    </option>
                  ))}
                </select>
                <input value={data.telefono || ''} onChange={(e) => set('telefono', e.target.value)} className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Ciudad/Dirección solo se piden en el registro de PROVEEDOR (/registro y /singUp con
                rol proveedor) -- un vendedor nunca las diligencia al registrarse, asi que no se
                muestran para ese rol aca. */}
            {data.rolname === 'proveedor' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Ciudad</label>
                  <input
                    list="ciudades-perfil"
                    value={data.ciudad || ''}
                    onChange={(e) => set('ciudad', e.target.value)}
                    placeholder="Buscar Ciudad"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <datalist id="ciudades-perfil">
                    {ciudadesOrdenadas.map((c: any, idx: number) => (
                      <option key={`${c.code}-${idx}`} value={c.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Dirección</label>
                  <input value={data.direccion || ''} onChange={(e) => set('direccion', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </>
            )}

            {/* Foto y color de tienda NO se piden en ningun formulario de registro, pero se quedan
                aca a proposito (pedido explicito del usuario 2026-07-24): se usan de verdad en la
                tienda publica y esta es la UNICA pantalla donde se pueden configurar -- quitarlas
                dejaria a todo proveedor/vendedor sin forma de subir su foto o elegir su color. */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Color de tu tienda</label>
              <input type="color" value={data.colorTienda || '#02a0e3'} onChange={(e) => set('colorTienda', e.target.value)} className="h-10 w-full rounded border border-gray-300" />
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <button onClick={actualizarDatos} disabled={guardando} className="rounded-full bg-[#198754] px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">
                {guardando ? 'Guardando…' : 'Actualizar Datos'}
              </button>
            </div>

            <div className="sm:col-span-2 border-t border-gray-100 pt-4">
              {cambiandoClave && (
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type={verClave ? 'text' : 'password'}
                    value={claveNueva}
                    onChange={(e) => setClaveNueva(e.target.value)}
                    placeholder="Clave Nueva"
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button onClick={() => setVerClave((v) => !v)} className="text-xs text-gray-500 underline">
                    {verClave ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              )}
              <button
                onClick={() => (cambiandoClave ? actualizarClave() : setCambiandoClave(true))}
                className="rounded-full bg-[#0d6efd] px-5 py-2 text-sm font-bold text-white hover:opacity-90"
              >
                {cambiandoClave ? 'Actualizar Contraseña' : 'Cambiar Contraseña'}
              </button>
            </div>
          </div>
        )}

        {tab === 'bodega' && data.rolname === 'proveedor' && (
          <div className="mt-4">
            {estadoProveedor && (
              <div
                className="mb-3 rounded-2xl border p-4"
                style={{ background: ESTADO_PROVEEDOR_ESTILO[estadoProveedor.status].bg, borderColor: ESTADO_PROVEEDOR_ESTILO[estadoProveedor.status].border }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: ESTADO_PROVEEDOR_ESTILO[estadoProveedor.status].color }} />
                    <div>
                      <p className="m-0 text-sm font-bold" style={{ color: ESTADO_PROVEEDOR_ESTILO[estadoProveedor.status].color }}>
                        {estadoProveedor.status === 'incompleto' && 'Completa los pasos para enviar tu cuenta a revisión'}
                        {estadoProveedor.status === 'en_revision' && 'Tu cuenta está en revisión'}
                        {estadoProveedor.status === 'aprobado' && '¡Tu cuenta está aprobada!'}
                        {estadoProveedor.status === 'rechazado' && 'Tu cuenta fue rechazada'}
                      </p>
                      <p className="m-0 mt-1 text-xs leading-relaxed" style={{ color: ESTADO_PROVEEDOR_ESTILO[estadoProveedor.status].color }}>
                        {estadoProveedor.status === 'incompleto' &&
                          `Confirma el Paso 1, sube como mínimo ${MINIMO_PRODUCTOS_PROVEEDOR} producto${MINIMO_PRODUCTOS_PROVEEDOR === 1 ? '' : 's'} en el Paso 2 (llevas ${estadoProveedor.productCount}/${MINIMO_PRODUCTOS_PROVEEDOR}) y completa el Paso 3 para poder enviar tu cuenta a revisión. Nuestro equipo la revisa y, una vez aprobada, tu bodega aparece en "Explorar productos" para que los vendedores te encuentren.`}
                        {estadoProveedor.status === 'en_revision' &&
                          'Nuestro equipo de proveedores está revisando tus productos. Te avisamos apenas quede aprobada y aparezcas en "Explorar Bodegas".'}
                        {estadoProveedor.status === 'aprobado' && 'Tu bodega ya aparece en "Explorar Bodegas" para que los vendedores te encuentren.'}
                        {estadoProveedor.status === 'rechazado' &&
                          (estadoProveedor.rejectionReason
                            ? `Motivo: "${estadoProveedor.rejectionReason}". Ajusta tus datos/productos y vuelve a enviar tu cuenta a revisión.`
                            : 'Ajusta tus datos/productos y vuelve a enviar tu cuenta a revisión.')}
                      </p>
                    </div>
                  </div>
                  {(estadoProveedor.status === 'incompleto' || estadoProveedor.status === 'rechazado') && (
                    <button
                      onClick={enviarARevision}
                      disabled={enviando || estadoProveedor.productCount < MINIMO_PRODUCTOS_PROVEEDOR || !pickupConfirmado || !documentosOk}
                      className="shrink-0 rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                      style={{ background: '#02a0e3' }}
                    >
                      {enviando ? 'Enviando…' : 'Enviar a revisión'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <PickupAddressCard profileId={data.id} onEstadoCambia={setPickupConfirmado} />

            <div className="mb-3 rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <Package className="h-4.5 w-4.5 shrink-0" style={{ color: '#0288c2' }} />
                <h5 className="m-0 text-sm font-bold text-gray-900">Paso 2 Agrega tus productos</h5>
                {!!estadoProveedor && estadoProveedor.productCount >= MINIMO_PRODUCTOS_PROVEEDOR && (
                  <span className="ml-1 flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Completado
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Llevas {estadoProveedor?.productCount ?? 0} producto{estadoProveedor?.productCount === 1 ? '' : 's'} subido{estadoProveedor?.productCount === 1 ? '' : 's'}.
              </p>
              <div className="mt-3">
                <FormProductoModal
                  key={inlineFormKey}
                  inline
                  productoId={null}
                  ownerProfileId={data.id}
                  esAdmin={false}
                  onClose={() => {}}
                  onGuardado={async () => {
                    setInlineFormKey((k) => k + 1);
                    await cargarEstadoProveedor(data.id);
                  }}
                />
              </div>
            </div>

            <Paso3Documentos profileId={data.id} onEstadoCambia={setDocumentosOk} />
          </div>
        )}
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
