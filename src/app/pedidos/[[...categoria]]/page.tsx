'use client';

import { use } from 'react';
import { ArticuloCarritoPage } from '@/components/ArticuloCarritoPage';

export default function PedidosPage({ params }: { params: Promise<{ categoria?: string[] }> }) {
  const { categoria } = use(params);
  return <ArticuloCarritoPage modo="pedidos" categoriaId={categoria?.[0]} />;
}
