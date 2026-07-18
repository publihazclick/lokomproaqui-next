'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LeccionForm, type Leccion } from './LeccionForm';

interface Modulo {
  id: number;
  title: string;
  sort_order: number;
  lessons: Leccion[];
}

// Port desde src/app/dashboard-config/components/acelerador-admin (Angular): CRUD de modulos
// y lecciones del curso Acelerador de Ventas, reordenar con flechas (intercambia sort_order
// con el vecino), y el formulario de leccion con subida de video (ver LeccionForm.tsx).
export function AceleradorAdmin() {
  const [listModules, setListModules] = useState<Modulo[]>([]);
  const [loader, setLoader] = useState(true);
  const [nuevoModuloTitulo, setNuevoModuloTitulo] = useState('');
  const [formLeccion, setFormLeccion] = useState<{ moduloId: number; leccion: Leccion | null } | null>(null);

  async function cargarTodo() {
    setLoader(true);
    const [{ data: modules }, { data: lessons }] = await Promise.all([
      supabase.from('acelerador_modules').select('*').order('sort_order'),
      supabase.from('acelerador_lessons').select('*').order('sort_order'),
    ]);
    setListModules(
      (modules ?? []).map((m) => ({ ...m, lessons: (lessons ?? []).filter((l) => l.module_id === m.id) }))
    );
    setLoader(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  async function crearModulo() {
    if (!nuevoModuloTitulo.trim()) return;
    const { error } = await supabase.from('acelerador_modules').insert({ title: nuevoModuloTitulo, sort_order: listModules.length });
    if (error) return alert('Error de servidor');
    setNuevoModuloTitulo('');
    cargarTodo();
  }

  async function actualizarModulo(modulo: Modulo) {
    const { error } = await supabase.from('acelerador_modules').update({ title: modulo.title }).eq('id', modulo.id);
    if (error) alert('Error de servidor');
  }

  async function eliminarModulo(modulo: Modulo) {
    if (!confirm(`¿Eliminar el módulo "${modulo.title}"? Esto también borra sus ${modulo.lessons.length} lecciones (con sus videos), sin poder deshacerlo.`)) return;
    const { error } = await supabase.from('acelerador_modules').delete().eq('id', modulo.id);
    if (error) return alert('Error de servidor');
    cargarTodo();
  }

  async function moverModulo(index: number, direccion: number) {
    const vecino = index + direccion;
    if (vecino < 0 || vecino >= listModules.length) return;
    const actual = listModules[index];
    const otro = listModules[vecino];
    await Promise.all([
      supabase.from('acelerador_modules').update({ sort_order: otro.sort_order }).eq('id', actual.id),
      supabase.from('acelerador_modules').update({ sort_order: actual.sort_order }).eq('id', otro.id),
    ]);
    cargarTodo();
  }

  async function moverLeccion(modulo: Modulo, index: number, direccion: number) {
    const vecino = index + direccion;
    if (vecino < 0 || vecino >= modulo.lessons.length) return;
    const actual = modulo.lessons[index];
    const otro = modulo.lessons[vecino];
    await Promise.all([
      supabase.from('acelerador_lessons').update({ sort_order: otro.sort_order }).eq('id', actual.id),
      supabase.from('acelerador_lessons').update({ sort_order: actual.sort_order }).eq('id', otro.id),
    ]);
    cargarTodo();
  }

  async function eliminarLeccion(leccion: Leccion) {
    if (!confirm(`¿Eliminar la lección "${leccion.title}"? Esto también borra el video subido, sin poder deshacerlo.`)) return;
    const { error } = await supabase.from('acelerador_lessons').delete().eq('id', leccion.id);
    if (error) return alert('Error de servidor');
    cargarTodo();
  }

  function actualizarTituloModuloLocal(id: number, title: string) {
    setListModules((prev) => prev.map((m) => (m.id === id ? { ...m, title } : m)));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-gray-900">📚 Subir mi curso</h1>

      <div className="mt-3 rounded-xl bg-blue-50 p-4 text-sm text-gray-700">
        <p className="font-semibold text-gray-800">👋 No te preocupes, es muy fácil. Solo son 2 pasos:</p>
        <p className="mt-2">
          <span className="font-bold">PASO 1.</span> Ponle un nombre a un <span className="font-semibold">Módulo</span> (piensa en un módulo
          como una carpeta con un tema, por ejemplo: &quot;Cómo vender por WhatsApp&quot;).
        </p>
        <p className="mt-1">
          <span className="font-bold">PASO 2.</span> Adentro de ese módulo, agrega tus <span className="font-semibold">Clases</span> (cada
          clase es un video que vas a subir).
        </p>
      </div>

      <div className="mt-6 rounded-2xl border-2 border-dashed border-[#02a0e3] bg-[#f4faff] p-4">
        <p className="mb-2 text-sm font-bold text-gray-800">PASO 1 — Crea un módulo nuevo</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nuevoModuloTitulo}
            onChange={(e) => setNuevoModuloTitulo(e.target.value)}
            placeholder="Ej: Módulo 1 - Cómo empezar a vender"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#02a0e3]"
          />
          <button
            type="button"
            onClick={crearModulo}
            className="shrink-0 rounded-full bg-gradient-to-r from-[#0177a8] to-[#02a0e3] px-5 py-2 text-sm font-bold text-white shadow-md"
          >
            + Crear módulo
          </button>
        </div>
      </div>

      {loader && <p className="mt-6 text-sm text-gray-500">Cargando...</p>}

      <div className="mt-8 flex flex-col gap-6">
        {listModules.map((modulo, i) => (
          <div key={modulo.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">📁 Módulo {i + 1}</p>
            <div className="flex items-center gap-3">
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moverModulo(i, -1)}
                  title="Subir módulo"
                  className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === listModules.length - 1}
                  onClick={() => moverModulo(i, 1)}
                  title="Bajar módulo"
                  className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={modulo.title}
                onChange={(e) => actualizarTituloModuloLocal(modulo.id, e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-base font-extrabold outline-none focus:border-[#02a0e3]"
              />
              <button
                type="button"
                onClick={() => actualizarModulo(modulo)}
                className="shrink-0 rounded-full bg-[#02a0e3] px-3.5 py-1.5 text-xs font-bold text-white"
              >
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={() => eliminarModulo(modulo)}
                className="shrink-0 rounded-full p-1.5 text-red-500 hover:bg-red-50"
                title="Eliminar este módulo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-1 mt-4 text-sm font-bold text-gray-800">PASO 2 — Las clases de este módulo</p>
            <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-100">
              {modulo.lessons.map((leccion, j) => (
                <li key={leccion.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={j === 0}
                        onClick={() => moverLeccion(modulo, j, -1)}
                        className="rounded border border-gray-200 p-0.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={j === modulo.lessons.length - 1}
                        onClick={() => moverLeccion(modulo, j, 1)}
                        className="rounded border border-gray-200 p-0.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </span>
                    {leccion.title}
                    {!leccion.video_path && <span className="text-xs text-gray-400">(todavía sin video)</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <a
                      href={`/acelerador/leccion/${leccion.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      title="Ver cómo queda esta clase"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setFormLeccion({ moduloId: modulo.id, leccion })}
                      className="rounded-full p-1.5 text-[#0177a8] hover:bg-[#f4faff]"
                      title="Editar esta clase"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarLeccion(leccion)}
                      className="rounded-full p-1.5 text-red-500 hover:bg-red-50"
                      title="Eliminar esta clase"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
              {modulo.lessons.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-gray-400">Este módulo todavía no tiene ninguna clase. Usa el botón de abajo para agregar la primera.</li>
              )}
            </ul>

            <button
              type="button"
              onClick={() => setFormLeccion({ moduloId: modulo.id, leccion: null })}
              className="mt-3 rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
            >
              ➕ Agregar una clase (video) a este módulo
            </button>
          </div>
        ))}
      </div>

      {!loader && listModules.length === 0 && (
        <p className="py-16 text-center text-gray-400">Todavía no has creado ningún módulo. Usa el PASO 1 de arriba para crear el primero.</p>
      )}

      {formLeccion && (
        <LeccionForm
          moduloId={formLeccion.moduloId}
          siguienteOrden={listModules.find((m) => m.id === formLeccion.moduloId)?.lessons.length ?? 0}
          leccion={formLeccion.leccion}
          onClose={() => setFormLeccion(null)}
          onGuardado={() => {
            setFormLeccion(null);
            cargarTodo();
          }}
        />
      )}
    </div>
  );
}
