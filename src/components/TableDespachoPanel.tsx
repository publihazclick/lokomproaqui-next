'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import type { ItemDespacho } from '@/lib/misDespacho';

const COLOR_FILA: Record<number, string> = {
  0: '#83bafa33',
  1: '#95ffac33',
  2: '#ff759833',
  3: '#f6ffa833',
  6: '#dcedc133',
};

interface TableDespachoPanelProps {
  cargar: () => Promise<{ data: ItemDespacho[]; total: number }>;
  mostrarTotal?: boolean;
  onVerVenta: (ventaId: number) => void;
}

export function TableDespachoPanel({ cargar, mostrarTotal, onVerVenta }: TableDespachoPanelProps) {
  const [items, setItems] = useState<ItemDespacho[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    cargar().then((res) => {
      setItems(res.data);
      setTotal(res.total);
      setCargando(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cargando) return <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>;

  return (
    <div className="mt-3">
      {mostrarTotal && (
        <p className="mb-3 text-sm font-semibold text-gray-700">
          Total: <span className="text-[#0d6efd]">$ {total.toLocaleString('es-CO')} COP</span>
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="py-2 pr-3">Acciones</th>
              <th className="py-2 pr-3">Producto</th>
              <th className="py-2 pr-3">Talla/Color</th>
              <th className="py-2 pr-3">Cant.</th>
              <th className="py-2 pr-3">Valor bodega</th>
              <th className="py-2 pr-3">Cliente</th>
              <th className="py-2 pr-3">Guía</th>
              <th className="py-2 pr-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-gray-100" style={{ background: COLOR_FILA[it.ventaEstado] }}>
                <td className="py-2 pr-3">
                  <button onClick={() => onVerVenta(it.ventaId)} className="flex items-center gap-1 rounded bg-[#0d6efd] px-2 py-1 text-xs text-white">
                    <Eye className="h-3 w-3" /> Ver
                  </button>
                </td>
                <td className="py-2 pr-3">{it.productoNombre}</td>
                <td className="py-2 pr-3">
                  {it.talla || '—'} {it.color ? `/ ${it.color}` : ''}
                </td>
                <td className="py-2 pr-3">{it.cantidad}</td>
                <td className="py-2 pr-3">$ {it.precioVendedor.toLocaleString('es-CO')}</td>
                <td className="py-2 pr-3">
                  {it.nombreCliente}
                  <br />
                  <span className="text-xs text-gray-400">{it.telefonoCliente}</span>
                </td>
                <td className="py-2 pr-3 text-xs">
                  {it.numeroGuia ? (
                    <>
                      {it.numeroGuia}
                      <br />
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        {it.transportadoraLogo && (
                          // eslint-disable-next-line @next/next/no-img-element -- logo de transportadora
                          <img src={it.transportadoraLogo} alt="" className="h-4 w-4 shrink-0 rounded bg-white object-contain" />
                        )}
                        {it.transportadora}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-400">Sin guía</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs">{new Date(it.fecha).toLocaleDateString('es-CO')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-10 text-center text-gray-500">No hay items en esta categoría.</p>}
      </div>
    </div>
  );
}
