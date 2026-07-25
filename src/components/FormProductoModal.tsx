'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
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
  const [subiendoFoto, setSubiendoFoto] = useState<string | null>(null); // 'principal' | color.key | `${color.key}-galeria`
  const [guardando, setGuardando] = useState(false);
  const [activando, setActivando] = useState(false);
  // Pedido explicito del usuario 2026-07-25: campo cosmetico identico al original -- confirmado que
  // ProductoService nunca lo guarda (ver comentario de alcance recortado arriba), asi que no forma
  // parte de ProductoForm ni se manda al guardar, solo se muestra para fidelidad visual.
  const [urlMediosDrive, setUrlMediosDrive] = useState('');
  // Pedido explicito del usuario 2026-07-25: input de "chips" para colores -- escribir y darle
  // Enter/coma agrega el color y crea su tarjeta en "Lista Colores", identico a la captura de
  // referencia. "Codigo" por color es cosmetico (mismo caso que urlMediosDrive), no existe columna
  // para eso en product_variants, asi que se genera y guarda solo en memoria (codigosColor).
  const [nuevoColorChip, setNuevoColorChip] = useState('');
  const [codigosColor, setCodigosColor] = useState<Record<string, string>>({});
  // Pedido explicito del usuario 2026-07-25: "Tipo de medida" ahora tiene 2 opciones fijas ademas de
  // las reales de la base de datos -- "Producto sin talla" (una sola Cantidad disponible, como ya
  // funcionaba) y "Talla única" (una sola caja pero rotulada "Talla única", para que quede claro que
  // SI es una talla, solo que unica -- no hay una talla real "Unica" en la base de datos, asi que
  // esto es puramente de interfaz: en ambos casos se guarda tipoTallaId=null y una sola variante sin
  // size_id, la diferencia es solo el rotulo que ve el proveedor).
  const [modoTalla, setModoTalla] = useState<'ninguno' | 'unica' | 'real'>('ninguno');
  // Pedido explicito del usuario 2026-07-25: todos los campos del flujo son obligatorios salvo "URL
  // de medios drive" y "Sub Categoría" -- no se deja guardar si falta algo, y el campo que falta se
  // marca en rojo con su mensaje. `errores` se calcula al intentar guardar; una vez que hay un
  // intento fallido (`intentoGuardar`), se recalcula en vivo para que el rojo desaparezca apenas se
  // completa cada campo, sin tener que volver a apretar el boton.
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  function set<K extends keyof ProductoForm>(campo: K, valor: ProductoForm[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  const esCreacion = !form.id;

  // Pedido explicito del usuario 2026-07-25: obligatorios todos los campos del flujo salvo "URL de
  // medios drive" y "Sub Categoría". Al crear (esCreacion) solo estan visibles foto/precios/
  // categoria, asi que nombre/colores/descripcion no se piden todavia -- se validan recien cuando
  // ya existen esos campos en pantalla (editando).
  function validar(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.foto) errs.foto = 'Falta la foto del producto';
    if (!form.precioDistribuidor) errs.precioDistribuidor = 'Falta el precio a distribuidor';
    if (!form.precioVenta) errs.precioVenta = 'Falta el precio sugerido de venta';
    if (!form.categoriaId) errs.categoriaId = 'Falta la categoría';
    if (!esCreacion) {
      if (!form.nombre.trim()) errs.nombre = 'Falta el nombre del producto';
      if (form.colores.length === 0) {
        errs.colores = 'Falta agregar al menos un color';
      } else {
        for (const color of form.colores) {
          if (!color.nombre.trim()) errs[`colorNombre:${color.key}`] = 'Falta el nombre del color';
          if (!color.foto) errs[`colorFoto:${color.key}`] = 'Falta la foto de este color';
          if (modoTalla === 'real') {
            // Pedido explicito del usuario 2026-07-25: cada talla que se marca obliga a poner su
            // cantidad -- no alcanza con que UNA cualquiera tenga cantidad, todas las marcadas.
            const algunaMarcada = color.tallas.some((t) => t.check);
            if (!algunaMarcada) {
              errs[`colorCantidad:${color.key}`] = 'Selecciona al menos una talla disponible';
            } else {
              for (const t of color.tallas) {
                if (t.check && !(t.cantidad > 0)) errs[`colorTalla:${color.key}:${t.tallaId}`] = 'Falta la cantidad';
              }
            }
          } else if (!color.tallas.some((t) => t.check && t.cantidad > 0)) {
            errs[`colorCantidad:${color.key}`] = 'Falta la cantidad disponible';
          }
        }
      }
      if (!form.descripcion.trim()) errs.descripcion = 'Falta la descripción detallada';
    }
    return errs;
  }

  function claseInput(campo: string): string {
    return `w-full rounded border px-3 py-2 text-sm ${errores[campo] ? 'border-red-500' : 'border-gray-300'}`;
  }

  function claseSelect(campo: string): string {
    return `w-full rounded border px-2 py-2 text-sm ${errores[campo] ? 'border-red-500' : 'border-gray-300'}`;
  }

  function MensajeError({ campo }: { campo: string }) {
    return errores[campo] ? <p className="mt-1 text-xs font-medium text-red-600">{errores[campo]}</p> : null;
  }

  // Una vez hubo un intento de guardar fallido, los errores se recalculan en vivo con cada cambio
  // para que el rojo desaparezca apenas el proveedor completa el campo, sin que tenga que volver a
  // apretar el boton para verlo.
  useEffect(() => {
    if (intentoGuardar) setErrores(validar());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, intentoGuardar]);

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
      setCodigosColor(Object.fromEntries(p.colores.map((c) => [c.key, generarCodigoColor()])));
      if (p.categoriaId) setSubcategorias(await fetchSubcategorias(p.categoriaId));
      if (p.tipoTallaId) {
        setModoTalla('real');
        setTallasDisponibles(await fetchTallasPorTipo(p.tipoTallaId));
      }
      setCargando(false);
    });
  }, [productoId]);

  async function onCambiarCategoria(catId: number) {
    set('categoriaId', catId);
    set('subcategoriaId', null);
    setSubcategorias(await fetchSubcategorias(catId));
  }

  function mergeColoresConTallas(colores: ColorForm[], tallas: OpcionSimple[]): ColorForm[] {
    return colores.map((c) => ({
      ...c,
      tallas: tallas.map((t) => {
        const existente = c.tallas.find((x) => x.tallaId === t.id);
        return existente || { tallaId: t.id, nombre: t.nombre, check: false, cantidad: 0 };
      }),
    }));
  }

  async function onCambiarTipoMedida(valor: string) {
    // "sin_talla"/"unica" no son tipos reales de la base de datos -- se guardan como
    // tipoTallaId=null (ver comentario de modoTalla arriba), solo cambia el rotulo mostrado.
    if (valor === 'sin_talla' || valor === 'unica') {
      setModoTalla(valor === 'unica' ? 'unica' : 'ninguno');
      setTallasDisponibles([]);
      set('tipoTallaId', null);
      return;
    }
    const tipoId = Number(valor);
    setModoTalla('real');
    const tallas = await fetchTallasPorTipo(tipoId);
    setTallasDisponibles(tallas);
    setForm((prev) => ({ ...prev, tipoTallaId: tipoId, colores: mergeColoresConTallas(prev.colores, tallas) }));
  }

  function generarCodigoColor(): string {
    return (Date.now().toString(20).substring(2, 5) + Math.random().toString(20).substring(2, 5)).toUpperCase();
  }

  // Pedido explicito del usuario 2026-07-25: escribir un color y darle Enter o coma lo agrega como
  // chip y crea su tarjeta en "Lista Colores" -- si el producto tiene tipo de medida seleccionado,
  // la tarjeta trae las tallas de ese tipo (checkbox + cantidad por talla); si no, una sola
  // "Cantidad disponible".
  function agregarColorChip() {
    const nombre = nuevoColorChip.trim();
    if (!nombre) return;
    if (form.colores.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      setNuevoColorChip('');
      return;
    }
    const nuevo: ColorForm = {
      key: `${Date.now()}-${Math.random()}`,
      nombre,
      foto: null,
      galeria: [],
      tallas: modoTalla === 'real'
        ? tallasDisponibles.map((t) => ({ tallaId: t.id, nombre: t.nombre, check: false, cantidad: 0 }))
        : [{ tallaId: 0, nombre: '', check: true, cantidad: 0 }],
    };
    setForm((prev) => ({ ...prev, colores: [...prev.colores, nuevo] }));
    setCodigosColor((prev) => ({ ...prev, [nuevo.key]: generarCodigoColor() }));
    setNuevoColorChip('');
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

  function actualizarCantidadSinTalla(colorKey: string, cantidad: number) {
    setForm((prev) => ({
      ...prev,
      colores: prev.colores.map((c) => (c.key === colorKey ? { ...c, tallas: [{ tallaId: 0, nombre: '', check: true, cantidad }] } : c)),
    }));
  }

  async function subirFotoColorPrincipal(colorKey: string, file: File) {
    setSubiendoFoto(colorKey);
    const url = await subirArchivoPublico(file);
    setSubiendoFoto(null);
    if (!url) return mostrar('Error de servidor');
    actualizarColor(colorKey, { foto: url });
  }

  // Pedido explicito del usuario 2026-07-25: "Subir imagen Galeria" permite elegir varias fotos de
  // una vez (input multiple), no una por una.
  async function subirFotoGaleria(colorKey: string, files: FileList) {
    setSubiendoFoto(`${colorKey}-galeria`);
    const urls = (await Promise.all(Array.from(files).map((f) => subirArchivoPublico(f)))).filter(Boolean) as string[];
    setSubiendoFoto(null);
    if (!urls.length) return mostrar('Error de servidor');
    setForm((prev) => ({
      ...prev,
      colores: prev.colores.map((c) => (c.key === colorKey ? { ...c, galeria: [...c.galeria, ...urls] } : c)),
    }));
  }

  function quitarFotoGaleria(colorKey: string, indice: number) {
    setForm((prev) => ({
      ...prev,
      colores: prev.colores.map((c) => (c.key === colorKey ? { ...c, galeria: c.galeria.filter((_, i) => i !== indice) } : c)),
    }));
  }

  // Pedido explicito del usuario 2026-07-25: al crear (form.id todavia null) solo se piden foto +
  // precio a distribuidor + precio de venta + categoria, igual a la captura de referencia -- el
  // nombre real se completa despues, al editar. Mientras tanto se autogenera un nombre placeholder
  // (mismo comportamiento del original: "productos borrador con nombre/codigo aleatorios").
  async function guardar() {
    const erroresActuales = validar();
    if (Object.keys(erroresActuales).length > 0) {
      setErrores(erroresActuales);
      setIntentoGuardar(true);
      mostrar('Faltan campos obligatorios, revisa lo marcado en rojo');
      return;
    }
    const eraCreacion = esCreacion;
    const formAGuardar = form.nombre.trim() ? form : { ...form, nombre: `Producto ${form.codigo}` };
    setGuardando(true);
    const id = await guardarProducto(formAGuardar, ownerProfileId, esAdmin);
    setGuardando(false);
    if (!id) return mostrar('Error de servidor');
    mostrar(eraCreacion ? 'Exitoso' : 'Actualizado');
    setErrores({});
    setIntentoGuardar(false);
    // Pedido explicito del usuario 2026-07-25: al crear en el MODAL (no inline), no se cierra --
    // se queda abierto y pasa a mostrar la vista de edicion completa (foto grande + grilla), igual
    // a la captura de referencia. Antes esto llamaba a onGuardado(), que el padre usa para cerrar
    // el modal siempre -- por eso el cambio "no se veia": el modal se cerraba antes de mostrar la
    // vista nueva. El modo inline (Paso 2 de onboarding en Mi Cuenta) sigue cerrando/reseteando de
    // una, porque ahi el flujo real es "agregar varios productos seguidos", no editar cada uno.
    if (eraCreacion && !inline) {
      setForm((prev) => ({ ...prev, id, nombre: formAGuardar.nombre }));
      return;
    }
    onGuardado();
  }

  // Pedido explicito del usuario 2026-07-25 ("asegurate que todos los botones tienen funcion"):
  // esta validacion separada quedo desactualizada tras quitar las medidas (alto/ancho/largo/peso)
  // y la subcategoria obligatoria del formulario -- exigia campos que ya no existen en ninguna
  // parte de la UI, asi que "Activar Producto" fallaba SIEMPRE, para cualquier producto. Se
  // unifica con `validar()` (las mismas reglas usadas para "Subir imagen"/"Actualizar Cambios").
  async function activar() {
    const erroresActuales = validar();
    if (Object.keys(erroresActuales).length > 0) {
      setErrores(erroresActuales);
      setIntentoGuardar(true);
      mostrar('Faltan campos obligatorios, revisa lo marcado en rojo');
      return;
    }
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
        className={inline ? 'w-full rounded-xl border border-gray-200 bg-white' : 'max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white shadow-xl'}
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
              variant={esCreacion ? 'dropzone' : 'edit'}
              nombreProducto={form.nombre}
              onEliminar={() => set('foto', null)}
              error={errores.foto}
            />

            {/* Pedido explicito del usuario 2026-07-25: estos 3 campos van justo debajo de la foto,
                en una sola fila, identico a la captura de referencia -- solo mientras se esta
                creando (todavia sin id). Una vez creado, estos mismos campos pasan a vivir dentro
                de la grilla completa de abajo (ver bloque !esCreacion). */}
            {esCreacion && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Precio a distribuidor</label>
                  <input type="number" value={form.precioDistribuidor ?? ''} onChange={(e) => set('precioDistribuidor', Number(e.target.value))} className={claseInput('precioDistribuidor')} />
                  <MensajeError campo="precioDistribuidor" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Precio sugerido de venta</label>
                  <input type="number" value={form.precioVenta ?? ''} onChange={(e) => set('precioVenta', Number(e.target.value))} className={claseInput('precioVenta')} />
                  <MensajeError campo="precioVenta" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Categoría</label>
                  <select value={form.categoriaId ?? ''} onChange={(e) => onCambiarCategoria(Number(e.target.value))} className={claseSelect('categoriaId')}>
                    <option value="">Selecciona…</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  <MensajeError campo="categoriaId" />
                </div>
              </div>
            )}

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
            {/* Pedido explicito del usuario 2026-07-25: campos y orden identicos a la captura de
                referencia (Codigo/Nombre, URL DE MEDIOS DRIVE/Categoria, Sub Categoria/Precio a
                distribuidor/Precio sugerido de venta, Tipo de medida) -- "URL DE MEDIOS DRIVE" es
                cosmetico nada mas (confirmado en el original que ProductoService nunca lo guarda),
                se muestra igual mas no se manda al guardar. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Código</label>
                <input value={form.codigo} disabled className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">Nombre</label>
                <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} className={claseInput('nombre')} />
                <MensajeError campo="nombre" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">URL de medios drive</label>
                <input value={urlMediosDrive} onChange={(e) => setUrlMediosDrive(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">Categoría</label>
                <select value={form.categoriaId ?? ''} onChange={(e) => onCambiarCategoria(Number(e.target.value))} className={claseSelect('categoriaId')}>
                  <option value="">Selecciona…</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <MensajeError campo="categoriaId" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Sub Categoría</label>
                <select value={form.subcategoriaId ?? ''} onChange={(e) => set('subcategoriaId', Number(e.target.value))} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                  <option value="">Selecciona…</option>
                  {subcategorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Precio a distribuidor</label>
                <input type="number" value={form.precioDistribuidor ?? ''} onChange={(e) => set('precioDistribuidor', Number(e.target.value))} className={claseInput('precioDistribuidor')} />
                <MensajeError campo="precioDistribuidor" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Precio sugerido de venta</label>
                <input type="number" value={form.precioVenta ?? ''} onChange={(e) => set('precioVenta', Number(e.target.value))} className={claseInput('precioVenta')} />
                <MensajeError campo="precioVenta" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Tipo de medida</label>
                <select
                  value={form.tipoTallaId ? String(form.tipoTallaId) : modoTalla === 'unica' ? 'unica' : 'sin_talla'}
                  onChange={(e) => onCambiarTipoMedida(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value="sin_talla">Producto sin talla</option>
                  <option value="unica">Talla única</option>
                  {tiposTalla.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pedido explicito del usuario 2026-07-25: escribir un color y darle Enter/coma lo
                agrega como chip y crea su tarjeta en "Lista Colores", identico a la captura de
                referencia. Cada tarjeta trae tallas (si el producto tiene Tipo de medida) o solo
                una cantidad disponible (si no). */}
            <div>
              <div className={`flex flex-wrap items-center gap-1.5 rounded border px-2 py-1.5 ${errores.colores ? 'border-red-500' : 'border-gray-300'}`}>
                {form.colores.map((c) => (
                  <span key={c.key} className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {c.nombre}
                    <button type="button" onClick={() => quitarColor(c.key)} aria-label={`Quitar color ${c.nombre}`} className="text-gray-400 hover:text-gray-700">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={nuevoColorChip}
                  onChange={(e) => setNuevoColorChip(e.target.value.replace(',', ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      agregarColorChip();
                    }
                  }}
                  placeholder="Nuevo color…"
                  className="min-w-[100px] flex-1 border-none px-1 py-1 text-sm outline-none"
                />
              </div>
              <MensajeError campo="colores" />
            </div>

            {form.colores.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-800">Lista Colores</p>
                <div className="flex flex-wrap gap-4">
                  {form.colores.map((color) => {
                    return (
                      <div key={color.key} className="w-full max-w-sm rounded-lg border border-gray-200 p-4 sm:w-[380px]">
                        {/* Pedido explicito del usuario 2026-07-25: la foto principal ya subida se
                            ve arriba de la tarjeta, para saber que es lo que se esta montando. */}
                        {color.foto && (
                          // eslint-disable-next-line @next/next/no-img-element -- foto de color (Supabase Storage)
                          <img src={color.foto} alt="" className="mx-auto mb-3 aspect-square w-28 rounded-md border border-gray-200 object-cover" />
                        )}

                        <label className="mb-1 block text-xs font-medium text-gray-700">Color</label>
                        <input
                          value={color.nombre}
                          onChange={(e) => actualizarColor(color.key, { nombre: e.target.value })}
                          className={claseInput(`colorNombre:${color.key}`)}
                        />
                        <MensajeError campo={`colorNombre:${color.key}`} />

                        <label className="mb-1 mt-3 block text-xs font-medium text-gray-700">Codigo</label>
                        <input value={codigosColor[color.key] || ''} disabled className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm" />

                        <div className="mt-3 flex flex-col items-center">
                          <label
                            className="inline-flex cursor-pointer items-center rounded px-4 py-2 text-sm font-semibold text-white"
                            style={{ background: errores[`colorFoto:${color.key}`] ? '#dc3545' : '#198754' }}
                          >
                            {subiendoFoto === color.key ? 'Subiendo…' : color.foto ? 'Cambiar foto' : 'Agregar una foto'}
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              disabled={!!subiendoFoto}
                              onChange={(e) => e.target.files?.[0] && subirFotoColorPrincipal(color.key, e.target.files[0])}
                            />
                          </label>
                          <MensajeError campo={`colorFoto:${color.key}`} />
                        </div>

                        {modoTalla === 'real' ? (
                          <div className="mt-3">
                            <div className="grid grid-cols-3 gap-2">
                              {color.tallas.map((t) => (
                                <div key={t.tallaId}>
                                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-700">
                                    <input type="checkbox" checked={t.check} onChange={(e) => actualizarTalla(color.key, t.tallaId, { check: e.target.checked })} />
                                    Talla {t.nombre}
                                  </label>
                                  <input
                                    type="number"
                                    value={t.cantidad || ''}
                                    onChange={(e) => actualizarTalla(color.key, t.tallaId, { cantidad: Number(e.target.value) })}
                                    placeholder="Cantidad disponible"
                                    className={`w-full rounded border px-2 py-1.5 text-xs ${errores[`colorTalla:${color.key}:${t.tallaId}`] ? 'border-red-500' : 'border-gray-300'}`}
                                  />
                                  {errores[`colorTalla:${color.key}:${t.tallaId}`] && (
                                    <p className="mt-0.5 text-[10px] font-medium text-red-600">{errores[`colorTalla:${color.key}:${t.tallaId}`]}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                            <MensajeError campo={`colorCantidad:${color.key}`} />
                          </div>
                        ) : (
                          <div className="mt-3">
                            <label className="mb-1 block text-xs font-medium text-gray-700">{modoTalla === 'unica' ? 'Talla única' : 'Cantidad disponible'}</label>
                            <input
                              type="number"
                              value={color.tallas[0]?.cantidad || ''}
                              onChange={(e) => actualizarCantidadSinTalla(color.key, Number(e.target.value))}
                              placeholder="Cantidad disponible"
                              className={claseInput(`colorCantidad:${color.key}`)}
                            />
                            <MensajeError campo={`colorCantidad:${color.key}`} />
                          </div>
                        )}

                        <div className="mt-3 flex flex-col items-center">
                          <label className="inline-flex cursor-pointer items-center rounded px-4 py-2 text-sm font-semibold text-gray-900" style={{ background: '#ffc107' }}>
                            {subiendoFoto === `${color.key}-galeria` ? 'Subiendo…' : 'Subir imagen Galeria'}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              hidden
                              disabled={!!subiendoFoto}
                              onChange={(e) => e.target.files?.length && subirFotoGaleria(color.key, e.target.files)}
                            />
                          </label>
                        </div>

                        {/* Pedido explicito del usuario 2026-07-25: las fotos de galeria se ven
                            abajo, para saber que es lo que se esta montando. */}
                        {color.galeria.length > 0 && (
                          <div className="mt-2 grid grid-cols-4 gap-1.5">
                            {color.galeria.map((url, i) => (
                              <div key={`${url}-${i}`} className="group relative">
                                {/* eslint-disable-next-line @next/next/no-img-element -- foto de galeria (Supabase Storage) */}
                                <img src={url} alt="" className="aspect-square w-full rounded object-cover" />
                                <button
                                  type="button"
                                  onClick={() => quitarFotoGaleria(color.key, i)}
                                  aria-label="Quitar foto de galeria"
                                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#dc3545] text-white opacity-0 group-hover:opacity-100"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-3">
                          <button onClick={() => quitarColor(color.key)} className="rounded bg-[#dc3545] px-4 py-1.5 text-sm font-semibold text-white">
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Descripción detallada</label>
              <SimpleRichTextEditor key={form.id ?? 'nuevo'} value={form.descripcion} onChange={(html) => set('descripcion', html)} error={!!errores.descripcion} />
              <MensajeError campo="descripcion" />
            </div>

            </>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-4 py-3">
          {!inline && (
            <button
              onClick={
                // Si se creo un producto nuevo durante esta sesion del modal (productoId era null
                // pero form.id ya tiene valor), Cerrar debe refrescar la tabla de fondo -- no solo
                // cerrar sin mas, o el producto recien creado no aparece hasta recargar la pagina.
                !productoId && form.id ? onGuardado : onClose
              }
              className="rounded px-3 py-1.5 text-sm text-gray-600"
            >
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
