'use client';

import { useCallback, useRef, useState } from 'react';

// Equivalente minimo a ToolsService.presentToast (Angular, MatSnackBar: fondo oscuro, abajo,
// se cierra solo a los 5s) -- usado en las paginas de catalogo/carrito de Fase 3.
export function useToast() {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrar = useCallback((texto: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMensaje(texto);
    timer.current = setTimeout(() => setMensaje(null), 5000);
  }, []);

  return { mensaje, mostrar };
}

export function Toast({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[3000] -translate-x-1/2 rounded px-4 py-3 text-sm text-white shadow-lg sm:left-4 sm:translate-x-0" style={{ background: '#323232' }}>
      {mensaje}
    </div>
  );
}
