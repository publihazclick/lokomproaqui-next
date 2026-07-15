import { supabase } from './supabase';

// Port 1:1 de CursosService (Angular) -- CursosService.get() ya esta bien implementado (sin bugs,
// CRUD simple sobre `courses`), se porta directo.

export interface Curso {
  id: number;
  titulo: string | null;
  url: string | null;
  img: string | null;
  descripcion: string | null;
}

export async function fetchCursos(): Promise<Curso[]> {
  const { data, error } = await supabase.from('courses').select('*').order('sort_order');
  if (error || !data) return [];
  return data.map((c: any) => ({ id: c.id, titulo: c.title, url: c.video_url, img: c.image_url, descripcion: c.description }));
}
