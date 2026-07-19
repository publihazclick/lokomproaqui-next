import type { Metadata } from "next";

// Panel admin: ninguna de las ~35 subrutas de aca abajo tenia robots:noindex, asi que en teoria
// eran indexables si algun buscador las descubria. Este layout aplica a TODO /config/** (Next
// mergea metadata de layouts padres con las de cada page/layout hijo, asi que esto no lo pisa
// ningun title particular de cada subruta).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  return children;
}
