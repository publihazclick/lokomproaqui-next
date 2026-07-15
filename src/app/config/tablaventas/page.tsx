'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchTablaVentas, type TablaVentaRow } from '@/lib/ventas';
import { formatCOP } from '@/lib/cartStore';

// Port de VentastableComponent (Angular, "/config/tablaventas") -- tabla ancha de exportacion con
// todas las columnas de cada venta (vendedor incluido). Ver src/lib/ventas.ts (fetchTablaVentas)
// para el detalle de las 3 columnas que se omiten por no tener dato real ("Cedula Cliente", "Talla"
// y "Email Vendedor") y por que "Porcentaje Ganancias" si es real (`profiles.commission_pct`).

export default function TablaVentasPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [filas, setFilas] = useState<TablaVentaRow[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario: DataUserCompleto = await fetchDataUserCompleto(sessionData.session.user.id);
      const esAdmin = usuario.rolname === 'administrador';
      setFilas(await fetchTablaVentas(esAdmin ? undefined : usuario.id));
      setEstado('listo');
    });
  }, []);

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Tabla de Ventas</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-left font-semibold uppercase text-gray-500">
                <th className="py-2 pr-3">Numero Guia</th>
                <th className="py-2 pr-3">Barrio Cliente</th>
                <th className="py-2 pr-3">Ciudad Cliente</th>
                <th className="py-2 pr-3">Direccion Cliente</th>
                <th className="py-2 pr-3">Nombre Cliente</th>
                <th className="py-2 pr-3">Telefono Cliente</th>
                <th className="py-2 pr-3">Tipo Venta</th>
                <th className="py-2 pr-3">Fecha Venta</th>
                <th className="py-2 pr-3">Ganancias Vendedor</th>
                <th className="py-2 pr-3">Cantidad</th>
                <th className="py-2 pr-3">Precio</th>
                <th className="py-2 pr-3">Precio Total</th>
                <th className="py-2 pr-3">Nombre Vendedor</th>
                <th className="py-2 pr-3">Apellido Vendedor</th>
                <th className="py-2 pr-3">Ciudad Vendedor</th>
                <th className="py-2 pr-3">Direccion Vendedor</th>
                <th className="py-2 pr-3">Telefono Vendedor</th>
                <th className="py-2 pr-3">Porcentaje Ganancias</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3">{row.numeroGuia || '—'}</td>
                  <td className="py-2 pr-3">{row.barrio}</td>
                  <td className="py-2 pr-3">{row.ciudad}</td>
                  <td className="py-2 pr-3">{row.direccionCliente}</td>
                  <td className="py-2 pr-3">{row.nombreCliente}</td>
                  <td className="py-2 pr-3">{row.telefonoCliente}</td>
                  <td className="py-2 pr-3">{row.tipo}</td>
                  <td className="py-2 pr-3">{new Date(row.fecha).toLocaleString('es-CO')}</td>
                  <td className="py-2 pr-3">$ {formatCOP(row.ganancias)}</td>
                  <td className="py-2 pr-3">{row.cantidad}</td>
                  <td className="py-2 pr-3">$ {formatCOP(row.precio)}</td>
                  <td className="py-2 pr-3">$ {formatCOP(row.total)}</td>
                  <td className="py-2 pr-3">{row.vendedorNombre}</td>
                  <td className="py-2 pr-3">{row.vendedorApellido}</td>
                  <td className="py-2 pr-3">{row.vendedorCiudad}</td>
                  <td className="py-2 pr-3">{row.vendedorDireccion}</td>
                  <td className="py-2 pr-3">{row.vendedorTelefono}</td>
                  <td className="py-2 pr-3">{row.porcentaje != null ? `${row.porcentaje}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length === 0 && <p className="py-10 text-center text-gray-500">No hay ventas para mostrar.</p>}
        </div>
      </div>
    </div>
  );
}
