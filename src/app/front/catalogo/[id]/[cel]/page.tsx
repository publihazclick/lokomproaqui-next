'use client';

import { use } from 'react';
import { FrontProductoDetalle } from '@/components/FrontProductoDetalle';

// Port de CatalogoComponent (Angular, modulo `portada`) -- ver FrontProductoDetalle.tsx,
// consolidado con /front/productosView/[id]/[cel] (misma pantalla real en el original).

export default function FrontCatalogoPage({ params }: { params: Promise<{ id: string; cel: string }> }) {
  const { id, cel } = use(params);
  return <FrontProductoDetalle productoId={id} telefono={cel} />;
}
