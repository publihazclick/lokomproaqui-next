'use client';

import { use } from 'react';
import { ArticuloCarritoPage } from '@/components/ArticuloCarritoPage';

export default function RealizarVentaPage({ params }: { params: Promise<{ categoria?: string[] }> }) {
  const { categoria } = use(params);
  return <ArticuloCarritoPage modo="realizarventa" categoriaId={categoria?.[0]} />;
}
