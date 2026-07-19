import { supabase, conTimeout } from '@/lib/supabase';
import { SessionRedirect } from '@/components/SessionRedirect';
import { TutorialesClient } from './TutorialesClient';
import type { CategoriaConVideos, CursoVideo } from './types';

export const metadata = {
  title: 'Tutoriales para Vender por Internet con Dropshipping | LokomproAqui',
  description: 'Aprende a usar LokomproAqui paso a paso: como vender, como comprar, como despachar y mucho mas.',
  keywords: 'tutoriales dropshipping, como vender por internet, tutorial ventas online',
  alternates: { canonical: '/tutoriales' },
};

// El admin edita los tutoriales desde /config/cursos sin volver a deployar Next.js -- sin esto,
// Next.js prerenderiza la pagina UNA vez en el build y un video nuevo no aparece hasta el
// proximo deploy. CORREGIDO 2026-07-16: force-dynamic causaba timeouts reales (la consulta a
// Supabase a veces tarda 15-20s+, confirmado con curl contra produccion). Con revalidate corto,
// casi todas las visitas reciben una version ya guardada mientras se regenera sola.
export const revalidate = 5;

// Migrado 1:1 desde src/app/components/tutoriales (Angular) -- ver memoria
// lokomproaqui-nextjs-migration, Fase 1. Misma tabla `courses` (categorias = parent_id null,
// videos = parent_id de la categoria), misma URL /tutoriales. A diferencia del original
// Angular (que pedia los datos en el cliente y mostraba un spinner), esto corre en el
// servidor: la pagina llega con el contenido ya adentro, sin "Cargando tutoriales...".
export default async function TutorialesPage() {
  const { data } = await conTimeout(supabase.from('courses').select('*').order('sort_order'), { data: null, error: null } as any);
  const todos = (data ?? []) as CursoVideo[];

  const categorias: CategoriaConVideos[] = todos
    .filter((c) => !c.parent_id)
    .map((cat) => ({ ...cat, videos: todos.filter((v) => v.parent_id === cat.id) }))
    .filter((cat) => cat.videos.length > 0);

  return (
    <>
      {/* Pedido explicito del usuario 2026-07-19: esta pagina tiene contenido real (videos de la
          academia) y estaba enlazada desde la landing publica /info sin exigir sesion -- un
          visitante anonimo llegaba aca con un click, sin loguearse nunca. Mismo patron "island"
          cliente que /info (server component con ISR no puede leer la sesion del lado del
          servidor). */}
      <SessionRedirect when="logged-out" to="/info" />
      <TutorialesClient categorias={categorias} />
    </>
  );
}
