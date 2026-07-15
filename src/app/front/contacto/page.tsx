'use client';

import { useState } from 'react';
import { FrontHeader } from '@/components/FrontHeader';
import { leerVendedorCarritoFront } from '@/lib/front';

// Port de ContactoComponent (Angular, modulo `portada`, "/front/contacto") -- formulario de
// contacto simple, envia por WhatsApp a un numero fijo de servicio al cliente (igual que el
// original, no depende de ningun dato de la tienda especifica).

const NUMERO_SOPORTE = '573148487506';

export default function FrontContactoPage() {
  const [data, setData] = useState({ nombre: '', email: '', sujeto: '', compania: '', mensaje: '' });

  function enviarData() {
    const url = `https://wa.me/${NUMERO_SOPORTE}?text=${encodeURIComponent(
      `Hola Servicio al cliente, como esta, saludo cordial, le habla ${data.nombre} Email ${data.email} Motivo ${data.sujeto} Compañia ${data.compania} Mensaje ${data.mensaje}`,
    )}`;
    window.open(url);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FrontHeader telefono={leerVendedorCarritoFront() || ''} />

      <div className="mx-auto w-full max-w-[600px] px-3 py-6">
        <h3 className="text-xl font-bold text-gray-800">Contacto</h3>
        <div className="mt-4 space-y-2 rounded-xl bg-white p-5 shadow-sm">
          <input value={data.nombre} onChange={(e) => setData({ ...data, nombre: e.target.value })} placeholder="Nombre" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <input value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="Correo" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <input value={data.sujeto} onChange={(e) => setData({ ...data, sujeto: e.target.value })} placeholder="Motivo" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <input value={data.compania} onChange={(e) => setData({ ...data, compania: e.target.value })} placeholder="Compañia (opcional)" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <textarea value={data.mensaje} onChange={(e) => setData({ ...data, mensaje: e.target.value })} placeholder="Mensaje" rows={4} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <button onClick={enviarData} className="w-full rounded-full bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">
            Enviar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
