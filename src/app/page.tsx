import { redirect } from "next/navigation";

// La raiz real de Angular (tienda-routing.module.ts, path:'') tambien es solo un redirect a
// /info -- no hay una homepage propia que reconstruir. Se replica el mismo comportamiento real.

export default function Home() {
  redirect("/info");
}
