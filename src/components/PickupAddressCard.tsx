'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Pencil, CheckCircle2 } from 'lucide-react';
import { fetchPickupAddress, guardarPickupAddress, buscarCiudadesMipaquete, type PickupAddress, type CiudadMipaquete } from '@/lib/guias';
import { fetchDataUserCompleto } from '@/lib/usuarios';
import { useToast, Toast } from '@/components/Toast';

// Fase 3 del plan de aislamiento proveedor<->vendedor (pedido explicito del usuario 2026-07-20): el
// proveedor ahora es quien despacha sus propios pedidos, asi que necesita una direccion de recogida
// real guardada -- sin ella mipaquete-create-shipment no tiene de donde generar la guia. Reusa la
// MISMA tabla/funciones ya construidas para "Generacion de Guias" (pickup_addresses, lib/guias.ts) --
// es el mismo concepto, no una tabla nueva. Mismo patron de busqueda de ciudad que GuiaWizard.
//
// Pedido explicito del usuario 2026-07-24: cuando el proveedor llega aca recien registrado (sin
// pickup guardado todavia), no debe tener que volver a escribir nombre/apellido/telefono/ciudad/
// direccion/correo -- esos mismos datos ya los dio en el formulario de registro y quedaron en
// `profiles`. Se precargan de ahi (mismo fetch que ya usa el resto del panel, fetchDataUserCompleto)
// y el proveedor solo revisa/edita y confirma -- la cedula NO se precarga porque no se pide en
// ningun formulario de registro (ver nota en usuariosAdmin.ts), y la ciudad exacta de Mipaquete
// (con su codigo DANE) tampoco se puede adivinar de forma segura, solo se deja el texto como punto
// de partida para que la sugerencia aparezca sin tener que escribir de cero.

