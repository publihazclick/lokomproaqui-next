'use client';

import { useEffect, useState } from 'react';
import { Smartphone, ShieldCheck, Lock } from 'lucide-react';
import { pedirCodigoAparato, verificarCodigoAparato, nombreAparato, type EstadoAparato } from '@/lib/acelerador';
import { abrirWhatsappMentoria } from '@/lib/adminConfig';
import { fechaMedium } from '@/lib/format';

// 08-11-2026, pedido del usuario: que quien compró el curso no pueda darle el acceso fácil a otra
// persona. Cada aparato nuevo necesita un código de 6 números que llega por WhatsApp (lo manda el
// panel del gamer, que se apaga de 12 de la noche a 7:45 a. m.) y vence en 2 minutos (corto a propósito: compartirlo es tedioso). Máximo 2
// aparatos: con 2, hay que elegir cuál quitar (3 cambios cada 30 días).

const VENCE_SEG = 120;

function deNoche(): boolean {
  const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const m = h.getHours() * 60 + h.getMinutes();
  return m < 7 * 60 + 45;
}

export function AparatoVerificacion({ estado, onListo }: { estado: EstadoAparato; onListo: () => void }) {
  const [quitar, setQuitar] = useState<number | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [segundos, setSegundos] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  if (estado.estado === 'bloqueado') {
    return (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5 text-center">
        <Lock className="mx-auto h-8 w-8 text-red-600" />
        <p className="mt-2 font-bold text-red-800">Tu acceso al curso está suspendido</p>
        <p className="mt-1 text-sm text-red-700">Se detectó que la cuenta se estaba usando en varios lugares. Escríbele al mentor para revisarlo.</p>
        <button onClick={() => abrirWhatsappMentoria()} className="mt-3 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white">
          Escribirle al mentor
        </button>
      </div>
    );
  }

  if (estado.estado !== 'nuevo' && estado.estado !== 'lleno') {
    return <p className="mt-4 rounded bg-red-50 p-3 text-center text-sm text-red-700">No pudimos revisar este aparato. Recarga la página.</p>;
  }

  const lleno = estado.estado === 'lleno';

  async function pedir() {
    if (lleno && quitar == null) {
      setError('Elige cuál aparato quieres quitar');
      return;
    }
    setOcupado(true);
    setError(null);
    const r = await pedirCodigoAparato(lleno ? quitar! : undefined);
    setOcupado(false);
    if (!r.ok) {
      setError(r.error || 'No pudimos pedir el código');
      return;
    }
    setEnviado(true);
    setCodigo('');
    setSegundos(VENCE_SEG);
  }

  async function verificar() {
    if (codigo.replace(/\D/g, '').length !== 6) {
      setError('El código tiene 6 números');
      return;
    }
    setOcupado(true);
    setError(null);
    const r = await verificarCodigoAparato(codigo);
    setOcupado(false);
    if (!r.ok) {
      setError(r.error || 'Código incorrecto');
      return;
    }
    onListo();
  }

  const mm = Math.floor(segundos / 60), ss = String(segundos % 60).padStart(2, '0');

  return (
    <div className="mt-4 rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-8 w-8 shrink-0 text-[#0d6efd]" />
        <div>
          <p className="font-bold text-gray-900">Confirma este aparato para ver el curso</p>
          <p className="mt-1 text-sm text-gray-600">
            Tu curso es personal: se puede ver en máximo <b>2 aparatos</b>. Para usar este ({nombreAparato()}) te enviamos un código por
            WhatsApp{estado.telefono ? <> a tu número terminado en <b>{estado.telefono.replace(/\D/g, '')}</b></> : ''}.
          </p>
        </div>
      </div>

      {lleno && !enviado && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-gray-800">Ya tienes 2 aparatos. Elige cuál quitar para usar este:</p>
          <div className="mt-2 space-y-2">
            {(estado.aparatos || []).map((a) => (
              <label key={a.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${quitar === a.id ? 'border-[#0d6efd] bg-blue-50' : 'border-gray-200'}`}>
                <input type="radio" name="quitar" checked={quitar === a.id} onChange={() => setQuitar(a.id)} />
                <Smartphone className="h-5 w-5 text-gray-500" />
                <span className="flex-1">
                  <b>{a.nombre || 'Aparato'}</b>
                  <span className="block text-xs text-gray-500">Desde {fechaMedium(a.creado)} · último uso {fechaMedium(a.ultimo_uso)}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">Puedes cambiar de aparato {estado.cambios_restantes ?? 0} vez(ces) más este mes.</p>
        </div>
      )}

      {!enviado ? (
        <button onClick={pedir} disabled={ocupado} className="mt-4 w-full rounded-full bg-green-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {ocupado ? 'Enviando…' : 'Enviarme el código por WhatsApp'}
        </button>
      ) : (
        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-800">Escribe el código que te llegó por WhatsApp</label>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && verificar()}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-2xl font-bold tracking-[0.5em]"
            placeholder="······"
          />
          <p className={`mt-1 text-center text-xs ${segundos > 0 ? 'text-gray-500' : 'font-semibold text-red-600'}`}>
            {segundos > 0 ? `El código vence en ${mm}:${ss}` : 'El código se venció. Pide uno nuevo.'}
          </p>
          <button onClick={verificar} disabled={ocupado || segundos <= 0} className="mt-3 w-full rounded-full bg-[#0d6efd] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            {ocupado ? 'Revisando…' : 'Confirmar'}
          </button>
          <button onClick={pedir} disabled={ocupado} className="mt-2 w-full text-sm font-medium text-[#0d6efd] underline disabled:opacity-60">
            Enviarme otro código
          </button>
        </div>
      )}

      {error && <p className="mt-3 rounded bg-red-50 p-2 text-center text-sm text-red-700">{error}</p>}
      {deNoche() && (
        <p className="mt-3 rounded bg-amber-50 p-2 text-center text-xs text-amber-800">Los códigos se envían de 7:45 a. m. a 12 de la noche. Si no te llega ahora, inténtalo en la mañana.</p>
      )}
    </div>
  );
}
