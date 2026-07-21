'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Pencil } from 'lucide-react';
import { fetchPickupAddress, guardarPickupAddress, buscarCiudadesMipaquete, type PickupAddress, type CiudadMipaquete } from '@/lib/guias';
import { useToast, Toast } from '@/components/Toast';

// Fase 3 del plan de aislamiento proveedor<->vendedor (pedido explicito del usuario 2026-07-20): el
// proveedor ahora es quien despacha sus propios pedidos, asi que necesita una direccion de recogida
// real guardada -- sin ella mipaquete-create-shipment no tiene de donde generar la guia. Reusa la
// MISMA tabla/funciones ya construidas para "Generacion de Guias" (pickup_addresses, lib/guias.ts) --
// es el mismo concepto, no una tabla nueva. Mismo patron de busqueda de ciudad que GuiaWizard.

const soloLetras = (v: string) => (v || '').replace(/[^A-Za-zÀ-ÿ\s'-]/g, '');
const soloNumeros = (v: string) => (v || '').replace(/[^0-9]/g, '');
const letrasYNumeros = (v: string) => (v || '').replace(/[^A-Za-z0-9À-ÿ\s#.,-]/g, '');
const inputCls = 'w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-[#02a0e3] focus:outline-none';

interface PickupAddressCardProps {
  profileId: string;
}

export function PickupAddressCard({ profileId }: PickupAddressCardProps) {
  const { mensaje, mostrar } = useToast();
  const [cargando, setCargando] = useState(true);
  const [pickup, setPickup] = useState<PickupAddress | null>(null);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({ firstName: '', lastName: '', idDocument: '', whatsapp: '', address: '', email: '' });
  const [ciudadQuery, setCiudadQuery] = useState('');
  const [sugerencias, setSugerencias] = useState<CiudadMipaquete[]>([]);
  const [ciudadFocus, setCiudadFocus] = useState(false);
  const [ciudadSeleccionada, setCiudadSeleccionada] = useState<CiudadMipaquete | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchPickupAddress(profileId).then((res) => {
      setPickup(res);
      setCargando(false);
      if (!res) setEditando(true);
    });
  }, [profileId]);

  function onCiudadInput(v: string) {
    setCiudadQuery(soloLetras(v));
    setCiudadSeleccionada(null);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSugerencias(v.trim().length >= 2 ? await buscarCiudadesMipaquete(v) : []);
    }, 250);
  }

  function seleccionarCiudad(c: CiudadMipaquete) {
    setCiudadSeleccionada(c);
    setCiudadQuery(c.name);
    setSugerencias([]);
    setCiudadFocus(false);
  }

  function empezarEdicion() {
    setForm({
      firstName: pickup?.firstName || '',
      lastName: pickup?.lastName || '',
      idDocument: pickup?.idDocument || '',
      whatsapp: pickup?.whatsapp || '',
      address: pickup?.address || '',
      email: pickup?.email || '',
    });
    if (pickup?.cityName) {
      setCiudadQuery(pickup.cityName);
      setCiudadSeleccionada({ name: pickup.cityName, code: pickup.cityDaneCode });
    }
    setEditando(true);
  }

  function formValido(): boolean {
    return !!form.firstName.trim() && !!form.lastName.trim() && !!form.idDocument.trim() && !!form.whatsapp.trim() && !!form.address.trim() && !!ciudadSeleccionada;
  }

  async function guardar() {
    if (!formValido() || guardando) return;
    setGuardando(true);
    const ok = await guardarPickupAddress(profileId, { ...form, cityName: ciudadSeleccionada!.name, cityDaneCode: ciudadSeleccionada!.code });
    setGuardando(false);
    if (!ok) {
      mostrar('No pudimos guardar tu dirección de recogida, intenta de nuevo');
      return;
    }
    setPickup(await fetchPickupAddress(profileId));
    setEditando(false);
    mostrar('Dirección de recogida guardada');
  }

  if (cargando) return null;

  return (
    <div className="mb-3 rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-4.5 w-4.5 shrink-0" style={{ color: '#0288c2' }} />
        <h5 className="m-0 text-sm font-bold text-gray-900">Dirección de recogida</h5>
      </div>
      <p className="mt-1 text-xs text-gray-500">Desde acá el mensajero recoge tus pedidos cuando generas una guía de envío.</p>

      {!editando && pickup ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-3 text-sm">
          <div>
            <p className="m-0 font-semibold text-gray-800">{pickup.address}</p>
            <p className="m-0 text-xs text-gray-500">{pickup.cityName} · {pickup.whatsapp}</p>
          </div>
          <button onClick={empezarEdicion} className="flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700">
            <Pencil className="h-3 w-3" /> Editar
          </button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {!pickup && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 sm:col-span-2">
              ⚠️ Sin esta dirección no vas a poder generar guías de envío para tus pedidos.
            </p>
          )}
          <input className={inputCls} placeholder="Nombres" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: soloLetras(e.target.value) }))} />
          <input className={inputCls} placeholder="Apellidos" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: soloLetras(e.target.value) }))} />
          <input className={inputCls} inputMode="numeric" placeholder="Cédula" value={form.idDocument} onChange={(e) => setForm((f) => ({ ...f, idDocument: soloNumeros(e.target.value) }))} />
          <input className={inputCls} inputMode="numeric" placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: soloNumeros(e.target.value) }))} />
          <input className={inputCls} placeholder="Dirección" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: letrasYNumeros(e.target.value) }))} />
          <div className="relative">
            <input
              className={inputCls}
              autoComplete="off"
              placeholder="Ciudad"
              value={ciudadQuery}
              onChange={(e) => onCiudadInput(e.target.value)}
              onFocus={() => setCiudadFocus(true)}
              onBlur={() => setTimeout(() => setCiudadFocus(false), 180)}
            />
            {ciudadSeleccionada && <p className="mt-1 text-xs text-green-600">✓ {ciudadSeleccionada.name}</p>}
            {ciudadFocus && sugerencias.length > 0 && !ciudadSeleccionada && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
                {sugerencias.map((c, i) => (
                  <div key={`${c.code}-${i}`} onMouseDown={() => seleccionarCiudad(c)} className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-50">
                    {c.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input className={inputCls} type="email" placeholder="Email (opcional)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <div className="flex items-center gap-2 sm:col-span-2">
            <button
              onClick={guardar}
              disabled={!formValido() || guardando}
              className="rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: '#02a0e3' }}
            >
              {guardando ? 'Guardando…' : 'Guardar dirección'}
            </button>
            {pickup && (
              <button onClick={() => setEditando(false)} className="rounded-full border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700">
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      <Toast mensaje={mensaje} />
    </div>
  );
}
