'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchSiteConfig, guardarSiteConfig, subirVideoIntro, type SiteConfigForm } from '@/lib/adminConfig';
import { useToast, Toast } from '@/components/Toast';

// Port de AdminComponent (Angular, "/config/admin", "Configurar Introduccion") -- 3 pasos con
// titulo + video, guardados en site_config.info_text. Ver src/lib/adminConfig.ts sobre el bug real
// de subida de archivo corregido (se mandaba el FileList completo en vez del File).

const PASOS: { key: keyof SiteConfigForm; urlKey: keyof SiteConfigForm; label: string }[] = [
  { key: 'tituloPrimero', urlKey: 'urlPrimero', label: 'Primer Paso' },
  { key: 'tituloSegundo', urlKey: 'urlSegundo', label: 'Segundo Paso' },
  { key: 'tituloTercero', urlKey: 'urlTercero', label: 'Tersero Paso' },
];

export default function AdminConfigPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [data, setData] = useState<SiteConfigForm | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      setData(await fetchSiteConfig());
      setEstado('listo');
    });
  }, []);

  function setCampo(key: keyof SiteConfigForm, value: string) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function subir(urlKey: keyof SiteConfigForm, file: File) {
    setSubiendo(urlKey);
    const url = await subirVideoIntro(file);
    setSubiendo(null);
    if (!url || !data) {
      mostrar('Subido Error');
      return;
    }
    const nuevo = { ...data, [urlKey]: url };
    setData(nuevo);
    const ok = await guardarSiteConfig(nuevo);
    mostrar(ok ? 'Actualizado' : 'Error');
  }

  if (estado === 'revisando' || !data) return null;

  return (
    <div className="mx-auto w-full max-w-[900px] px-3 py-6">
      <h2 className="text-center text-2xl font-bold text-gray-800">Configurar Introduccion</h2>

      {PASOS.map((paso) => (
        <div key={paso.key} className="mt-8">
          <h3 className="text-center text-lg font-semibold text-gray-700">{paso.label}</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Titulo</label>
              <input value={data[paso.key]} onChange={(e) => setCampo(paso.key, e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Video</label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="video/*,image/*"
                  disabled={subiendo === paso.urlKey}
                  onChange={(e) => e.target.files?.[0] && subir(paso.urlKey, e.target.files[0])}
                  className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
              </div>
              {subiendo === paso.urlKey && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
              {data[paso.urlKey] && subiendo !== paso.urlKey && <p className="mt-1 truncate text-xs text-green-700">Archivo actual: {data[paso.urlKey]}</p>}
            </div>
          </div>
        </div>
      ))}

      <div className="mt-6 text-center">
        <button
          onClick={async () => {
            const ok = await guardarSiteConfig(data);
            mostrar(ok ? 'Actualizado' : 'Error');
          }}
          className="rounded bg-green-600 px-6 py-2 text-sm font-medium text-white"
        >
          Guardar títulos
        </button>
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
