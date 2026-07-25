'use client';

import { useEffect, useState } from 'react';
import { Upload, Trash2, Plus } from 'lucide-react';
import {
  fetchCategoriasPrincipales,
  fetchSubcategorias,
  fetchTiposTalla,
  fetchTallasPorTipo,
  fetchProductoParaEditar,
  guardarProducto,
  activarProducto,
  productoFormVacio,
  type ProductoForm,
  type ColorForm,
  type OpcionSimple,
} from '@/lib/productosAdmin';
import { subirArchivoPublico } from '@/lib/perfil';
import { useToast, Toast } from '@/components/Toast';
import { ImageCropUpload } from '@/components/ImageCropUpload';
import { SimpleRichTextEditor } from '@/components/SimpleRichTextEditor';

// Port SIMPLIFICADO Y CONSOLIDADO de FormproductosComponent (Angular, 757+440 lineas) -- ver
// src/lib/productosAdmin.ts para el detalle completo. El original tiene un flujo de creacion en
// DOS pasos: subir fotos primero crea productos "borrador" con nombre/codigo aleatorios, despues
// hay que abrir cada uno para completar los datos reales. Aca se consolida en UN solo formulario
// con todos los campos reales visibles desde el principio -- mismo resultado final (mismos campos
// reales guardados via ProductoService.create()/update()/syncVariants, ya bien conectados desde
// la migracion a Supabase), sin el paso intermedio confuso.
//
// El editor de texto enriquecido (AngularEditor) se simplifica a un textarea de HTML plano --
// evita agregar una libreria WYSIWYG nueva, el campo se guarda/muestra exactamente igual (el
// catalogo ya lo renderiza con dangerouslySetInnerHTML). "Precios por cantidad" (checkMayor),
// "URL DE MEDIOS DRIVE" y "Posicion" (mat-slider) no se portan: los dos primeros ya estaban
// inalcanzables/sin efecto real en el original, el tercero (`value`) nunca se guardaba en ningun
// lado tampoco.

interface FormProductoModalProps {
  productoId: number | null;
  ownerProfileId: string;
  esAdmin: boolean;
  onClose: () => void;
  onGuardado: () => void;
  // Pedido explicito del usuario 2026-07-24: en el paso 2 del registro de proveedor, el formulario
  // debe verse directo en la pagina (sin fondo oscuro ni que parezca una ventana emergente aparte).
  inline?: boolean;
}

