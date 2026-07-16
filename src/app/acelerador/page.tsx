'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PlayCircle, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchModulosConLecciones, tieneAccesoAcelerador, formatDuracion, type ModuloConLecciones } from '@/lib/acelerador';
import { AceleradorCheckout } from '@/components/AceleradorCheckout';

// Port de AceleradorComponent (Angular, "/acelerador") -- vitrina de venta del curso (sin
// suscripcion vigente) o "Mi Curso" (con suscripcion vigente). AceleradorService ya estaba bien
// implementado, sin bugs -- se porta 1:1.
//
// Pedido explicito del usuario 2026-07-16: se quitan los 2 videos gancho y el texto fijo de
// precio/pitch de la vitrina sin suscripcion -- de aca en mas solo se muestra el contenido real
// que suba el mentor (modulos/lecciones) + el boton de suscripcion, sin ningun video ni copy fijo.
//
// El boton "Ver como visitante" del panel del mentor entra aca con ?preview=suscriptor: aclaracion
// del usuario el mismo dia -- "visitante" en su cabeza significaba "un usuario cualquiera viendo mi
// contenido completo", no la vitrina de venta sin acceso (esa primera version se descarto). El
// mentor YA cae en la rama de "Mi Curso" por su rol sin necesitar este parametro (mas abajo) -- el
// param solo lo deja explicito/a prueba de que ese bypass cambie a futuro.

export default function AceleradorPage() {
  return (
    <Suspense fallback={null}>
      <AceleradorPageInterna />
    </Suspense>
  );
}

function AceleradorPageInterna() {
  const searchParams = useSearchParams();
  const abrirCheckoutInicial = searchParams.get('checkout') === '1';
  const vistaSuscriptor = searchParams.get('preview') === 'suscriptor';

  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const [tieneAcceso, setTieneAcceso] = useState(false);
  const [modulos, setModulos] = useState<ModuloConLecciones[]>([]);
  const [abrirPagoTrigger, setAbrirPagoTrigger] = useState(0);

  useEffect(() => {
    (async () => {
      setModulos(await fetchModulosConLecciones());

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setVerificandoAcceso(false);
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);

      // El mentor sube y organiza el contenido: tiene que poder ver "Mi Curso" exactamente como lo
      // ve un suscriptor real, sin necesitar pagar una suscripcion (?preview=suscriptor solo lo hace
      // explicito para el boton "Ver como visitante" del panel, mismo resultado).
      if (usuario.rolname === 'mentor' || vistaSuscriptor) {
        setTieneAcceso(true);
        setVerificandoAcceso(false);
        return;
      }

      const acceso = await tieneAccesoAcelerador(usuario.id);
      setTieneAcceso(acceso);
      setVerificandoAcceso(false);
    })();
  }, [vistaSuscriptor]);

  const onSuscripcionActivada = useCallback(() => setTieneAcceso(true), []);

  if (verificandoAcceso) return <p className="py-16 text-center text-gray-500">Cargando...</p>;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-8 sm:px-6 lg:px-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">Acelerador de Ventas</h1>
        <p className="mt-1 text-gray-500">El curso avanzado para aprender a vender como dropshipper.</p>
      </div>

      {!tieneAcceso ? (
        <div className="mt-6">
          <div className="text-center">
            <AceleradorCheckout
              buttonLabel="Pagar Suscripcion"
              abrirCheckoutInicial={abrirCheckoutInicial}
              abrirTrigger={abrirPagoTrigger}
              onActivada={onSuscripcionActivada}
            />
          </div>

          <div className="mt-8">
            <h4 className="text-center text-xl font-bold text-gray-800">Contenido del curso</h4>
            {modulos.every((m) => m.lecciones.length === 0) ? (
              <p className="py-10 text-center text-gray-500">Todavia no hay contenido cargado. Muy pronto vas a encontrar aca todo el contenido del curso.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {modulos.flatMap((m) =>
                  m.lecciones.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setAbrirPagoTrigger((n) => n + 1)}
                      className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 text-left shadow-sm transition hover:shadow-lg"
                    >
                      {l.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- miniatura subida por el mentor, Supabase Storage
                        <img src={l.thumbnailUrl} alt="" className="h-64 w-full object-cover" />
                      ) : (
                        <div className="flex h-64 w-full items-center justify-center bg-gray-100">
                          <PlayCircle className="h-14 w-14 text-gray-300" />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-5">
                        <h5 className="text-xl font-extrabold text-gray-800">{l.titulo}</h5>
                        {l.descripcion && <p className="mt-2 flex-1 text-base text-gray-500">{l.descripcion}</p>}
                        <span className="mt-4 inline-block self-start rounded-full bg-green-600 px-5 py-2 text-sm font-bold text-white">VER MÓDULO</span>
                      </div>
                    </button>
                  )),
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          {dataUser?.rolname === 'mentor' && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <span>Estás viendo esto en modo vista previa (mentor) — así lo ve un usuario con suscripción activa.</span>
              {/* <a> normal a proposito, no next/link -- ver comentario en mvid8x2qz1/panel/page.tsx */}
              <a href="/mvid8x2qz1/panel" className="font-semibold underline">
                Volver al panel
              </a>
            </div>
          )}

          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 p-5">
            <Award className="h-10 w-10 text-green-600" />
            <div>
              <span className="text-xs font-bold uppercase text-green-700">Acelerador de Ventas</span>
              <h2 className="text-2xl font-bold text-gray-800">Mi curso</h2>
            </div>
          </div>

          {modulos.every((m) => m.lecciones.length === 0) ? (
            <p className="py-10 text-center text-gray-500">Todavia no hay clases cargadas. Muy pronto vas a encontrar aca todo el contenido del curso.</p>
          ) : (
            // Una sola grilla continua con TODAS las clases (sin una grilla nueva por modulo) --
            // asi siempre empacan 2 por fila sin dejar un hueco enorme cuando un modulo tiene un
            // numero impar de clases (bug real reportado 2026-07-16, capturado con una captura de
            // pantalla real: un modulo con 1 sola clase dejaba la mitad derecha de la fila vacia).
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {modulos.flatMap((m) =>
                m.lecciones.map((l) => (
                  <Link
                    key={l.id}
                    href={`/acelerador/leccion/${l.id}`}
                    className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 shadow-sm transition hover:shadow-lg"
                  >
                    {l.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura subida por el mentor, Supabase Storage
                      <img src={l.thumbnailUrl} alt="" className="h-64 w-full object-cover" />
                    ) : (
                      <div className="flex h-64 w-full items-center justify-center bg-gray-100">
                        <PlayCircle className="h-14 w-14 text-gray-300" />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 p-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{m.titulo}</p>
                        <span className="text-xl font-extrabold text-gray-800">{l.titulo}</span>
                      </div>
                      {l.duracionSegundos != null && <span className="shrink-0 text-sm text-gray-400">{formatDuracion(l.duracionSegundos)}</span>}
                    </div>
                  </Link>
                )),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
