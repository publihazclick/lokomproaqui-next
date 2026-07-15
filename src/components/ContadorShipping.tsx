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
    <section className="grid grid-cols-2 gap-3 bg-[#f2f2f2] p-3 md:flex md:flex-wrap md:justify-between md:gap-0 md:p-5">
      {SECUENCIA.map(({ key, titulo, Icon }) => (
        <div key={key} className="box-border rounded-md border border-gray-200 bg-white p-4 text-center md:m-2.5 md:flex-1 md:basis-1/5 md:p-5">
          <Icon className="mx-auto mb-2 h-9 w-9 text-[#02a0e3]" />
          <h1 className="font-bold text-[#757575]">+{valores[key].toLocaleString('es-CO')}</h1>
          <p className="text-sm">{titulo}</p>
        </div>
      ))}
    </section>
  );
}
