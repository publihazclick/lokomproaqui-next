import { supabase } from './supabase';

// Port de RechargeComponent + FormRechargeComponent (Angular, "/config/adminF/recharge") -- CRUD
// admin de los paquetes de recarga que ya se muestran en /config/recharge (fetchPaquetesRecarga,
// lib/wallet.ts). RechargeService ya estaba bien implementado, sin bugs reales.

export interface RechargeAdminRow {
  id: number;
  titulo: string;
  descripcion: string | null;
  foto: string | null;
  estado: number;
  precio: number;
}

function mapRecharge(r: any): RechargeAdminRow {
  return { id: r.id, titulo: r.title, descripcion: r.description, foto: r.image_url, estado: r.status, precio: r.price };
}

export async function fetchRechargeAdmin(search?: string): Promise<RechargeAdminRow[]> {
  let q = supabase.from('recharge_products').select('*').eq('status', 1).order('id');
  if (search && search.trim()) q = q.ilike('title', `%${search.trim()}%`);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map(mapRecharge);
}

export async function crearRecharge(data: { titulo: string; descripcion: string; foto: string | null; precio: number }): Promise<boolean> {
  const { error } = await supabase.from('recharge_products').insert({ title: data.titulo, description: data.descripcion, image_url: data.foto, price: data.precio, status: 1 });
  return !error;
}

export async function actualizarRecharge(id: number, data: { titulo: string; descripcion: string; foto: string | null; precio: number }): Promise<boolean> {
  const { error } = await supabase.from('recharge_products').update({ title: data.titulo, description: data.descripcion, image_url: data.foto, price: data.precio }).eq('id', id);
  return !error;
}

export async function eliminarRecharge(id: number): Promise<boolean> {
  const { error } = await supabase.from('recharge_products').delete().eq('id', id);
  return !error;
}
