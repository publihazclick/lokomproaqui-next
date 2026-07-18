'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type ProductoLegacy,
  type ProductoColor,
  type ProductoTallaSelect,
  codigoCarrito,
  fetchPriceOverride,
  guardarPriceOverride,
  quitarPriceOverride,
} from '@/lib/productos';
import { useCart, formatCOP } from '@/lib/cartStore';
import { useToast, Toast } from '@/components/Toast';
import { type DataUserCompleto } from '@/lib/usuarios';
import { DropshippingCheckoutModal } from '@/components/DropshippingCheckoutModal';

// Port 1:1 desde src/app/components/view-productos (Angular) -- el dialogo real de "ver
// producto/agregar al carrito" que abren tanto PedidosComponent (`/articulo`) como
// ListArticleStoreComponent (`/listproduct`) al hacer click en una tarjeta del catalogo.
// Fidelidad visual identica al original (Fase 3), no modernizada.
//
// ALCANCE RECORTADO A PROPOSITO (documentado, no silencioso):
// - "Piezas graficas" (openUrl -> data.urlMedios) y "Descargar fotos" (descargarFoto): el primero
//   ya esta muerto en produccion (ProductoService no llena `urlMedios`, el boton abriria about:blank);
//   el segundo ni siquiera tiene boton en el HTML actual (metodo sin ningun (click) que lo dispare).
//   Ninguno de los dos se porta.
// - "Ganas el X% : $Y" (gananciaEstimada/porcentajeMostrar, basado en dataUser.categoriaPerfil):
//   ya esta roto en produccion hoy (UsuariosService nunca llena `categoriaPerfil`/`porcentaje` en
//   el perfil desde la migracion a Supabase) -- hoy literalmente muestra "Ganas el  % : NaN" a
//   cualquier usuario logueado viendo un producto sin precio a distribuidor. Se omite la linea en
//   vez de portar el texto roto.
// - `coinShop` (modo "comprar con puntos"): ambos puntos de entrada leidos (PedidosComponent,
//   ListArticleStoreComponent) siempre lo pasan en `false` -- no hay ningun lugar del sitio que lo
//   active todavia, se omiten sus ramas (precio alternativo, titulo de boton "Hacer Compra").
//
// Bug real corregido de paso: el campo `talla` (vs `tallaSelect`) que SI usaba correctamente esta
// pagina (a diferencia de ProductoViewComponent, ver /productos/[id]) se mantiene tal cual.

interface ViewProductosModalProps {
  producto: ProductoLegacy;
  dataUser: DataUserCompleto | null;
  initialView?: 'store';
  onClose: () => void;
}

function unionGaleria(producto: ProductoLegacy): { foto: string }[] {
  const fotos: string[] = [producto.foto];
  for (const c of producto.listColor) {
    for (const g of c.galeriaList) fotos.push(g.foto);
  }
  const vistos = new Set<string>();
  return fotos.filter((f) => (vistos.has(f) ? false : (vistos.add(f), true))).map((foto) => ({ foto }));
}

