import { supabase } from './supabase';

// Port de ControlInventarioComponent (Angular, "Entrada / Salida Inventario") -- registro manual
// de movimientos de stock por parte de un proveedor/admin.
//
// BUG REAL encontrado y corregido (no replicado): `guardar()` en el original manda
// `{ proveedor: this.data, articulos: this.productosSlc }` a `ControlinventarioService.create()`,
// pero ese metodo lee los campos PLANOS (`data.tpEntrada`, `data.descripcion`, `data.user`) --
// nunca los nesteados bajo `proveedor` -- y JAMAS llama a `createProductos()` para guardar los
// articulos seleccionados. En produccion HOY "Guardar" crea una fila casi vacia en
// `supplier_stock_entries` y los productos/cantidades seleccionados se pierden por completo, sin
// ningun error visible (el toast dice "guardado exitoso"). Se corrige aca: se crea la entrada con
// los campos reales y SI se guardan los items.
//
// Simplificacion real (no es un recorte, es fiel al esquema): el selector de color/talla del
// original (`colorSeleccionado`/`TallaSeleccionado`/`detalleSeleccion`) nunca tuvo donde
// persistirse -- `supplier_stock_entry_items` solo tiene `product_id`/`quantity`, sin columnas de
// color/talla (`mapEntryItemToLegacy` siempre devuelve `color: null, talla: null`). Se simplifica
// el selector a producto + cantidad, que es todo lo que el esquema real puede guardar.

const TIPO_ENTRADA_LABEL: Record<number, string> = { 1: 'Entrada', 2: 'Salida', 3: 'Devolución' };

export interface MovimientoInventario {
  id: number;
  tipoLabel: string;
  fecha: string;
  descripcion: string | null;
}

export async function fetchMovimientos(userId: string, esAdmin: boolean): Promise<MovimientoInventario[]> {
  let q = supabase.from('supplier_stock_entries').select('*').order('entry_date', { ascending: false }).limit(200);
  if (!esAdmin) q = q.eq('profile_id', userId);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((e: any) => ({
    id: e.id,
    tipoLabel: TIPO_ENTRADA_LABEL[e.entry_type] || 'Movimiento',
    fecha: e.entry_date,
    descripcion: e.description,
  }));
}

export async function eliminarMovimiento(id: number): Promise<boolean> {
  const { error } = await supabase.from('supplier_stock_entries').delete().eq('id', id);
  return !error;
}

export interface ItemNuevoMovimiento {
  productId: number;
  cantidad: number;
}

export async function crearMovimiento(opts: {
  userId: string;
  tipoEntrada: number;
  fecha: string;
  descripcion: string;
  items: ItemNuevoMovimiento[];
}): Promise<boolean> {
  const { data: inserted, error } = await supabase
    .from('supplier_stock_entries')
    .insert({ entry_type: opts.tipoEntrada, description: opts.descripcion, status: 1, profile_id: opts.userId, entry_date: opts.fecha })
    .select('id')
    .single();
  if (error || !inserted) return false;

  if (opts.items.length) {
    const rows = opts.items.map((it) => ({ entry_id: inserted.id, product_id: it.productId, quantity: it.cantidad }));
    const { error: itemsError } = await supabase.from('supplier_stock_entry_items').insert(rows);
    if (itemsError) return false;
  }
  return true;
}
