'use client';

import { useRef, useState } from 'react';
import { X, Truck, Search } from 'lucide-react';
import { type DataUserCompleto } from '@/lib/usuarios';
import {
  cotizarGuia,
  buscarCiudadesMipaquete,
  TAMANOS_PAQUETE,
  type CiudadMipaquete,
  type CotizacionGuia,
} from '@/lib/guias';

// Calculadora de flete standalone (pedido explicito del usuario 2026-07-20, boton "Cotizar Envio"
// al lado de "Nueva Guia"): NO crea ningun registro en standalone_shipments ni cobra nada de la
// wallet -- solo pide lo minimo que exige guide-quote (ciudad destino + peso/medidas + valor
// declarado) y muestra el precio real de Mipaquete. Mismo componente TAMANOS_PAQUETE/buscador de
// ciudades que GuiaWizard para que la experiencia sea consistente, pero sin los pasos de
// remitente/destinatario/pago/seguro que solo aplican si de verdad se va a generar la guia.

const soloLetras = (v: string) => (v || '').replace(/[^A-Za-zÀ-ÿ\s'-]/g, '');
const soloNumeros = (v: string) => (v || '').replace(/[^0-9]/g, '');

function formatCOPMoneda(n: number): string {
  return `$ ${Math.round(n || 0).toLocaleString('es-CO')}`;
}

interface CotizarEnvioModalProps {
  dataUser: DataUserCompleto;
  onClose: () => void;
}

export function CotizarEnvioModal({ dataUser, onClose }: CotizarEnvioModalProps) {
  const [ciudadQuery, setCiudadQuery] = useState('');
  const [sugerencias, setSugerencias] = useState<CiudadMipaquete[]>([]);
  const [ciudadFocus, setCiudadFocus] = useState(false);
  const [ciudadSeleccionada, setCiudadSeleccionada] = useState<CiudadMipaquete | null>(null);
  const ciudadDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tamanoId, setTamanoId] = useState('chica');
  const tamano = TAMANOS_PAQUETE.find((t) => t.id === tamanoId) || TAMANOS_PAQUETE[1];
  const [pesoManual, setPesoManual] = useState(3);
  const [anchoManual, setAnchoManual] = useState(20);
  const [altoManual, setAltoManual] = useState(20);
  const [largoManual, setLargoManual] = useState(20);
  const [valorDeclarado, setValorDeclarado] = useState('');

  const [cotizando, setCotizando] = useState(false);
  const [cotizado, setCotizado] = useState(false);
  const [cotizaciones, setCotizaciones] = useState<CotizacionGuia[]>([]);
  const [error, setError] = useState('');

  const peso = tamanoId === 'personalizar' ? pesoManual : tamano.weight || 1;
  const ancho = tamanoId === 'personalizar' ? anchoManual : tamano.width || 20;
  const alto = tamanoId === 'personalizar' ? altoManual : tamano.height || 20;
  const largo = tamanoId === 'personalizar' ? largoManual : tamano.length || 20;
  const declaredValueNum = Number(valorDeclarado) || 0;

  function onCiudadInput(valor: string) {
    const sanitized = soloLetras(valor);
    setCiudadQuery(sanitized);
    setCiudadSeleccionada(null);
    setCotizado(false);
    if (ciudadDebounce.current) clearTimeout(ciudadDebounce.current);
    ciudadDebounce.current = setTimeout(() => buscarCiudadesLocal(sanitized), 250);
  }

  async function buscarCiudadesLocal(q: string) {
    if (q.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    setSugerencias(await buscarCiudadesMipaquete(q));
  }

  function seleccionarCiudad(c: CiudadMipaquete) {
    setCiudadSeleccionada(c);
    setCiudadQuery(c.name);
    setSugerencias([]);
    setCiudadFocus(false);
  }

  function formValido(): boolean {
    return !!ciudadSeleccionada && peso > 0 && ancho > 0 && alto > 0 && largo > 0 && declaredValueNum > 0;
  }

  async function cotizar() {
    if (!formValido() || cotizando) {
      if (!ciudadSeleccionada) setError('Elige la ciudad destino para cotizar');
      else if (declaredValueNum <= 0) setError('Ingresa el valor declarado del contenido');
      return;
    }
    setError('');
    setCotizando(true);
    setCotizado(false);
    const res = await cotizarGuia(dataUser.id, ciudadSeleccionada!.code, { weight: peso, width: ancho, height: alto, length: largo, declaredValue: declaredValueNum });
    setCotizando(false);
    setCotizado(true);
    setCotizaciones(res.cotizaciones);
    if (!res.cotizaciones.length) setError('No hay transportadoras disponibles para esa ciudad');
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: '#e5e7eb' }}>
          <div className="min-w-0">
            <h4 className="m-0 flex items-center gap-1.5 truncate text-lg font-bold" style={{ color: '#1f2937' }}>
              <Search className="h-5 w-5 shrink-0" style={{ color: '#0288c2' }} />
              Cotizar Envío
            </h4>
            <p className="m-0 mt-0.5 text-xs" style={{ color: '#9ca3af' }}>
              Consulta el valor del flete sin generar ninguna guía
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: '#f1f3f5' }}>
            <X className="h-4 w-4" style={{ color: '#6b7280' }} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Campo label="Ciudad destino">
                <input
                  className={inputCls}
                  autoComplete="off"
                  value={ciudadQuery}
                  onChange={(e) => onCiudadInput(e.target.value)}
                  onFocus={() => setCiudadFocus(true)}
                  onBlur={() => setTimeout(() => setCiudadFocus(false), 180)}
                  placeholder="Ej: Medellín, Bogotá, Cali..."
                />
              </Campo>
              {ciudadSeleccionada && <p className="mt-1.5 text-xs" style={{ color: '#16a34a' }}>✓ {ciudadSeleccionada.name}</p>}
              {ciudadFocus && sugerencias.length > 0 && !ciudadSeleccionada && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[200px] overflow-y-auto rounded-[10px] border bg-white shadow-lg" style={{ borderColor: '#e5e7eb' }}>
                  {sugerencias.map((c, i) => (
                    <div key={`${c.code}-${i}`} className="cursor-pointer border-b px-3.5 py-2.5 text-sm last:border-b-0 hover:bg-gray-50" style={{ borderColor: '#f1f3f5' }} onMouseDown={() => seleccionarCiudad(c)}>
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>
                Tamaño del paquete
              </p>
              <div className="grid grid-cols-2 gap-2">
                {TAMANOS_PAQUETE.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setTamanoId(t.id); setCotizado(false); }}
                    className="rounded-[12px] border-[1.5px] p-3 text-left"
                    style={tamanoId === t.id ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.08)' } : { borderColor: '#e5e7eb' }}
                  >
                    <p className="m-0 text-sm font-bold" style={{ color: '#1f2937' }}>{t.label}</p>
                    <p className="m-0 mt-0.5 text-[11px]" style={{ color: '#6b7280' }}>{t.descripcion}</p>
                  </button>
                ))}
              </div>
            </div>

            {tamanoId === 'personalizar' && (
              <div className="grid grid-cols-2 gap-3 rounded-2xl p-3.5" style={{ background: '#f8fafc' }}>
                <Campo label="Peso (kg)">
                  <input type="number" min={1} className={inputCls} value={pesoManual} onChange={(e) => { setPesoManual(Number(e.target.value) || 1); setCotizado(false); }} />
                </Campo>
                <Campo label="Alto (cm)">
                  <input type="number" min={1} className={inputCls} value={altoManual} onChange={(e) => { setAltoManual(Number(e.target.value) || 1); setCotizado(false); }} />
                </Campo>
                <Campo label="Ancho (cm)">
                  <input type="number" min={1} className={inputCls} value={anchoManual} onChange={(e) => { setAnchoManual(Number(e.target.value) || 1); setCotizado(false); }} />
                </Campo>
                <Campo label="Largo (cm)">
                  <input type="number" min={1} className={inputCls} value={largoManual} onChange={(e) => { setLargoManual(Number(e.target.value) || 1); setCotizado(false); }} />
                </Campo>
              </div>
            )}

            <Campo label="Valor declarado del contenido (COP)">
              <input
                type="text"
                inputMode="numeric"
                className={inputCls}
                value={valorDeclarado}
                onChange={(e) => { setValorDeclarado(soloNumeros(e.target.value)); setCotizado(false); }}
                placeholder="Ej: 80000"
              />
            </Campo>

            {error && (
              <div className="rounded-[10px] p-3.5 text-[13px]" style={{ background: '#fef2f2', color: '#dc2626' }}>
                {error}
              </div>
            )}

            <div className="mt-1 flex justify-center">
              <button
                type="button"
                onClick={cotizar}
                disabled={cotizando}
                className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-55"
                style={{ background: '#02a0e3', boxShadow: '0 4px 10px rgba(2,160,227,0.3)' }}
              >
                <Truck className="h-4 w-4" />
                {cotizando ? 'Cotizando…' : 'Cotizar'}
              </button>
            </div>

            {cotizado && cotizaciones.length > 0 && (
              <div className="mt-1 flex flex-col gap-2">
                <p className="m-0 text-xs font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>
                  Transportadoras disponibles
                </p>
                {cotizaciones.map((c, i) => (
                  <div
                    key={`${c.slug}-${i}`}
                    className="flex items-center gap-3 rounded-[10px] border-[1.5px] bg-white px-3.5 py-2.5"
                    style={{ borderColor: '#e5e7eb' }}
                  >
                    {c.imgTrasp && (
                      // eslint-disable-next-line @next/next/no-img-element -- logo de transportadora
                      <img src={c.imgTrasp} alt="" className="h-[38px] w-[38px] shrink-0 rounded-lg bg-white object-contain" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[13px] font-bold">{c.nombre}</p>
                      <p className="m-0 mt-0.5 text-xs" style={{ color: '#6b7280' }}>{c.tiempoEstimado}</p>
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-sm font-bold" style={{ color: '#0288c2' }}>{formatCOPMoneda(c.fleteTotal)}</div>
                  </div>
                ))}
                <p className="mx-0.5 mt-0.5 text-[11px]" style={{ color: '#9ca3af' }}>
                  Valor informativo. Para generar la guía real, usa &quot;Nueva Guía&quot;.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:border-[#02a0e3] focus:outline-none disabled:bg-gray-100';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>{label}</label>
      {children}
    </div>
  );
}
