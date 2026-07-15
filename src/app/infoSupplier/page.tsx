import { supabase } from '@/lib/supabase';
import { ContadorShipping } from '@/components/ContadorShipping';

export const metadata = {
  title: 'Proveedores Verificados | LokomproAqui',
  description: 'Conoce a nuestros proveedores verificados y arma dropshipping con ellos.',
};

// Se refresca cada 60s -- la lista de proveedores cambia cuando alguien se registra o un
// admin activa/desactiva una cuenta desde el panel (todavia en Angular).
export const revalidate = 60;

interface Supplier {
  id: string;
  avatar_url: string | null;
}

export default async function InfoSupplierPage() {
  const { data, count } = await supabase
    .from('profiles')
    .select('id, avatar_url, roles!inner(name)', { count: 'exact' })
    .eq('roles.name', 'proveedor')
    .range(0, 19);

  const listSupplier = (data ?? []) as unknown as Supplier[];

  return (
    <div>
      <div className="bg-[#02a0e3] px-6 py-10 text-white sm:px-16 sm:py-14">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 sm:flex-row">
          <div className="aspect-video w-full sm:w-1/2">
            <iframe
              className="h-full w-full"
              frameBorder={0}
              allowFullScreen
              src="https://www.youtube.com/embed/qMYKvn5dbvg?si=d1e8bC_bHLgKaJdn"
            />
          </div>
          <div className="w-full sm:w-1/2">
            <h5 className="text-base leading-relaxed">
              Te doy la bienvenida a nuestro nuevo portal de proveedores verificados lokomproaqui, aquí vas a
              encontrar a los mejores y más confiables proveedores de nuestra plataforma. Ellos te entregarán
              material gráfico para tus campañas, podremos conocer sus políticas de garantías y si quieres hacer
              dropshipping con ellos te dejarémos un botón de contacto para que un asesor te atienda en el menor
              tiempo posible. ¡Ve y conócelos!
            </h5>
          </div>
        </div>
      </div>

      <ContadorShipping />

      <section className="py-8 text-center text-[#02a0e3]">
        <h3 className="text-xl font-bold">Nuestros</h3>
        <h1 className="text-4xl font-bold">PROVEEDORES</h1>
      </section>

      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 sm:grid-cols-4">
        {listSupplier.map((item) => (
          <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- avatar de usuario en Supabase Storage, no de /public */}
            <img src={item.avatar_url ?? '/assets/producto.jpg'} alt="" className="aspect-square w-full rounded object-cover" />
          </div>
        ))}
      </div>

      <p className="py-6 text-center text-gray-600">+ {count ?? 0} Proveedores</p>

      <div className="flex justify-center pb-12">
        <a href="/registro" className="rounded-full bg-black px-6 py-3 font-semibold text-white hover:opacity-90">
          Registrarme como Proveedor
        </a>
      </div>
    </div>
  );
}
