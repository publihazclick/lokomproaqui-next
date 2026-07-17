'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Eye, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchVentas, eliminarVenta, VENTA_ESTADO_LABEL, type VentaRow } from '@/lib/ventas';
import { fechaMedium } from '@/lib/format';
import { FormVentaDetalleModal } from '@/components/FormVentaDetalleModal';

// Port 1:1 (diseno) de VentasClienteComponent (Angular, "Ventas Posibles" -- "Autorizar Despacho"
// en el menu). Verificado pixel a pixel contra una captura real del sitio Angular en vivo
// (lokomproaqui.vercel.app/config/ventasPosibles) el 2026-07-17, a pedido explicito del usuario
// (los tutoriales del equipo se grabaron con esta interfaz, cero margen de error).
//
// Hallazgos reales de la captura que cambian el diseño anterior de esta pagina:
// - El titulo real es "Ventas Posibles" (no "Posibles Ventas").
// - NO hay filtros de vendedor/estado por dropdown -- Angular solo tiene una caja de busqueda de
//   texto libre (nunca se conecto ningun <select> en el HTML real, aunque el .ts tiene logica de
//   filtro por vendedor/estado, es codigo muerto sin UI).
// - "Total Utilidad de venta" esta comentado en el HTML real (<!-- -->) -- nunca se muestra.
// - Filtro por defecto: solo "Pendiente" (ven_estado=0).
// - Selector de fila con checkbox + boton de eliminar (borrado logico, con el mismo guard real de
//   "no se puede eliminar una venta ya despachada").
// - Paginacion real (mat-paginator), no scroll infinito con "Ver mas".
// - Sin colores de fondo por estado en las filas -- las clases .colorEntrante/.colorCompletado/etc
//   existen en el .scss del componente pero NO se ven aplicadas en la captura real (fondo plano).
const LIMIT = 10;

// Icono real de WhatsApp (no existe en lucide-react, marcas registradas no se incluyen ahi) --
// pedido explicito del usuario: que se vea como el logo real, no un globo de chat generico.
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.34.663 4.523 1.812 6.377L4 29l7.823-1.771A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm6.997 16.943c-.297.836-1.47 1.53-2.41 1.73-.64.135-1.475.243-4.29-.92-3.6-1.49-5.916-5.14-6.096-5.38-.173-.24-1.456-1.938-1.456-3.696 0-1.759.917-2.622 1.243-2.983.297-.328.65-.41.868-.41.218 0 .436.002.626.011.2.01.47-.076.735.561.297.716.998 2.474 1.086 2.653.09.18.15.39.03.63-.12.24-.18.39-.36.6-.18.21-.378.469-.54.63-.18.18-.368.375-.158.735.21.36.933 1.542 2.003 2.497 1.376 1.228 2.535 1.608 2.895 1.788.36.18.57.15.78-.09.21-.24.9-1.05 1.14-1.41.24-.36.48-.3.81-.18.33.12 2.088.986 2.448 1.166.36.18.6.27.69.42.09.15.09.87-.208 1.706Z" />
    </svg>
  );
}

