'use client';

import { useEffect, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchPerfilCompleto,
  nombreTiendaTomado,
  actualizarPerfil,
  cambiarPassword,
  subirArchivoPublico,
  fetchCategoriasSeleccionadas,
  guardarCategoriasSeleccionadas,
  type PerfilCompleto,
} from '@/lib/perfil';
import { fetchCategoriasConSub, type CategoriaConSub } from '@/lib/categorias';
import { Indicativo } from '@/lib/indicativo';
import { DANEGROUP } from '@/lib/dane-cities';
import { useToast, Toast } from '@/components/Toast';

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
// - Bug real encontrado y NO corregido a proposito (bajo impacto, cosmetic): `disableBtn` en el
//   original decide si mostrar "Link para crear mi equipo de vendedores" con una condicion OR que
//   termina siendo SIEMPRE verdadera sin importar el rol (bug de logica, deberia ser AND). Se
//   replica la realidad actual: el boton se muestra siempre.

const GENEROS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
];

const TIPOS_PROVEEDOR = [
  { value: 'fabricante', label: 'Fabricante' },
  { value: 'importador', label: 'Importador' },
];

const EXPERIENCIAS = [
  { value: '0_6_meses', label: '0 a 6 Meses' },
  { value: '6_meses_1_anio', label: '6 Meses a 1 Año' },
  { value: 'mas_1_anio', label: 'Más de un Año' },
];

