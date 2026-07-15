'use client';

import { useEffect, useRef, useState } from 'react';
import { Monitor, Settings, TrendingUp, MessageCircle } from 'lucide-react';

// Port de src/app/layout/contador-shipping (Angular): contador animado con numeros fijos
// (marketing, no viene de datos reales). Mismo orden secuencial (un recuadro termina antes
// de que arranque el siguiente) y mismos targets/steps que el original. Iconos: lucide en vez
// de Font Awesome -- el proyecto Angular ya evito material-icons por el mismo motivo (fuente
// de icono que puede tardar/fallar en cargar en celular), lucide es SVG, no depende de fuente.
const SECUENCIA = [
  { key: 'contadorC', target: 12317, step: 160, titulo: 'Comercios Registrados', Icon: Monitor },
  { key: 'contadorD', target: 236, step: 5, titulo: 'Proveedores dropshipping', Icon: Settings },
  { key: 'contadorE', target: 2457, step: 33, titulo: 'Envios diarios', Icon: TrendingUp },
  { key: 'contadorM', target: 1100, step: 22, titulo: 'Municipios bajo Cobertura', Icon: MessageCircle },
] as const;

export function ContadorShipping() {
  const [valores, setValores] = useState({ contadorC: 0, contadorD: 0, contadorE: 0, contadorM: 0 });
  const idxRef = useRef(0);

  useEffect(() => {
    const intervalo = setInterval(() => {
      if (idxRef.current >= SECUENCIA.length) {
        clearInterval(intervalo);
        return;
      }
      const item = SECUENCIA[idxRef.current];
      setValores((prev) => {
        const next = Math.min(prev[item.key] + item.step, item.target);
        if (next >= item.target) idxRef.current += 1;
        return { ...prev, [item.key]: next };
      });
    }, 20);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <section className="bg-[#f7f9fb] px-3 py-8 sm:px-6">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {SECUENCIA.map(({ key, titulo, Icon }) => (
          <div
            key={key}
            className="group rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#0177a8]/10 to-[#02a0e3]/10 text-[#0177a8] transition-colors duration-200 group-hover:from-[#0177a8] group-hover:to-[#02a0e3] group-hover:text-white">
              <Icon className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <h1 className="text-xl font-extrabold text-gray-800 sm:text-2xl">+{valores[key].toLocaleString('es-CO')}</h1>
            <p className="mt-1 text-xs font-semibold text-gray-500 sm:text-sm">{titulo}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