export default function VentasPosiblesPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [checks, setChecks] = useState<Set<number>>(new Set());
  const [eliminando, setEliminando] = useState(false);
  const [ventaAbierta, setVentaAbierta] = useState<number | null>(null);

  const dataUserRef = useRef<DataUserCompleto | null>(null);

  const cargar = useCallback(async (paginaActual: number, termino: string) => {
    if (!dataUserRef.current) return;
    setCargando(true);
    const esAdmin = dataUserRef.current.rolname === 'administrador';
    const res = await fetchVentas({
      sellerId: esAdmin ? undefined : dataUserRef.current.id,
      estadoFiltro: termino.trim() ? 'todos' : '0',
      search: termino.trim() || undefined,
      page: paginaActual,
      limit: LIMIT,
    });
    setVentas(res.data);
    setCount(res.count);
    setChecks(new Set());
    setCargando(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      dataUserRef.current = usuario;
      setDataUser(usuario);
      setEstado('listo');
      cargar(0, '');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, []);

  function buscar() {
    setPage(0);
    cargar(0, busqueda);
  }

  // Port 1:1 de openUrl (Angular): manda la guia por WhatsApp -- si el pedido todavia no tiene
  // guia (numeroGuia null, el caso normal para "Pendiente") el mensaje real de Angular tambien
  // queda con ese hueco vacio, se replica igual.
  function enviarGuiaWhatsapp(row: VentaRow) {
    const numero = (row.telefonoCliente || '').replace(/\D/g, '');
    const url = `https://wa.me/57${numero}?text=${encodeURIComponent(`Hola Cliente ${row.nombreCliente || ''} Este esta es tu guia --> ${row.numeroGuia || ''} <-- `)}`;
    window.open(url);
  }

  function cambiarPagina(nueva: number) {
    setPage(nueva);
    cargar(nueva, busqueda);
  }

  function toggleCheck(id: number) {
    setChecks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function eliminarSeleccionadas() {
    if (checks.size === 0) return;
    if (!confirm('¿Desea Eliminar Dato?')) return;
    setEliminando(true);
    for (const id of checks) {
      const res = await eliminarVenta(id);
      if (!res.success) alert(res.message || 'Error de servidor');
    }
    setEliminando(false);
    cargar(page, busqueda);
  }

  if (estado === 'revisando') return null;

  const totalPaginas = Math.max(1, Math.ceil(count / LIMIT));
  const desde = count === 0 ? 0 : page * LIMIT + 1;
  const hasta = Math.min(count, page * LIMIT + LIMIT);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <div className="border-b border-gray-200 pb-3">
        <h4 className="text-lg font-bold text-gray-900">Ventas Posibles</h4>
      </div>

      <div className="mt-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          placeholder="Buscar Ventas"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-2 flex flex-col items-start gap-2">
        <button type="button" onClick={buscar} disabled={cargando} className="rounded bg-[#0066FF] p-2.5 text-white disabled:opacity-60">
          <Search className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={buscar} disabled={cargando} title="Refresh" className="rounded bg-[#0066FF] p-2.5 text-white disabled:opacity-60">
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={eliminarSeleccionadas}
            disabled={eliminando || checks.size === 0}
            title="Erase"
            className="rounded bg-[#FF3B30] p-2.5 text-white disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        {cargando ? (
          <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm font-bold text-gray-900">
                <th className="py-2 pr-3"></th>
                <th className="py-2 pr-3">Acciones</th>
                <th className="py-2 pr-3">Nombre Cliente</th>
                <th className="py-2 pr-3">Teléfono Cliente</th>
                <th className="py-2 pr-3">Fecha Venta</th>
                <th className="py-2 pr-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="py-3 pr-3 align-top">
                    <input type="checkbox" checked={checks.has(row.id)} onChange={() => toggleCheck(row.id)} />
                  </td>
                  <td className="py-3 pr-3 align-top">
                    {row.estado === 0 && (
                      <div className="mb-1 inline-block rounded bg-[#dfdfdf] px-2 py-1 text-sm font-bold text-[#FFA800]">Debes Autorizar Despacho</div>
                    )}
                    {row.estado === 1 && (
                      <a href="/config/ventas" className="mb-1 inline-block cursor-pointer rounded bg-[#dfdfdf] px-2 py-1 text-sm font-bold text-[#FFA800]">
                        Venta Generada Esperando guia
                      </a>
                    )}
                    <div>
                      <button type="button" onClick={() => setVentaAbierta(row.id)} className="rounded bg-[#0066FF] p-2 text-white">
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="py-3 pr-3 align-top">{row.nombreCliente}</td>
                  <td className="py-3 pr-3 align-top">
                    <span className="inline-flex items-center gap-1.5">
                      {row.telefonoCliente}
                      <button type="button" onClick={() => enviarGuiaWhatsapp(row)} className="text-[#25D366] hover:text-[#1EBE57]" title="Enviar por WhatsApp">
                        <WhatsAppIcon className="h-5 w-5" />
                      </button>
                    </span>
                  </td>
                  <td className="py-3 pr-3 align-top">{fechaMedium(row.fecha)}</td>
                  <td className="py-3 pr-3 align-top">{VENTA_ESTADO_LABEL[row.estado]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!cargando && ventas.length === 0 && <p className="py-10 text-center text-gray-500">No hay ventas para mostrar.</p>}
      </div>

      {!cargando && count > 0 && (
        <div className="mt-4 flex flex-row-reverse items-center gap-3 text-sm text-gray-600">
          <button type="button" onClick={() => cambiarPagina(page + 1)} disabled={page + 1 >= totalPaginas} className="rounded p-1 disabled:opacity-30">
            ›
          </button>
          <span>
            {desde}–{hasta} de {count}
          </span>
          <button type="button" onClick={() => cambiarPagina(page - 1)} disabled={page === 0} className="rounded p-1 disabled:opacity-30">
            ‹
          </button>
        </div>
      )}

      {ventaAbierta != null && (
        <FormVentaDetalleModal
          orderId={ventaAbierta}
          esAdmin={dataUser?.rolname === 'administrador'}
          onClose={() => setVentaAbierta(null)}
          onCambio={() => cargar(page, busqueda)}
        />
      )}
    </div>
  );
}
