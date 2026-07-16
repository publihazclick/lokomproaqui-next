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
  // Boton "Ver como visitante" del panel del mentor (2026-07-16): entra a esta misma pagina con
  // ?preview=visitante para forzar la vista de "sin suscripcion" -- el mentor nunca la ve de otra
  // forma porque mas abajo su rol siempre da acceso directo a "Mi Curso". No toca sesion ni datos
  // reales, es solo un interruptor de que rama de UI se muestra.
  const vistaVisitante = searchParams.get('preview') === 'visitante';

  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const [tieneAcceso, setTieneAcceso] = useState(false);
  const [modulos, setModulos] = useState<ModuloConLecciones[]>([]);

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

      if (vistaVisitante) {
        setTieneAcceso(false);
        setVerificandoAcceso(false);
        return;
      }

      // El mentor sube y organiza el contenido: tiene que poder ver "Mi Curso" exactamente como lo
      // ve un suscriptor real, sin necesitar pagar una suscripcion.
      if (usuario.rolname === 'mentor') {
        setTieneAcceso(true);
        setVerificandoAcceso(false);
        return;
      }

      const acceso = await tieneAccesoAcelerador(usuario.id);
      setTieneAcceso(acceso);
      setVerificandoAcceso(false);
    })();
  }, [vistaVisitante]);

  const onSuscripcionActivada = useCallback(() => setTieneAcceso(true), []);

  if (verificandoAcceso) return <p className="py-16 text-center text-gray-500">Cargando...</p>;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 py-8">
      {vistaVisitante && dataUser?.rolname === 'mentor' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>Estás viendo esta página como la ve un visitante sin suscripción — no es tu vista real de mentor.</span>
          <Link href="/mvid8x2qz1/panel" className="font-semibold underline">
            Volver al panel
          </Link>
        </div>
      )}

      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">Acelerador de Ventas</h1>
        <p className="mt-1 text-gray-500">El curso avanzado para aprender a vender como dropshipper.</p>
      </div>

      {!tieneAcceso ? (
        <div className="mt-6">
          <div className="text-center">
            <AceleradorCheckout buttonLabel="Pagar Suscripcion" abrirCheckoutInicial={abrirCheckoutInicial} onActivada={onSuscripcionActivada} />
          </div>

          <div className="mt-8">
            <h4 className="text-center text-xl font-bold text-gray-800">Contenido del curso</h4>
            {modulos.length === 0 ? (
              <p className="py-10 text-center text-gray-500">Todavia no hay contenido cargado. Muy pronto vas a encontrar aca todo el contenido del curso.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {modulos.map((m) => (
                  <div key={m.id} className="rounded-xl border border-gray-100 p-4 shadow-sm">
                    <h5 className="font-semibold text-gray-800">{m.titulo}</h5>
                    {m.lecciones.map((l) => (
                      <p key={l.id} className="mt-1 text-sm text-gray-500">
                        {l.titulo}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          {dataUser?.rolname === 'mentor' && (
            <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">Estas viendo esto en modo vista previa (mentor) — asi lo ve un suscriptor real.</div>
          )}

          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 p-5">
            <Award className="h-10 w-10 text-green-600" />
            <div>
              <span className="text-xs font-bold uppercase text-green-700">Acelerador de Ventas</span>
              <h2 className="text-2xl font-bold text-gray-800">Mi curso</h2>
            </div>
          </div>

          {modulos.length === 0 ? (
            <p className="py-10 text-center text-gray-500">Todavia no hay clases cargadas. Muy pronto vas a encontrar aca todo el contenido del curso.</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {modulos.map((m) => (
                <div key={m.id} className="rounded-xl border border-gray-100 p-4 shadow-sm">
                  <h5 className="font-semibold text-gray-800">{m.titulo}</h5>
                  <div className="mt-2 space-y-1">
                    {m.lecciones.map((l) => (
                      <Link key={l.id} href={`/acelerador/leccion/${l.id}`} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                        <PlayCircle className="h-4 w-4 text-gray-400" />
                        <span className="flex-1">{l.titulo}</span>
                        {l.duracionSegundos != null && <span className="text-xs text-gray-400">{formatDuracion(l.duracionSegundos)}</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
