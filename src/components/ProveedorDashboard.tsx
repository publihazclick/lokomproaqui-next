'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, PackageX, Printer, Wallet, Truck } from 'lucide-react';
import { fetchSaldoProveedor } from '@/lib/bank';
import { fetchGuiasPorImprimir, fetchGuiasEnPreparacion } from '@/lib/misDespacho';
import { fetchResumenInventarioProveedor } from '@/lib/productos';
import { formatCOP } from '@/lib/cartStore';

// "Inicio" para un proveedor logueado (/articulo cuando dataUser.rolname === 'proveedor').
// Pedido explicito del usuario 2026-07-25: un proveedor no debe ver el catalogo de compra de la
// plataforma (ni sus propios productos entre los demas) -- esa vista es para vendedores/compradores.
// En su lugar, esto es un resumen operativo de SU bodega: cuanto tiene para cobrar, cuantas guias
// necesitan accion suya ahora, y si le queda stock agotado -- con accesos directos a las pantallas
// donde ya puede resolver cada cosa (Mis Órdenes / Edición Productos / Módulo Contable).

function TarjetaResumen({
  Icon,
  titulo,
  valor,
  detalle,
  href,
  color,
}: {
  Icon: typeof Package;
  titulo: string;
  valor: string;
  detalle?: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href} className="flex flex-col gap-2 rounded-xl border border-gray-100 p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}1a` }}>
          <Icon className="h-[18px] w-[18px]" style={{ color }} />
        </span>
        <p className="text-xs font-semibold text-gray-600">{titulo}</p>
      </div>
      <p className="text-2xl font-bold text-gray-800">{valor}</p>
      {detalle && <p className="text-[11px] text-gray-400">{detalle}</p>}
    </Link>
  );
}

export function ProveedorDashboard({ userId, nombre }: { userId: string; nombre: string | null }) {
  const [estado, setEstado] = useState<'cargando' | 'listo'>('cargando');
  const [saldo, setSaldo] = useState(0);
  const [porImprimir, setPorImprimir] = useState(0);
  const [enPreparacion, setEnPreparacion] = useState(0);
  const [inventario, setInventario] = useState({ totalProductos: 0, agotados: 0 });

  useEffect(() => {
    let activo = true;
    Promise.all([
      fetchSaldoProveedor(userId),
      fetchGuiasPorImprimir(userId),
      fetchGuiasEnPreparacion(userId),
      fetchResumenInventarioProveedor(userId),
    ]).then(([s, imprimir, preparacionRes, res]) => {
      if (!activo) return;
      setSaldo(s);
      setPorImprimir(imprimir.data.length);
      setEnPreparacion(preparacionRes.data.length);
      setInventario(res);
      setEstado('listo');
    });
    return () => {
      activo = false;
    };
  }, [userId]);

  return (
    <div className="mx-auto w-full max-w-[1000px] px-3 py-6">
      <h3 className="text-xl font-bold text-gray-800">Hola{nombre ? `, ${nombre}` : ''}</h3>
      <p className="mt-1 text-sm text-gray-500">Resumen de tu bodega</p>

      {estado === 'cargando' ? (
        <p className="py-10 text-center text-sm text-gray-400">Cargando...</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TarjetaResumen
            Icon={Wallet}
            titulo="Saldo disponible"
            valor={`$ ${formatCOP(saldo)}`}
            detalle="Módulo Contable"
            href="/config/bank/index"
            color="#16a34a"
          />
          <TarjetaResumen
            Icon={Printer}
            titulo="Guías por imprimir"
            valor={String(porImprimir)}
            detalle="Ventas listas para despachar"
            href="/config/misDespacho"
            color="#0d6efd"
          />
          <TarjetaResumen
            Icon={Truck}
            titulo="Guías en preparación"
            valor={String(enPreparacion)}
            detalle="Esperando recogida"
            href="/config/misDespacho"
            color="#f59e0b"
          />
          <TarjetaResumen
            Icon={inventario.agotados > 0 ? PackageX : Package}
            titulo="Productos agotados"
            valor={String(inventario.agotados)}
            detalle={`${inventario.totalProductos} productos activos`}
            href="/config/productos"
            color={inventario.agotados > 0 ? '#dc2626' : '#6b7280'}
          />
        </div>
      )}
    </div>
  );
}
