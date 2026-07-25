'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';

// Rediseño 2026-07-25 (pedido explicito del usuario: "revisa toda la pagina de punta a punta...
// que se vean a la altura de una plataforma unicornio" -- referido a los mensajes que aparecen al
// dar click en cualquier boton). Este componente es el UNICO punto de donde salen esos mensajes en
// todo el sitio (44+ pantallas lo usan via useToast()/<Toast>) -- redisenarlo aca de una vez sube
// la calidad visual de toda la plataforma sin tener que tocar cada pantalla una por una.
//
// La interfaz externa (`mensaje: string | null`, `mostrar(texto)`, `<Toast mensaje={mensaje} />`)
// se mantiene 100% compatible a proposito -- ninguna de esas 44+ pantallas necesita cambiar una
// sola linea para heredar el nuevo diseño. `tipo` (exito/error/advertencia) es opcional y nuevo:
// si no se pasa explicito, se adivina del propio texto del mensaje con un heuristico simple (ya
// que reescribir los ~150 mostrar('...') sueltos del proyecto para agregarles un tipo explicito
// no es proporcional al pedido de HOY, que es de diseño visual, no de reescribir cada pantalla).
export type ToastTipo = 'exito' | 'error' | 'advertencia';

function adivinarTipo(texto: string): ToastTipo {
  const t = texto.toLowerCase();
  if (/\berror\b|no pudimos|no se pudo|no se pudieron|\bproblemas?\b/.test(t)) return 'error';
  if (/\bfalta(n)?\b|\bdebes\b|selecciona|revisa lo marcado|lo sentimos|no es v[aá]lid|inv[aá]lid|\bcompleta(r)?\b|introduc|obligatori/.test(t)) return 'advertencia';
  return 'exito';
}

export function useToast() {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [tipo, setTipo] = useState<ToastTipo>('exito');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrar = useCallback((texto: string, tipoExplicito?: ToastTipo) => {
    if (timer.current) clearTimeout(timer.current);
    setMensaje(texto);
    setTipo(tipoExplicito ?? adivinarTipo(texto));
    timer.current = setTimeout(() => setMensaje(null), 5000);
  }, []);

  return { mensaje, tipo, mostrar };
}

const ESTILOS: Record<ToastTipo, { Icono: typeof CheckCircle2; bg: string; borde: string; texto: string; icono: string }> = {
  exito: { Icono: CheckCircle2, bg: 'bg-emerald-50', borde: 'border-emerald-200', texto: 'text-emerald-900', icono: 'text-emerald-600' },
  error: { Icono: XCircle, bg: 'bg-red-50', borde: 'border-red-200', texto: 'text-red-900', icono: 'text-red-600' },
  advertencia: { Icono: AlertTriangle, bg: 'bg-amber-50', borde: 'border-amber-200', texto: 'text-amber-900', icono: 'text-amber-600' },
};

// `tipo` es opcional aca tambien -- si una pantalla vieja solo pasa `mensaje` (sin tipo, porque
// nunca lo tuvo), se recalcula del texto igual que en useToast() para no dejar ningun mensaje sin
// color/icono por no haber sido "migrado".
export function Toast({ mensaje, tipo }: { mensaje: string | null; tipo?: ToastTipo }) {
  const [oculto, setOculto] = useState(false);

  // Un mensaje nuevo (aunque sea el mismo texto que el anterior) siempre debe volver a mostrarse.
  useEffect(() => {
    setOculto(false);
  }, [mensaje]);

  if (!mensaje || oculto) return null;
  const estilo = ESTILOS[tipo ?? adivinarTipo(mensaje)];
  const Icono = estilo.Icono;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[3000] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:justify-start sm:px-0 sm:pb-0"
      role="status"
      aria-live="polite"
    >
      <div
        className={`toast-entrar pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 shadow-lg ${estilo.bg} ${estilo.borde}`}
      >
        <Icono className={`mt-0.5 h-5 w-5 shrink-0 ${estilo.icono}`} aria-hidden="true" />
        <p className={`flex-1 text-sm font-medium leading-snug ${estilo.texto}`}>{mensaje}</p>
        <button
          onClick={() => setOculto(true)}
          aria-label="Cerrar mensaje"
          className={`-m-1 shrink-0 rounded-full p-1 transition-colors hover:bg-black/5 ${estilo.icono}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
