import { createClient } from '@supabase/supabase-js';

// Mismo proyecto Supabase que el frontend Angular (enajheqrfbglcpsqglnb) -- backend
// intacto durante toda la migracion. Sin storageKey custom a proposito: al convivir en
// el mismo dominio (lokomproaqui.com) via rewrites, el JWT en localStorage se comparte
// automaticamente con la app Angular (misma key por defecto de supabase-js).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Blindaje real encontrado necesario 2026-07-16: usuarios reportaron ERR_CONNECTION_TIMED_OUT en
// paginas que consultan Supabase en el servidor (info_text, testimonials, courses) -- confirmado
// con curl contra produccion que esa consulta a veces tarda 15-20s+. En vez de depender solo del
// cache (que igual puede fallar en la primera visita tras un deploy), esta funcion pone un limite
// real: si la consulta no responde a tiempo, sigue con el valor por defecto en vez de colgar la
// pagina entera indefinidamente.
export async function conTimeout<T>(promise: PromiseLike<T>, fallback: T, ms = 3000): Promise<T> {
  return new Promise((resolve) => {
    let resuelto = false;
    const timer = setTimeout(() => {
      if (!resuelto) {
        resuelto = true;
        resolve(fallback);
      }
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        if (!resuelto) {
          resuelto = true;
          clearTimeout(timer);
          resolve(value);
        }
      },
      () => {
        if (!resuelto) {
          resuelto = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      },
    );
  });
}
