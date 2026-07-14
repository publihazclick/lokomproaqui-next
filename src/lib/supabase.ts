import { createClient } from '@supabase/supabase-js';

// Mismo proyecto Supabase que el frontend Angular (enajheqrfbglcpsqglnb) -- backend
// intacto durante toda la migracion. Sin storageKey custom a proposito: al convivir en
// el mismo dominio (lokomproaqui.com) via rewrites, el JWT en localStorage se comparte
// automaticamente con la app Angular (misma key por defecto de supabase-js).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