const soloLetras = (v: string) => (v || '').replace(/[^A-Za-zÀ-ÿ\s'-]/g, '');
const soloNumeros = (v: string) => (v || '').replace(/[^0-9]/g, '');
const letrasYNumeros = (v: string) => (v || '').replace(/[^A-Za-z0-9À-ÿ\s#.,-]/g, '');
const inputCls = 'w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-[#02a0e3] focus:outline-none';
const inputClsInvalido = 'w-full rounded border border-red-400 bg-red-50/40 px-3 py-2 text-sm focus:border-red-500 focus:outline-none';
// Pedido explicito del usuario 2026-07-24: el campo que falte por diligenciar se marca en rojo,
// no solo el mensaje de texto de abajo.
function claseCampo(invalido: boolean): string {
  return invalido ? inputClsInvalido : inputCls;
}

interface PickupAddressCardProps {
  profileId: string;
  // Pedido explicito del usuario 2026-07-24: el flujo de onboarding es "paso a paso" -- el Paso 2
  // (productos) solo debe aparecer una vez el proveedor confirma sus datos aca. Avisa al padre cada
  // vez que cambia si ya hay (o no) una direccion de recogida guardada.
  onEstadoCambia?: (confirmado: boolean) => void;
}

export function PickupAddressCard({ profileId, onEstadoCambia }: PickupAddressCardProps) {
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
    let activo = true;
    fetchPickupAddress(profileId)
      .then(async (res) => {
        if (!activo) return;
        setPickup(res);
        onEstadoCambia?.(!!res);
        if (!res) {
          // BUG REAL CORREGIDO 2026-07-24: este precargado (perfil -> formulario) no tenia try/catch
          // -- si `fetchDataUserCompleto` o `buscarCiudadesMipaquete` fallaban por cualquier motivo
          // (red, dato inesperado), `setCargando(false)` nunca se ejecutaba y la tarjeta ENTERA se
          // quedaba en blanco para siempre (`if (cargando) return null`) -- ni campos ni boton,
          // nada. Ahora un fallo en el precargado no bloquea mostrar el formulario vacio y usable.
          try {
            const datos = await fetchDataUserCompleto(profileId);
            if (!activo) return;
            setForm((f) => ({
              ...f,
              firstName: datos.nombre || '',
              lastName: datos.apellido || '',
              whatsapp: (datos.telefono || '').replace(/[^0-9]/g, ''),
              address: datos.direccion || '',
              email: datos.email || '',
            }));
            if (datos.ciudad) {
              setCiudadQuery(datos.ciudad);
              const resultados = await buscarCiudadesMipaquete(datos.ciudad);
              if (!activo) return;
              setSugerencias(resultados);
              // BUG REAL CORREGIDO 2026-07-24: `c.name` viene como "CIUDAD, DEPARTAMENTO" (ej.
              // "CÚCUTA, NORTE DE SANTANDER"), pero se comparaba contra el nombre de ciudad SOLO
              // (ej. "Cúcuta") -- nunca podian ser iguales, la autoseleccion nunca se disparaba
              // aunque el resultado correcto ya estuviera en la lista. Se compara solo contra la
              // parte antes de la primera coma.
              const ciudadBuscada = datos.ciudad!.trim().toLowerCase();
              const exacta = resultados.find((c) => c.name.split(',')[0].trim().toLowerCase() === ciudadBuscada);
              if (exacta) seleccionarCiudad(exacta);
            }
          } catch {
            // Precargado fallido: no pasa nada, el proveedor igual puede llenar el formulario a mano.
          }
          setEditando(true);
        }
        setCargando(false);
      })
      .catch(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
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

  // Pedido explicito del usuario 2026-07-24: el boton "Guardar/Confirmar" quedaba deshabilitado
  // (opacidad 50%, casi invisible) sin explicar por que -- la cedula nunca se precarga (no se pide
  // en el registro) asi que ese era casi siempre el motivo real. Se le dice explicitamente que falta.
  function camposFaltantes(): string[] {
    const faltan: string[] = [];
    if (!form.firstName.trim()) faltan.push('Nombres');
    if (!form.lastName.trim()) faltan.push('Apellidos');
    if (!form.idDocument.trim()) faltan.push('Cédula');
    if (!form.whatsapp.trim()) faltan.push('WhatsApp');
    if (!form.address.trim()) faltan.push('Dirección');
    if (!ciudadSeleccionada) faltan.push('Ciudad (selecciónala de la lista)');
    return faltan;
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
    const nuevo = await fetchPickupAddress(profileId);
    setPickup(nuevo);
    onEstadoCambia?.(!!nuevo);
    setEditando(false);
    mostrar('Datos confirmados');
  }

  if (cargando) return null;

  return (
    <div className="mb-3 rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-4.5 w-4.5 shrink-0" style={{ color: '#0288c2' }} />
        <h5 className="m-0 text-sm font-bold text-gray-900">Paso 1 Confirmar y Guardar Datos y Dirección de Recolección</h5>
        {pickup && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completado
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">Verifica que los datos estén correctos y dale click al botón confirmar datos.</p>

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
              ⚠️ Hasta que no confirmes tus datos no vas a poder generar guías de envío para tus pedidos.
            </p>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Nombres</span>
            <input className={claseCampo(!form.firstName.trim())} placeholder="Nombres" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: soloLetras(e.target.value) }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Apellidos</span>
            <input className={claseCampo(!form.lastName.trim())} placeholder="Apellidos" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: soloLetras(e.target.value) }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Cédula</span>
            <input className={claseCampo(!form.idDocument.trim())} inputMode="numeric" placeholder="Cédula" value={form.idDocument} onChange={(e) => setForm((f) => ({ ...f, idDocument: soloNumeros(e.target.value) }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">WhatsApp</span>
            <input className={claseCampo(!form.whatsapp.trim())} inputMode="numeric" placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: soloNumeros(e.target.value) }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Dirección</span>
            <input className={claseCampo(!form.address.trim())} placeholder="Dirección" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: letrasYNumeros(e.target.value) }))} />
          </label>
          <label className="relative block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Ciudad</span>
            <input
              className={claseCampo(!ciudadSeleccionada)}
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
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Email (opcional)</span>
            <input className={inputCls} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </label>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <div className="flex items-center gap-2">
              <button
                onClick={guardar}
                disabled={!formValido() || guardando}
                className="rounded-full px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                style={!formValido() || guardando ? undefined : { background: '#02a0e3' }}
              >
                {guardando ? 'Guardando…' : 'Confirmar Datos'}
              </button>
              {pickup && (
                <button onClick={() => setEditando(false)} className="rounded-full border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700">
                  Cancelar
                </button>
              )}
            </div>
            {!formValido() && camposFaltantes().length > 0 && (
              <p className="text-xs font-semibold text-amber-600">Falta completar: {camposFaltantes().join(', ')}</p>
            )}
          </div>
        </div>
      )}

      <Toast mensaje={mensaje} />
    </div>
  );
}