export function FormProductoModal({ productoId, ownerProfileId, esAdmin, onClose, onGuardado, inline = false }: FormProductoModalProps) {
  const { mensaje, mostrar } = useToast();
  const [cargando, setCargando] = useState(!!productoId);
  const [form, setForm] = useState<ProductoForm>(productoFormVacio);
  const [categorias, setCategorias] = useState<OpcionSimple[]>([]);
  const [subcategorias, setSubcategorias] = useState<OpcionSimple[]>([]);
  const [tiposTalla, setTiposTalla] = useState<OpcionSimple[]>([]);
  const [tallasDisponibles, setTallasDisponibles] = useState<OpcionSimple[]>([]);
  const [nuevoColor, setNuevoColor] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState<string | null>(null); // 'principal' | color.key
  const [guardando, setGuardando] = useState(false);
  const [activando, setActivando] = useState(false);
  // Pedido explicito del usuario 2026-07-24: no todas las categorias necesitan subcategoria ni
  // talla/tamaño (ej. electrónica, hogar) -- el proveedor elige si su producto lleva o no cada una,
  // en vez de que ambas sean obligatorias siempre. Por defecto "si" (mismo comportamiento de antes),
  // el proveedor lo desactiva cuando no aplique.
  const [tieneSubcategoria, setTieneSubcategoria] = useState(true);
  const [tieneTalla, setTieneTalla] = useState(true);

  function set<K extends keyof ProductoForm>(campo: K, valor: ProductoForm[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  const esCreacion = !form.id;

  useEffect(() => {
    fetchCategoriasPrincipales().then(setCategorias);
    fetchTiposTalla().then(setTiposTalla);
  }, []);

  useEffect(() => {
    if (!productoId) {
      setCargando(false);
      return;
    }
    fetchProductoParaEditar(productoId).then(async (p) => {
      if (!p) {
        setCargando(false);
        return;
      }
      setForm(p);
      setTieneSubcategoria(!!p.subcategoriaId);
      setTieneTalla(!!p.tipoTallaId);
      if (p.categoriaId) setSubcategorias(await fetchSubcategorias(p.categoriaId));
      if (p.tipoTallaId) {
        const tallas = await fetchTallasPorTipo(p.tipoTallaId);
        setTallasDisponibles(tallas);
        setForm((prev) => ({ ...prev, colores: mergeColoresConTallas(prev.colores, tallas) }));
      }
      setCargando(false);
    });
  }, [productoId]);

  function mergeColoresConTallas(colores: ColorForm[], tallas: OpcionSimple[]): ColorForm[] {
    return colores.map((c) => ({
      ...c,
      tallas: tallas.map((t) => {
        const existente = c.tallas.find((x) => x.tallaId === t.id);
        return existente || { tallaId: t.id, nombre: t.nombre, check: false, cantidad: 0 };
      }),
    }));
  }

  async function onCambiarCategoria(catId: number) {
    set('categoriaId', catId);
    set('subcategoriaId', null);
    setSubcategorias(await fetchSubcategorias(catId));
  }

  async function onCambiarTipoTalla(tipoId: number) {
    set('tipoTallaId', tipoId);
    const tallas = await fetchTallasPorTipo(tipoId);
    setTallasDisponibles(tallas);
    setForm((prev) => ({ ...prev, colores: mergeColoresConTallas(prev.colores, tallas) }));
  }

  function agregarColor() {
    const nombre = nuevoColor.trim();
    if (!nombre) return;
    if (form.colores.some((c) => c.nombre === nombre)) return;
    const nuevo: ColorForm = {
      key: `${Date.now()}-${Math.random()}`,
      nombre,
      foto: null,
      // Sin talla: una sola "talla" sintetica (tallaId 0 -> se guarda con size_id null, ver
      // syncVariants en productosAdmin.ts) que solo lleva la cantidad total de ese color.
      tallas: tieneTalla
        ? tallasDisponibles.map((t) => ({ tallaId: t.id, nombre: t.nombre, check: false, cantidad: 0 }))
        : [{ tallaId: 0, nombre: '', check: true, cantidad: 0 }],
    };
    setForm((prev) => ({ ...prev, colores: [...prev.colores, nuevo] }));
    setNuevoColor('');
  }

  function actualizarCantidadSinTalla(colorKey: string, cantidad: number) {
    setForm((prev) => ({
      ...prev,
      colores: prev.colores.map((c) => (c.key === colorKey ? { ...c, tallas: [{ tallaId: 0, nombre: '', check: true, cantidad }] } : c)),
    }));
  }

  function quitarColor(key: string) {
    setForm((prev) => ({ ...prev, colores: prev.colores.filter((c) => c.key !== key) }));
  }

  function actualizarColor(key: string, patch: Partial<ColorForm>) {
    setForm((prev) => ({ ...prev, colores: prev.colores.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
  }

  function actualizarTalla(colorKey: string, tallaId: number, patch: Partial<{ check: boolean; cantidad: number }>) {
    setForm((prev) => ({
      ...prev,
      colores: prev.colores.map((c) => (c.key === colorKey ? { ...c, tallas: c.tallas.map((t) => (t.tallaId === tallaId ? { ...t, ...patch } : t)) } : c)),
    }));
  }

  async function subirFotoColor(colorKey: string, file: File) {
    setSubiendoFoto(colorKey);
    const url = await subirArchivoPublico(file);
    setSubiendoFoto(null);
    if (!url) return mostrar('Error de servidor');
    actualizarColor(colorKey, { foto: url });
  }

  // Pedido explicito del usuario 2026-07-25: al crear (form.id todavia null) solo se piden foto +
  // precio a distribuidor + precio de venta + categoria, igual a la captura de referencia -- el
  // nombre real se completa despues, al editar. Mientras tanto se autogenera un nombre placeholder
  // (mismo comportamiento del original: "productos borrador con nombre/codigo aleatorios").
  async function guardar() {
    if (!form.categoriaId) return mostrar('Falta la categoría del producto');
    if (!esCreacion && !form.nombre.trim()) return mostrar('Falta el nombre del producto');
    const formAGuardar = form.nombre.trim() ? form : { ...form, nombre: `Producto ${form.codigo}` };
    setGuardando(true);
    const id = await guardarProducto(formAGuardar, ownerProfileId, esAdmin);
    setGuardando(false);
    if (!id) return mostrar('Error de servidor');
    mostrar(form.id ? 'Actualizado' : 'Exitoso');
    onGuardado();
  }

  function validarParaActivar(): string | null {
    if (!form.nombre) return 'Falta el nombre del producto';
    if (!form.categoriaId) return 'Falta la categoría del producto';
    if (tieneSubcategoria && !form.subcategoriaId) return 'Falta la subcategoría del producto';
    if (!form.precioDistribuidor) return 'Falta el precio de distribuidor';
    if (!form.precioVenta) return 'Falta el precio de venta al cliente final';
    if (tieneTalla && !form.tipoTallaId) return 'Falta el tipo de talla del producto';
    if (!form.alto || !form.ancho || !form.largo || !form.peso) return 'Faltan las dimensiones del producto (alto/ancho/largo/peso)';
    if (form.colores.length === 0) return 'Falta agregar al menos un color';
    for (const color of form.colores) {
      if (!color.foto) return `Falta la foto del color "${color.nombre}"`;
      if (!color.tallas.some((t) => t.check && t.cantidad > 0)) {
        return tieneTalla
          ? `Falta cantidad disponible en al menos una talla del color "${color.nombre}"`
          : `Falta la cantidad disponible del color "${color.nombre}"`;
      }
    }
    if (!form.descripcion) return 'Falta la descripción del producto';
    if (!form.foto) return 'Falta la foto principal del producto';
    return null;
  }

  async function activar() {
    const problema = validarParaActivar();
    if (problema) return mostrar(problema);
    if (!form.id) return;
    setActivando(true);
    const id = await guardarProducto(form, ownerProfileId, esAdmin);
    const ok = id ? await activarProducto(form.id) : false;
    setActivando(false);
    if (!ok) return mostrar('Error de servidor');
    mostrar('¡Producto Activado, ya tus vendedores pueden verlo!');
    onGuardado();
  }

  return (
    <div
      className={inline ? '' : 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4'}
      onClick={inline ? undefined : onClose}
    >
      <div
        className={inline ? 'w-full rounded-xl border border-gray-200 bg-white' : 'max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl'}
        onClick={inline ? undefined : (e) => e.stopPropagation()}
      >
        {!inline && (
          <div className="px-4 py-3">
            <h4 className="text-base font-bold text-gray-900">{form.id ? 'Actualizar' : 'Crear'} Productos</h4>
          </div>
        )}

        {cargando ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">Cargando…</p>
        ) : (
          <div className="space-y-4 px-4 py-4">
            <ImageCropUpload
              value={form.foto}
              onUploaded={(url) => set('foto', url)}
              label="Subir Fotos"
              subiendo={subiendoFoto === 'principal'}
              setSubiendo={(v) => setSubiendoFoto(v ? 'principal' : null)}
            />

            {/* Pedido explicito del usuario 2026-07-25: estos 3 campos van justo debajo de la foto,
                en una sola fila, identico a la captura de referencia -- el resto de campos (codigo,
                nombre, subcategoria, medidas) se conservan mas abajo, sin quitar nada. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Precio a distribuidor</label>
                <input type="number" value={form.precioDistribuidor ?? ''} onChange={(e) => set('precioDistribuidor', Number(e.target.value))} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Precio sugerido de venta</label>
                <input type="number" value={form.precioVenta ?? ''} onChange={(e) => set('precioVenta', Number(e.target.value))} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Categoría</label>
                <select value={form.categoriaId ?? ''} onChange={(e) => onCambiarCategoria(Number(e.target.value))} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                  <option value="">Selecciona…</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pedido explicito del usuario 2026-07-25: al crear, el boton de guardar es este
                verde centrado "Subir imagen" (reemplaza a "Guardar Cambios", que solo queda para
                cuando se edita un producto ya existente). */}
            {esCreacion && (
              <div className="flex justify-center">
                <button
                  onClick={guardar}
                  disabled={cargando || guardando}
                  className="rounded-full bg-[#198754] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {guardando ? 'Subiendo…' : 'Subir imagen'}
                </button>
              </div>
            )}

            {/* Pedido explicito del usuario 2026-07-25: al crear, solo se ven foto + precio a
                distribuidor + precio de venta + categoria (arriba) -- todo lo de aca abajo
                (nombre, codigo, subcategoria, medidas, colores, descripcion, estado) queda oculto
                hasta que el producto ya existe y se abre para editar, igual que el flujo original. */}
            {!esCreacion && (
            <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Código</label>
                <input value={form.codigo} disabled className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Nombre</label>
                <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700">Subcategoría</label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={tieneSubcategoria}
                      onChange={(e) => {
                        setTieneSubcategoria(e.target.checked);
                        if (!e.target.checked) set('subcategoriaId', null);
                      }}
                    />
                    Este producto lleva subcategoría
                  </label>
                </div>
                {tieneSubcategoria ? (
                  <select value={form.subcategoriaId ?? ''} onChange={(e) => set('subcategoriaId', Number(e.target.value))} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                    <option value="">Selecciona…</option>
                    {subcategorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400">Sin subcategoría</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Alto (CM)</label>
                <input type="number" value={form.alto ?? ''} onChange={(e) => set('alto', Number(e.target.value))} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Ancho (CM)</label>
                <input type="number" value={form.ancho ?? ''} onChange={(e) => set('ancho', Number(e.target.value))} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Largo (CM)</label>
                <input type="number" value={form.largo ?? ''} onChange={(e) => set('largo', Number(e.target.value))} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Peso (KL)</label>
                <input type="number" value={form.peso ?? ''} onChange={(e) => set('peso', Number(e.target.value))} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700">Tipo de medida</label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={tieneTalla}
                      onChange={(e) => {
                        const marcado = e.target.checked;
                        setTieneTalla(marcado);
                        if (!marcado) {
                          set('tipoTallaId', null);
                          // Los colores ya agregados pasan a llevar una sola cantidad total, sin tallas
                          // (se suma lo que ya tenian marcado, para no perder cantidades cargadas).
                          setForm((prev) => ({
                            ...prev,
                            colores: prev.colores.map((c) => ({
                              ...c,
                              tallas: [{ tallaId: 0, nombre: '', check: true, cantidad: c.tallas.reduce((s, t) => s + (t.check ? t.cantidad : 0), 0) }],
                            })),
                          }));
                        }
                      }}
                    />
                    Este producto lleva tallas o tamaños
                  </label>
                </div>
                {tieneTalla ? (
                  <select value={form.tipoTallaId ?? ''} onChange={(e) => onCambiarTipoTalla(Number(e.target.value))} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                    <option value="">Selecciona…</option>
                    {tiposTalla.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400">Sin tallas — cada color solo lleva una cantidad total</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Colores disponibles</label>
              <div className="flex gap-2">
                <input
                  value={nuevoColor}
                  onChange={(e) => setNuevoColor(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && agregarColor()}
                  placeholder="Nuevo color…"
                  disabled={tieneTalla && !form.tipoTallaId}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                />
                <button
                  onClick={agregarColor}
                  disabled={tieneTalla && !form.tipoTallaId}
                  className="flex items-center gap-1 rounded bg-[#0d6efd] px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" /> Agregar
                </button>
              </div>
              {tieneTalla && !form.tipoTallaId && <p className="mt-1 text-xs text-gray-400">Elegí primero el tipo de medida.</p>}
            </div>

            <div className="space-y-3">
              {form.colores.map((color) => (
                <div key={color.key} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start gap-3">
                    {color.foto && (
                      // eslint-disable-next-line @next/next/no-img-element -- foto de color (Supabase Storage)
                      <img src={color.foto} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                    )}
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-gray-700">Color</label>
                      <input
                        value={color.nombre}
                        onChange={(e) => actualizarColor(color.key, { nombre: e.target.value })}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded border border-gray-300 px-2 py-1 text-xs">
                        <Upload className="h-3.5 w-3.5" />
                        {subiendoFoto === color.key ? 'Subiendo…' : 'Subir foto'}
                        <input type="file" accept="image/*" hidden disabled={!!subiendoFoto} onChange={(e) => e.target.files?.[0] && subirFotoColor(color.key, e.target.files[0])} />
                      </label>
                    </div>
                    <button onClick={() => quitarColor(color.key)} className="rounded bg-[#dc3545] p-1.5 text-white">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {tieneTalla ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {color.tallas.map((t) => (
                        <label key={t.tallaId} className="flex items-center gap-1.5 rounded border border-gray-200 px-2 py-1.5 text-xs">
                          <input type="checkbox" checked={t.check} onChange={(e) => actualizarTalla(color.key, t.tallaId, { check: e.target.checked })} />
                          <span className="shrink-0">{t.nombre}</span>
                          <input
                            type="number"
                            value={t.cantidad}
                            onChange={(e) => actualizarTalla(color.key, t.tallaId, { cantidad: Number(e.target.value) })}
                            placeholder="Cant."
                            className="w-16 rounded border border-gray-300 px-1 py-0.5 text-xs"
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label className="mt-3 flex items-center gap-2 text-xs">
                      <span className="font-medium text-gray-700">Cantidad disponible</span>
                      <input
                        type="number"
                        value={color.tallas[0]?.cantidad ?? 0}
                        onChange={(e) => actualizarCantidadSinTalla(color.key, Number(e.target.value))}
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Descripción detallada</label>
              <SimpleRichTextEditor key={form.id ?? 'nuevo'} value={form.descripcion} onChange={(html) => set('descripcion', html)} />
            </div>

            {esAdmin && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Estado del Producto</label>
                <select value={form.estado === 1 ? '1' : '0'} onChange={(e) => set('estado', Number(e.target.value))} className="w-full max-w-xs rounded border border-gray-300 px-2 py-2 text-sm">
                  <option value="0">Activo</option>
                  <option value="1">Eliminado</option>
                </select>
              </div>
            )}
            </>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-4 py-3">
          {!inline && (
            <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-gray-600">
              Cerrar
            </button>
          )}
          {form.estado === 3 && (
            <button onClick={activar} disabled={activando} className="rounded bg-[#198754] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
              {activando ? 'Activando…' : 'Activar Producto / Mostrar a la Comunidad'}
            </button>
          )}
          {!esCreacion && (
            <button onClick={guardar} disabled={cargando || guardando} className="rounded bg-[#0d6efd] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
              {guardando ? 'Guardando…' : 'Actualizar Cambios'}
            </button>
          )}
        </div>
      </div>
      <Toast mensaje={mensaje} />
    </div>
  );
}
