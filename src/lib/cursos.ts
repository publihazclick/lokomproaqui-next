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

// ── Admin "Tutoriales" (CursosComponent/FormTutorialComponent, "/config/cursos") ───────────────
// Categorias (courses con parent_id null) + videos de YouTube dentro de cada una (parent_id = id
// de la categoria que le pertenece). Sin bugs reales -- el comentario original del componente
// Angular ya documenta que courses.parent_id no tiene "on delete cascade", por eso al eliminar una
// categoria hay que borrar primero sus videos a mano.

export interface CursoAdminRow {
  id: number;
  titulo: string;
  orden: number;
  padre: number | null;
  url: string | null;
}

export interface CategoriaCursos extends CursoAdminRow {
  videos: CursoAdminRow[];
}

function mapCursoAdmin(c: any): CursoAdminRow {
  return { id: c.id, titulo: c.title, orden: c.sort_order, padre: c.parent_id, url: c.video_url };
}

export async function fetchCategoriasCursos(): Promise<CategoriaCursos[]> {
  const { data, error } = await supabase.from('courses').select('*').order('sort_order');
  if (error || !data) return [];
  const todos = data.map(mapCursoAdmin);
  return todos.filter((c) => !c.padre).map((cat) => ({ ...cat, videos: todos.filter((v) => v.padre === cat.id) }));
}

export function extraerIdYoutube(input: string): string {
  if (!input) return input;
  input = input.trim();
  const match = input.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]+)/);
  return match ? match[1] : input;
}

export async function crearCategoriaCurso(titulo: string, orden: number): Promise<boolean> {
  const { error } = await supabase.from('courses').insert({ title: titulo, sort_order: orden, parent_id: null });
  return !error;
}

export async function actualizarCurso(id: number, patch: { titulo?: string; orden?: number; url?: string }): Promise<boolean> {
  const data: any = {};
  if (patch.titulo !== undefined) data.title = patch.titulo;
  if (patch.orden !== undefined) data.sort_order = patch.orden;
  if (patch.url !== undefined) data.video_url = patch.url;
  const { error } = await supabase.from('courses').update(data).eq('id', id);
  return !error;
}

export async function eliminarCurso(id: number): Promise<boolean> {
  const { error } = await supabase.from('courses').delete().eq('id', id);
  return !error;
}

export async function crearVideoCurso(padre: number, orden: number, titulo: string, url: string): Promise<boolean> {
  const { error } = await supabase.from('courses').insert({ title: titulo, video_url: extraerIdYoutube(url), sort_order: orden, parent_id: padre });
  return !error;
}
