import { Package, Truck, Route, Warehouse, Wallet } from 'lucide-react';
import { ContadorShipping } from '@/components/ContadorShipping';

export const metadata = {
  title: 'Portal | LokomproAqui',
};

// Port desde src/app/layout/portal (Angular): la version original mostraba 5 tarjetas con
// una imagen placeholder rota ("noimagen.jpg", contenido nunca terminado) -- se reemplaza por
// iconos reales con el mismo tratamiento visual del resto del sitio migrado, en vez de portar
// un placeholder roto tal cual (ver feedback_lokomproaqui_unicornio: la condicion para que el
// nuevo diseno valga la pena es que sea realmente prolijo, no un calco de algo sin terminar).
const ITEMS = [
  { label: 'Dropshipping', Icon: Package },
  { label: 'Envíos Contraentrega', Icon: Truck },
  { label: 'Envíos y Logística', Icon: Route },
  { label: 'Cobertura Nacional', Icon: Warehouse },
  { label: 'Desembolso Rápido', Icon: Wallet },
];

export default function PortalPage() {
  return (
    <div>
      <div className="bg-gradient-to-br from-[#0177a8] to-[#02a0e3] px-6 py-14 text-center text-white sm:px-16 sm:py-20">
        <h3 className="text-sm font-bold tracking-wide text-white/85 sm:text-base">SOMOS EL MEJOR ALIADO PARA</h3>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-5xl">VENDER TUS PRODUCTOS</h1>
        <h2 className="mt-1 text-base font-semibold text-white/90 sm:text-lg">Y GENERAR INGRESOS SIN INVERTIR</h2>
      </div>

      <ContadorShipping />

      <section className="mx-auto max-w-5xl px-4 py-14 sm:py-16">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 sm:gap-5">
          {ITEMS.map(({ label, Icon }) => (
            <div
              key={label}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#0177a8]/10 to-[#02a0e3]/10 text-[#0177a8] transition-colors duration-200 group-hover:from-[#0177a8] group-hover:to-[#02a0e3] group-hover:text-white">
                <Icon className="h-7 w-7" strokeWidth={1.75} />
              </span>
              <h6 className="text-sm font-bold text-gray-800">{label}</h6>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