export default function PerfilPage() {
  const { mensaje, mostrar } = useToast();

  const [estado, setEstado] = useState<'revisando' | 'cargando' | 'listo'>('revisando');
  const [data, setData] = useState<PerfilCompleto | null>(null);
  const [categorias, setCategorias] = useState<CategoriaConSub[]>([]);
  const [categoriasCheck, setCategoriasCheck] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<'datos' | 'bodega'>('datos');

  const [nombreTiendaTomadoFlag, setNombreTiendaTomadoFlag] = useState(false);
  const [emailInvalido, setEmailInvalido] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [subiendoPdf, setSubiendoPdf] = useState<string | null>(null);

  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [claveNueva, setClaveNueva] = useState('');
  const [verClave, setVerClave] = useState(false);

  const ciudadesOrdenadas = useMemo(() => [...DANEGROUP].sort((a: any, b: any) => (a.city || '').localeCompare(b.city || '')), []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      setEstado('cargando');
      const uid = sessionData.session.user.id;
      const [perfil, cats, catsSel] = await Promise.all([
        fetchPerfilCompleto(uid),
        fetchCategoriasConSub(),
        fetchCategoriasSeleccionadas(uid),
      ]);
      setData(perfil);
      setCategorias(cats.filter((c) => c.id !== 0));
      setCategoriasCheck(new Set(catsSel));
      setEstado('listo');
    });
  }, []);

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

  function onEmailChange(valor: string) {
    set('contactEmail', valor);
    const dominio = (valor.split('@')[1] || '').toLowerCase();
    setEmailInvalido(!!valor && dominio !== 'gmail.com' && dominio !== 'gmail.es');
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

  async function onSubirPdf(file: File, campo: 'pdfRutUrl' | 'pdfCedulaUrl' | 'pdfCamaraComercioUrl') {
    if (!data) return;
    setSubiendoPdf(campo);
    const url = await subirArchivoPublico(file);
    setSubiendoPdf(null);
    if (!url) {
      mostrar('Error de servidor subiendo el documento');
      return;
    }
    set(campo, url);
    await actualizarPerfil(data.id, { [campo]: url });
    mostrar('Documento guardado');
  }

  function toggleCategoria(id: number) {
    setCategoriasCheck((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function actualizarDatos() {
    if (!data) return;
    if (nombreTiendaTomadoFlag) {
      mostrar('Error tenemos problemas en el formulario por favor revisar gracias');
      return;
    }
    if (emailInvalido) {
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
      contactEmail: data.contactEmail || '',
      facebookUrl: data.facebookUrl || '',
      instagramUrl: data.instagramUrl || '',
      youtubeUrl: data.youtubeUrl || '',
      fechaNacimiento: data.fechaNacimiento || '',
      genero: data.genero || '',
      colorTienda: data.colorTienda || '',
      supplierType: data.supplierType || '',
      supplierExperience: data.supplierExperience || '',
      supplierRunsAds: data.supplierRunsAds ?? undefined,
    });
    if (ok) await guardarCategoriasSeleccionadas(data.id, Array.from(categoriasCheck));
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
          <button onClick={() => copiar(urlRegistro, urlRegistro)} className="rounded-full bg-[#198754] px-4 py-2 text-xs font-bold text-white hover:opacity-90">
            Link para crear mi equipo de vendedores
          </button>
        </div>

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

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Correo Electronico</label>
              <input value={data.contactEmail || ''} onChange={(e) => onEmailChange(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              {emailInvalido && <p className="mt-1 rounded bg-red-100 px-2 py-1 text-xs text-red-700">El Email Solo Seran Correos Con Dominio Gmail</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Fecha Nacimiento</label>
              <input type="date" value={data.fechaNacimiento || ''} onChange={(e) => set('fechaNacimiento', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Url de Facebook</label>
              <input value={data.facebookUrl || ''} onChange={(e) => set('facebookUrl', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Url de Instagram</label>
              <input value={data.instagramUrl || ''} onChange={(e) => set('instagramUrl', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Url de youtube</label>
              <input value={data.youtubeUrl || ''} onChange={(e) => set('youtubeUrl', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Genero</label>
              <select value={data.genero || ''} onChange={(e) => set('genero', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
                <option value="">—</option>
                {GENEROS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
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
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Nombre de tu bodega</label>
              <input value={data.nombreTienda || ''} onChange={(e) => set('nombreTienda', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Numero contacto de soporte</label>
              <input value={data.telefono || ''} onChange={(e) => set('telefono', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Correo electrónico soporte</label>
              <input value={data.contactEmail || ''} onChange={(e) => set('contactEmail', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Ciudad</label>
              <input
                list="ciudades-bodega"
                value={data.ciudad || ''}
                onChange={(e) => set('ciudad', e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <datalist id="ciudades-bodega">
                {ciudadesOrdenadas.map((c: any, idx: number) => (
                  <option key={`${c.code}-${idx}`} value={c.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Dirección de bodega para mensajeria</label>
              <input value={data.direccion || ''} onChange={(e) => set('direccion', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Tipo de Proveedor?</label>
              <select value={data.supplierType || ''} onChange={(e) => set('supplierType', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
                <option value="">—</option>
                {TIPOS_PROVEEDOR.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Tiempo de Experiencia como Proveedor Dropshipping?</label>
              <select value={data.supplierExperience || ''} onChange={(e) => set('supplierExperience', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
                <option value="">—</option>
                {EXPERIENCIAS.map((ex) => (
                  <option key={ex.value} value={ex.value}>
                    {ex.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">¿Estás vinculado alguna plataforma de dropshipping?</label>
              <select
                value={data.supplierRunsAds === true ? 'si' : data.supplierRunsAds === false ? 'no' : ''}
                onChange={(e) => set('supplierRunsAds', e.target.value === 'si')}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">—</option>
                <option value="si">SI</option>
                <option value="no">NO</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Seleccionar la o las categorías del tipo de producto que quiere promocionar</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {categorias.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={categoriasCheck.has(cat.id)} onChange={() => toggleCategoria(cat.id)} />
                    {cat.title.slice(0, 10)}
                  </label>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 space-y-3">
              {(
                [
                  ['pdfRutUrl', '1. Enviar Rut actualizado'],
                  ['pdfCedulaUrl', '2. Enviar Copia de la Cedula Ampliada al 150%'],
                  ['pdfCamaraComercioUrl', '3. Enviar Camara de Comercio Actualizada'],
                ] as const
              ).map(([campo, etiqueta]) => (
                <div key={campo} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">{etiqueta}</span>
                  {data[campo] && (
                    <a href={data[campo] as string} target="_blank" rel="noreferrer" className="rounded bg-[#0d6efd] px-2 py-1 text-xs text-white">
                      Ver
                    </a>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-gray-300 px-2 py-1 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    {subiendoPdf === campo ? 'Subiendo…' : 'Subir PDF'}
                    <input type="file" accept="application/pdf" hidden disabled={!!subiendoPdf} onChange={(e) => e.target.files?.[0] && onSubirPdf(e.target.files[0], campo)} />
                  </label>
                </div>
              ))}
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <button onClick={actualizarDatos} disabled={guardando} className="rounded-full bg-[#198754] px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">
                {guardando ? 'Guardando…' : 'Actualizar Datos'}
              </button>
            </div>
          </div>
        )}
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
