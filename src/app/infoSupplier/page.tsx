import { supabase, conTimeout } from '@/lib/supabase';
import { ContadorShipping } from '@/components/ContadorShipping';

export const metadata = {
  title: 'Proveedores Verificados | LokomproAqui',
  description: 'Conoce a nuestros proveedores verificados y arma dropshipping con ellos.',
};

// CORREGIDO 2026-07-16: force-dynamic causaba timeouts reales (la consulta a Supabase a veces
// tarda 15-20s+, confirmado con curl contra produccion -- sin ningun cache cada visita quedaba
// expuesta a esa demora). Con revalidate corto, casi todas las visitas reciben una version ya
// guardada mientras se regenera sola en segundo plano.
export const revalidate = 5;

interface Supplier {
  id: string;
  avatar_url: string | null;
}

export default async function InfoSupplierPage() {
  const { data, count } = await conTimeout(
    supabase.from('profiles').select('id, avatar_url, roles!inner(name)', { count: 'exact' }).eq('roles.name', 'proveedor').range(0, 19),
    { data: null, count: null, error: null } as any,
  );

  const listSupplier = (data ?? []) as unknown as Supplier[];

  return (
    <div>
      <div className="bg-gradient-to-br from-[#0177a8] to-[#02a0e3] px-6 py-12 text-white sm:px-16 sm:py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 sm:flex-row">
          <div className="aspect-video w-full overflow-hidden rounded-2xl shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)] sm:w-1/2">
            <iframe
              className="h-full w-full"
              frameBorder={0}
              allowFullScreen
              src="https://www.youtube.com/embed/qMYKvn5dbvg?si=d1e8bC_bHLgKaJdn"
            />
          </div>
          <div className="w-full sm:w-1/2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/70">Portal de proveedores</span>
            <h5 className="mt-2 text-base leading-relaxed text-white/95">
              Te doy la bienvenida a nuestro nuevo portal de proveedores verificados LokomproAqui, aquí vas a
              encontrar a los mejores y más confiables proveedores de nuestra plataforma. Ellos te entregarán
              material gráfico para tus campañas, podremos conocer sus políticas de garantías y si quieres hacer
              dropshipping con ellos te dejaremos un botón de contacto para que un asesor te atienda en el menor
              tiempo posible. ¡Ve y conócelos!
            </h5>
          </div>
        </div>
      </div>

      <ContadorShipping />

      <section className="pb-4 pt-14 text-center">
        <h3 className="text-lg font-semibold text-[#0177a8]">Nuestros</h3>
        <h1 className="text-4xl font-extrabold tracking-tight text-[#02a0e3] sm:text-5xl">PROVEEDORES</h1>
      </section>

      {listSupplier.length > 0 ? (
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-5 px-4 py-10 sm:grid-cols-4">
          {listSupplier.map((item) => (
            <div
              key={item.id}
              className="group overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="aspect-square overflow-hidden rounded-xl bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element -- avatar de usuario en Supabase Storage, no de /public */}
                <img
                  src={item.avatar_url ?? '/assets/producto.jpg'}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-gray-500">Muy pronto vas a ver acá a nuestros proveedores verificados.</p>
      )}

      <p className="pb-10 text-center text-lg font-semibold text-gray-500">+ {count ?? 0} Proveedores</p>

      <div className="flex justify-center pb-16">
        <a
          href="/registro"
          className="rounded-full bg-gray-900 px-7 py-3.5 text-sm font-bold text-white shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-black hover:shadow-lg"
        >
          Registrarme como Proveedor
        </a>
      </div>
    </div>
  );
}
