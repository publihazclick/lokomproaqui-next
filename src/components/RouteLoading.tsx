import { Loader2 } from 'lucide-react';

// Estado de carga a nivel de ruta (App Router): se muestra mientras Next.js trae el chunk/RSC del
// segmento de ruta durante una navegacion -- ninguna de las 65 rutas del sitio tenia esto antes
// (todas mostraban una pantalla en blanco hasta que el JS de la pagina terminaba de descargar e
// hidratar). Compartido por los 3 loading.tsx del sitio (raiz, /config, /front) via herencia de
// segmentos del App Router, para no repetir el mismo marcado 3 veces.
export function RouteLoading() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#02a0e3]" />
    </div>
  );
}