export function ViewProductosModal({ producto, dataUser, initialView, onClose }: ViewProductosModalProps) {
  const { agregar } = useCart();
  const { mensaje, mostrar } = useToast();

  // listColor filtrado a solo tallas con stock > 0 (mismo filtro que ViewProductosComponent.procesoNext)
  const listColor = useMemo<ProductoColor[]>(
    () => producto.listColor.map((c) => ({ ...c, tallaSelect: c.tallaSelect.filter((t) => Number(t.cantidad) > 0) })),
    [producto.listColor],
  );

  const [colorSel, setColorSel] = useState<string>(listColor.length ? 'null' : '');
  const [tallaSel, setTallaSel] = useState('');
  const [cantidadAdquirir, setCantidadAdquirir] = useState(1);
  const [urlFoto, setUrlFoto] = useState(producto.foto);
  const [encuanto, setEncuanto] = useState(producto.pro_uni_venta || 0);
  const [disabledPr, setDisabledPr] = useState(true);
  const [disabledView, setDisabledView] = useState<'normal' | 'store' | 'createPrice'>(initialView ?? 'normal');
  const [idMyProduct, setIdMyProduct] = useState<number | null>(null);
  const [idPrice, setIdPrice] = useState<number | ''>('');
  const [guardando, setGuardando] = useState(false);
  const [checkoutAbierto, setCheckoutAbierto] = useState<'dropshipping' | 'muestra' | null>(null);

  useEffect(() => {
    if (!dataUser?.id) return;
    fetchPriceOverride(producto.id, dataUser.id).then((res) => {
      if (!res) return;
      setIdMyProduct(res.id);
      setIdPrice(res.price);
      if (initialView === 'store') setDisabledView('createPrice');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto.id, dataUser?.id]);

  const seleccionoColor: ProductoColor | null = colorSel && colorSel !== 'null' ? listColor.find((c) => c.talla === colorSel) ?? null : null;

  const seleccionnTalla: ProductoTallaSelect | null = (() => {
    if (!seleccionoColor) return null;
    if (seleccionoColor.tallaSelect.length === 1 && !seleccionoColor.tallaSelect[0].tal_descripcion) return seleccionoColor.tallaSelect[0];
    if (!tallaSel) return null;
    return seleccionoColor.tallaSelect.find((t) => t.tal_descripcion === tallaSel) ?? null;
  })();

  const galeria = seleccionoColor
    ? seleccionoColor.galeriaList.length
      ? seleccionoColor.galeriaList
      : [{ id: '0', foto: seleccionoColor.foto }]
    : unionGaleria(producto);

  const nameColores = listColor.map((c) => c.talla).join(', ');
  const nemeTalla = listColor[0]?.tallaSelect.map((t) => t.tal_descripcion).join(', ') || '';

  function onChangeColor(nuevo: string) {
    setColorSel(nuevo);
    setTallaSel('');
    if (!nuevo || nuevo === 'null') {
      setUrlFoto(producto.foto);
      return;
    }
    const grupo = listColor.find((c) => c.talla === nuevo);
    setUrlFoto(grupo?.foto || producto.foto);
  }

  function onChangeTalla(tal: string) {
    setTallaSel(tal);
  }

  function validando(valor: number) {
    setEncuanto(valor);
    if (producto.pro_vendedor != null && valor < producto.pro_vendedor) {
      setDisabledPr(false);
      mostrar('lo sentimos pero no se puedes vender este producto en este precio');
      return;
    }
    setDisabledPr(true);
  }

  function agregarCarrito() {
    if (disabledPr === false) {
      mostrar('lo sentimos pero no se puedes vender este producto en este precio');
      return;
    }
    if (!colorSel || colorSel === 'null') {
      mostrar('Lo sentimos tienes que seleccionar un color');
      return;
    }
    if ((seleccionnTalla?.cantidad ?? 0) < cantidadAdquirir) {
      mostrar('Lo sentimos en estos momento no tenemos en stock');
      return;
    }
    let tallas = tallaSel;
    if (!tallas) {
      if (!producto.pro_categoria) {
        mostrar('Por Favor debes seleccionar una talla');
        return;
      }
      if (producto.pro_categoria.cat_nombre === 'CALZADO') {
        mostrar('Por Favor debes seleccionar una talla');
        return;
      }
      tallas = 'default';
    }

    const cantidad = cantidadAdquirir || 1;
    const precio = producto.pro_vendedor || producto.pro_uni_venta || 0;
    const costoTotal = precio * cantidad;
    const loVendio = (encuanto || producto.pro_uni_venta || 0) * cantidad;

    agregar({
      articulo: producto.id,
      codigo: producto.pro_codigo,
      titulo: producto.pro_nombre,
      color: colorSel,
      tallaSelect: tallas,
      foto: urlFoto,
      cantidad,
      costo: precio,
      loVendio,
      costoTotal,
      id: codigoCarrito(),
    });

    mostrar('Producto agregado al carro');
  }

  async function shareUrl() {
    const url = `${window.location.origin}/front/catalogo/${producto.id}/${dataUser?.telefono || ''}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    mostrar('Link copiado');
  }

  async function handleAddStore() {
    const input = window.prompt('Valor a Vender ¡sin puntos solo numerico!', String(producto.pro_uni_venta || ''));
    if (input === null) return;
    const valor = Number(input);
    if (!valor) {
      mostrar('Lo Sentimos Necesitamos un Valor de Venta Gracias!!!');
      return;
    }
    if (!dataUser?.id) return;
    setGuardando(true);
    const ok = await guardarPriceOverride(producto.id, dataUser.id, valor);
    setGuardando(false);
    if (ok) {
      mostrar('Este Producto Esta Agregado a tu Cuentas!!!');
      onClose();
    }
  }

  async function handleDroppArticle() {
    if (!idMyProduct) return;
    if (!window.confirm('Deseas Eliminar Dato')) return;
    setGuardando(true);
    const ok = await quitarPriceOverride(idMyProduct);
    setGuardando(false);
    if (ok) {
      mostrar('Este Producto Esta Eliminado de tu Tienda!!!');
      onClose();
    }
  }

  // Equivalente a ViewProductosComponent.abrirDropshipping, salvo el piso operativo de saldo
  // (pedido explicito del usuario 2026-07-16): el formulario completo se abre y cotiza el envio
  // con todas las transportadoras SIEMPRE que haya sesion + color/talla -- el saldo insuficiente
  // ya no bloquea la apertura, solo se avisa (con mensaje claro) al momento de confirmar el pago,
  // dentro del propio dialogo (DropshippingCheckoutModal.confirmarPago).
  function abrirDropshipping(mode: 'dropshipping' | 'muestra') {
    if (!dataUser?.id) {
      mostrar('Debes iniciar sesión para continuar');
      return;
    }
    if (!colorSel || colorSel === 'null') {
      mostrar('Primero debes seleccionar talla y color');
      return;
    }
    const necesitaTalla = !!seleccionoColor?.tallaSelect[0]?.tal_descripcion;
    if (necesitaTalla && !tallaSel) {
      mostrar('Primero debes seleccionar talla y color');
      return;
    }
    setCheckoutAbierto(mode);
  }

  const puedeMostrarGanancia = false; // ver nota de alcance recortado arriba

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div
        className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
          <h4 className="flex-1 text-center text-lg font-bold text-gray-900">{producto.pro_nombre}</h4>
          <button onClick={onClose} aria-label="Cerrar" className="ml-2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 px-4 py-2 text-center">
          <div>
            {producto.pro_vendedor ? <h5 className="text-sm font-medium text-gray-600">Precio a distribuidor:</h5> : null}
            <h5 className="text-base font-semibold text-gray-900">$ {formatCOP(producto.pro_vendedor || 0)} COP</h5>
          </div>
          <div>
            <h5 className="text-sm font-medium text-gray-600">{dataUser?.id ? 'Precio Sugerido:' : 'Precio:'}</h5>
            <h5 className="text-base font-semibold text-gray-900">$ {formatCOP(producto.pro_uni_venta)} COP</h5>
            {puedeMostrarGanancia && <span className="text-xs text-gray-500">Ganas el 0 % : $0 COP</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 px-4 py-3 sm:grid-cols-2">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de Supabase Storage */}
            <img src={urlFoto || '/assets/noimagen.jpg'} alt={producto.pro_nombre} className="max-h-[45vh] w-full rounded object-contain" />
            {galeria.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {galeria.map((g, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura de galeria
                  <img
                    key={`${g.foto}-${idx}`}
                    src={g.foto}
                    alt=""
                    onClick={() => setUrlFoto(g.foto)}
                    className={`h-16 w-16 shrink-0 cursor-pointer rounded border object-cover ${urlFoto === g.foto ? 'border-[#0d6efd]' : 'border-gray-200'}`}
                  />
                ))}
              </div>
            )}
            {dataUser?.id && disabledView === 'store' && (
              <div className="mt-3 text-center">
                <button onClick={handleAddStore} disabled={guardando} className="rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white hover:bg-[#0b5ed7] disabled:opacity-60">
                  Agregar a mi Tienda
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Colores disponibles:</label>
                <select
                  value={colorSel}
                  onChange={(e) => onChangeColor(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="null">Todos</option>
                  {listColor.map((c) => (
                    <option key={c.talla} value={c.talla}>
                      {c.talla}
                    </option>
                  ))}
                </select>

                <label className="mt-2 block text-xs font-medium text-gray-700">Cantidad Adquirir</label>
                <input
                  type="number"
                  value={cantidadAdquirir}
                  onChange={(e) => setCantidadAdquirir(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </div>

              <div>
                {colorSel && colorSel !== 'null' && seleccionoColor?.tallaSelect[0]?.tal_descripcion ? (
                  <>
                    <label className="block text-xs font-medium text-gray-700">Tallas disponibles:</label>
                    <select
                      value={tallaSel}
                      onChange={(e) => onChangeTalla(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value="" disabled>
                        Selecciona
                      </option>
                      {seleccionoColor.tallaSelect.map((t) => (
                        <option key={t.id} value={t.tal_descripcion}>
                          Talla: {t.tal_descripcion} UND: {t.cantidad}
                        </option>
                      ))}
                    </select>
                  </>
                ) : colorSel && colorSel !== 'null' ? (
                  <>
                    <label className="block text-xs font-medium text-gray-700">Cantidades disponibles:</label>
                    <p className="mt-1 text-sm text-gray-800">{seleccionoColor?.tallaSelect[0]?.cantidad ?? 0}</p>
                  </>
                ) : (
                  <label className="block text-xs font-medium text-gray-500">Elige un color primero</label>
                )}

                <label className="mt-2 block text-xs font-medium text-gray-700">Lo Vendiste</label>
                <input
                  type="number"
                  value={encuanto}
                  onChange={(e) => validando(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto de Supabase Storage */}
              <img src={urlFoto || '/assets/noimagen.jpg'} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-gray-900">{producto.pro_nombre}</h4>
                <p className="text-xs text-gray-500">Colores: {nameColores}</p>
                <p className="text-xs text-gray-500">Tamaños Disponibles: {nemeTalla}</p>
              </div>
            </div>

            <div className="mt-3 flex justify-around">
              <button onClick={shareUrl} className="rounded bg-[#198754] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#157347]">
                Compartir link
              </button>
            </div>

            <div className="mt-3 border-t border-gray-100 pt-3">
              <h3 className="text-sm font-bold text-gray-700">DESCRIPCION:</h3>
              <p
                className="mt-1 max-w-full overflow-hidden break-words text-sm text-gray-600 [&_*]:max-w-full [&_img]:h-auto"
                dangerouslySetInnerHTML={{ __html: producto.pro_descripcion || '' }}
              />
            </div>

            {dataUser?.id && (
              <div className="mt-3 flex justify-center gap-2 border-t border-gray-100 pt-3">
                <button
                  onClick={() => abrirDropshipping('dropshipping')}
                  className="rounded bg-[#02a0e3] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  Hacer Dropshipping
                </button>
                <button
                  onClick={() => abrirDropshipping('muestra')}
                  className="rounded bg-[#02a0e3] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  Pedir muestra
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-gray-100 px-4 py-4">
          {disabledView === 'createPrice' ? (
            <>
              <button onClick={handleAddStore} disabled={guardando} className="rounded bg-[#198754] px-4 py-2 text-sm font-medium text-white hover:bg-[#157347] disabled:opacity-60">
                Actualizar Precio
              </button>
              <button onClick={handleDroppArticle} disabled={guardando} className="rounded bg-[#dc3545] px-4 py-2 text-sm font-medium text-white hover:bg-[#bb2d3b] disabled:opacity-60">
                Quitar de mi Tienda
              </button>
            </>
          ) : disabledView !== 'store' ? (
            <button onClick={agregarCarrito} className="rounded bg-[#0d6efd] px-6 py-2 text-sm font-medium text-white hover:bg-[#0b5ed7]">
              Confirmar pedido
            </button>
          ) : null}
        </div>
      </div>

      <Toast mensaje={mensaje} />

      {checkoutAbierto && dataUser && (
        <DropshippingCheckoutModal
          mode={checkoutAbierto}
          producto={producto}
          colorSeleccionado={colorSel !== 'null' ? colorSel : ''}
          tallaSeleccionada={tallaSel}
          cantidadAdquirir={cantidadAdquirir}
          dataUser={dataUser}
          onClose={() => setCheckoutAbierto(null)}
        />
      )}
    </div>
  );
}
