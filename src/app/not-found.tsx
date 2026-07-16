import { redirect } from "next/navigation";

// Equivalente real a { path: '**', redirectTo: '/info' } en tienda-routing.module.ts (Angular) --
// cualquier ruta no reconocida cae en /info, igual que en produccion hoy, en vez de un 404 generico.

export default function NotFound() {
  redirect("/info");
}
