'use client';

import { use } from 'react';
import { FrontProductoDetalle } from '@/components/FrontProductoDetalle';

// Port de ProductosViewComponent (Angular) -- ver FrontProductoDetalle.tsx, consolidado con
// /front/catalogo/[id]/[cel] (misma pantalla real en el original).

export default function FrontProductosViewPage({ params }: { params: Promise<{ id: string; cel: string }> }) {
  const { id, cel } = use(params);
  return <FrontProductoDetalle productoId={id} telefono={cel} />;
}
