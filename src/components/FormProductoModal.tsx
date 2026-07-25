'use client';

import { useEffect, useState } from 'react';
import {
  fetchCategoriasPrincipales,
  fetchSubcategorias,
  fetchTiposTalla,
  fetchProductoParaEditar,
  guardarProducto,
  activarProducto,
  productoFormVacio,
  type ProductoForm,
  type OpcionSimple,
} from '@/lib/productosAdmin';
import { useToast, Toast } from '@/components/Toast';
import { ImageCropUpload } from '@/components/ImageCropUpload';

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
  const [subiendoFoto, setSubiendoFoto] = useState<string | null>(null); // 'principal'
  const [guardando, setGuardando] = useState(false);
  const [activando, setActivando] = useState(false);
  // Pedido explicito del usuario 2026-07-24: no todas las categorias necesitan subcategoria ni
  // talla/tamaño (ej. electrónica, hogar) -- el proveedor elige si su producto lleva o no cada una,
  // en vez de que ambas sean obligatorias siempre. Por defecto "si" (mismo comportamiento de antes),
  // el proveedor lo desactiva cuando no aplique.
  const [tieneSubcategoria, setTieneSubcategoria] = useState(true);
  const [tieneTalla, setTieneTalla] = useState(true);
  // Pedido explicito del usuario 2026-07-25: campo cosmetico identico al original -- confirmado que
  // ProductoService nunca lo guarda (ver comentario de alcance recortado arriba), asi que no forma
  // parte de ProductoForm ni se manda al guardar, solo se muestra para fidelidad visual.
  const [urlMediosDrive, setUrlMediosDrive] = useState('');
  // Pedido explicito del usuario 2026-07-25: un campo simple de texto para escribir el color o los
  // colores del producto (separados por coma) -- no la gestion completa de variantes/tallas/stock
  // que se quito antes. Al guardar se convierte a la estructura que syncVariants espera.
  const [colorTexto, setColorTexto] = useState('');

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
      setColorTexto(p.colores.map((c) => c.nombre).join(', '));
      if (p.categoriaId) setSubcategorias(await fetchSubcategorias(p.categoriaId));
      setCargando(false);
    });
  }, [productoId]);

  async function onCambiarCategoria(catId: number) {
    set('categoriaId', catId);
    set('subcategoriaId', null);
    setSubcategorias(await fetchSubcategorias(catId));
  }

  // Pedido explicito del usuario 2026-07-25: al crear (form.id todavia null) solo se piden foto +
  // precio a distribuidor + precio de venta + categoria, igual a la captura de referencia -- el
  // nombre real se completa despues, al editar. Mientras tanto se autogenera un nombre placeholder
  // (mismo comportamiento del original: "productos borrador con nombre/codigo aleatorios").
  async function guardar() {
    if (!form.categoriaId) return mostrar('Falta la categoría del producto');
    if (!esCreacion && !form.nombre.trim()) return mostrar('Falta el nombre del producto');
    const eraCreacion = esCreacion;
    const colores = colorTexto
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((nombre) => ({ key: nombre, nombre, foto: form.foto, tallas: [{ tallaId: 0, nombre: '', check: true, cantidad: 0 }] }));
    const formAGuardar = { ...form, nombre: form.nombre.trim() || `Producto ${form.codigo}`, colores };
    setGuardando(true);
    const id = await guardarProducto(formAGuardar, ownerProfileId, esAdmin);
    setGuardando(false);
    if (!id) return mostrar('Error de servidor');
    mostrar(eraCreacion ? 'Exitoso' : 'Actualizado');
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
              variant={esCreacion ? 'dropzone' : 'edit'}
              nombreProducto={form.nombre}
              onEliminar={() => set('foto', null)}
            />

            {/* Pedido explicito del usuario 2026-07-25: estos 3 campos van justo debajo de la foto,
                en una sola fila, identico a la captura de referencia -- solo mientras se esta
                creando (todavia sin id). Una vez creado, estos mismos campos pasan a vivir dentro
                de la grilla completa de abajo (ver bloque !esCreacion). */}
            {esCreacion && (
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
                <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">URL de medios drive</label>
                <input value={urlMediosDrive} onChange={(e) => setUrlMediosDrive(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
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
                <input type="number" value={form.precioDistribuidor ?? ''} onChange={(e) => set('precioDistribuidor', Number(e.target.value))} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Precio sugerido de venta</label>
                <input type="number" value={form.precioVenta ?? ''} onChange={(e) => set('precioVenta', Number(e.target.value))} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Tipo de medida</label>
                <select value={form.tipoTallaId ?? ''} onChange={(e) => set('tipoTallaId', Number(e.target.value))} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                  <option value="">Selecciona…</option>
                  {tiposTalla.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Color o colores</label>
                <input
                  value={colorTexto}
                  onChange={(e) => setColorTexto(e.target.value)}
                  placeholder="Ej: Rojo, Azul, Verde"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
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
