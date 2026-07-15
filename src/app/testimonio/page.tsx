'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, PlayCircle, MapPin, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Port desde src/app/components/testimonios (Angular): la version original era un HTML
// standalone con Bootstrap 3 + Font Awesome via CDN, desconectado del resto del sitio -- se
// reconstruye con el mismo lenguaje visual de las demas paginas migradas (ver
// feedback_lokomproaqui_unicornio).
//
// GuestGuard (decision del usuario 2026-07-14): en Angular esta ruta exige sesion (pedido
// explicito 2026-07-10 para no dejar saltear el embudo de /info) -- se replica el mismo
// comportamiento aca. Como este proyecto no tiene sesion server-side (el JWT vive en
// localStorage, solo lo ve el browser), el chequeo y el fetch de datos son client-side: recien
// se pide `testimonials` despues de confirmar sesion, para no filtrar contenido en el HTML de
// un visitante sin loguear (equivalente en espiritu al guard de Angular, que tampoco monta el
// componente hasta que el guard resuelve).
//
// Bug real encontrado y corregido de paso: TestimoniosService.get() (Angular) mapeaba
// `usuario: t.profile_id` -- un UUID plano -- pero el template leia `item.usuario.usu_nombre`
// como objeto. En produccion eso mostraba nombre/foto/ciudad en blanco (no se nota hoy, la
// tabla testimonials esta vacia). Aca se hace el join real con profiles.

interface Testimonial {
  id: number;
  description: string | null;
  profiles: { full_name: string | null; avatar_url: string | null; city: string | null; phone: string | null } | null;
}

export default function TestimonioPage() {
  const [estado, setEstado] = useState<'revisando' | 'cargando' | 'listo'>('revisando');
  const [listRow, setListRow] = useState<Testimonial[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = '/info';
        return;
      }
      setEstado('cargando');
      supabase
        .from('testimonials')
        .select('id, description, profiles(full_name, avatar_url, city, phone)')
        .eq('status', 0)
        .order('created_at', { ascending: false })
        .limit(15)
        .then(({ data: rows }) => {
          setListRow((rows ?? []) as unknown as Testimonial[]);
          setEstado('listo');
        });
    });
  }, []);

  if (estado !== 'listo') return null;

  return (
    <div>
      <a
        href="https://wa.me/573148487506"
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 bg-[#25D366] px-4 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-[#1fb959] sm:text-base"
      >
        <MessageCircle className="h-5 w-5 shrink-0" />
        Contáctenos por WhatsApp: +57 314 848 7506 (sólo mensajes)
      </a>

      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-lg font-bold text-gray-800 sm:text-xl">
            Video muestra la estrategia EXACTA que utilicé para ganar mis primeras ventas.
          </p>
          <a
            href="https://www.youtube.com/watch?v=stBQMhA3Rxo"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0177a8] to-[#02a0e3] px-6 py-3 text-sm font-bold text-white shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <PlayCircle className="h-5 w-5" />
            CLIC AQUÍ PARA VER LA PRESENTACIÓN
          </a>
        </div>
      </div>

      <section className="pb-4 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-[#02a0e3]">Testimonios</h1>
        <p className="mx-auto mt-3 max-w-2xl px-4 text-gray-600">
          Hay miles de personas que confían en los productos de LokomproAqui por la rentabilidad, la honestidad y la
          transparencia de nuestro sistema de negocio. Algunos de ellos quieren compartir su testimonio contigo.
          Veamos qué dicen:
        </p>
      </section>

      {listRow.length > 0 ? (
        <div className="mx-auto grid max-w-5xl gap-5 px-4 py-10 sm:grid-cols-2">
          {listRow.map((item) => (
            <div
              key={item.id}
              className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- avatar de Supabase Storage */}
              <img
                src={item.profiles?.avatar_url ?? '/assets/noimagen.jpg'}
                alt=""
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-[#02a0e3]/20"
              />
              <div className="min-w-0">
                <p className="font-bold text-gray-800">{item.profiles?.full_name ?? 'Usuario LokomproAqui'}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  {item.profiles?.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {item.profiles.city}
                    </span>
                  )}
                  {item.profiles?.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {item.profiles.phone}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  {item.description ||
                    'La verdad esta página es muy buena, entré con algunas dudas pero al poco tiempo quedé muy satisfecho con los resultados.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-gray-500">Muy pronto vas a leer acá los testimonios de nuestra comunidad.</p>
      )}
    </div>
  );
}
