'use client';

import { useEffect, useState } from 'react';
import { FileCheck, Upload, CheckCircle2 } from 'lucide-react';
import { fetchPerfilCompleto, actualizarPerfil, subirArchivoPublico, type PerfilCompleto } from '@/lib/perfil';
import { useToast, Toast } from '@/components/Toast';

// Pedido explicito del usuario 2026-07-24: "Paso 3" del registro de proveedor -- subir los 3
// documentos de verificacion (RUT, cedula ampliada, camara de comercio). Estos mismos campos ya
// existian en /config/perfil ("Datos de bodegas"), se reusan las mismas funciones de datos
// (fetchPerfilCompleto/actualizarPerfil/subirArchivoPublico de src/lib/perfil.ts) para que quede
// guardado en el mismo lugar (profiles.supplier_doc_*_url) -- no es una tabla ni un campo nuevo,
// solo un lugar mas visible para subirlos durante el onboarding.
//
// Regla de completitud pedida explicitamente 2026-07-24: la cedula es SIEMPRE obligatoria: ademas
// hay que subir al menos UNO entre RUT y Camara de Comercio (no los 2, con uno de los 2 alcanza).

const DOCUMENTOS = [
  { campo: 'pdfCedulaUrl' as const, etiqueta: 'Copia de la cédula ampliada al 150%', nota: 'Obligatorio' },
  { campo: 'pdfRutUrl' as const, etiqueta: 'RUT actualizado', nota: 'Sube este o el de Cámara de Comercio' },
  { campo: 'pdfCamaraComercioUrl' as const, etiqueta: 'Cámara de Comercio actualizada', nota: 'Sube este o el RUT' },
];

export function documentosCompletos(data: Pick<PerfilCompleto, 'pdfCedulaUrl' | 'pdfRutUrl' | 'pdfCamaraComercioUrl'>): boolean {
  return !!data.pdfCedulaUrl && (!!data.pdfRutUrl || !!data.pdfCamaraComercioUrl);
}

interface Paso3DocumentosProps {
  profileId: string;
  // Pedido explicito del usuario 2026-07-24: cada paso debe avisar cuando queda completo, para que
  // el padre pueda mostrar el check y habilitar "Enviar a revisión" cuando de verdad corresponda.
  onEstadoCambia?: (completo: boolean) => void;
}

export function Paso3Documentos({ profileId, onEstadoCambia }: Paso3DocumentosProps) {
  const { mensaje, mostrar } = useToast();
  const [data, setData] = useState<PerfilCompleto | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);

  useEffect(() => {
    fetchPerfilCompleto(profileId).then((d) => {
      setData(d);
      if (d) onEstadoCambia?.(documentosCompletos(d));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function onSubir(file: File, campo: 'pdfRutUrl' | 'pdfCedulaUrl' | 'pdfCamaraComercioUrl') {
    setSubiendo(campo);
    const url = await subirArchivoPublico(file);
    setSubiendo(null);
    if (!url) return mostrar('Error de servidor subiendo el documento');
    setData((prev) => {
      if (!prev) return prev;
      const actualizado = { ...prev, [campo]: url };
      onEstadoCambia?.(documentosCompletos(actualizado));
      return actualizado;
    });
    const res = await actualizarPerfil(profileId, { [campo]: url });
    mostrar(res.success ? 'Documento guardado' : res.message || 'No pudimos guardar el documento, intenta de nuevo.');
  }

  if (!data) return null;

  const completo = documentosCompletos(data);

  return (
    <div className="mb-3 rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-2">
        <FileCheck className="h-4.5 w-4.5 shrink-0" style={{ color: '#0288c2' }} />
        <h5 className="m-0 text-sm font-bold text-gray-900">Paso 3 Sube tus Documentos</h5>
        {completo && (
          <span className="ml-1 flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completado
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        La cédula es obligatoria, y además necesitas subir el RUT <b>o</b> la Cámara de Comercio (con uno de los dos alcanza).
      </p>

      <div className="mt-3 space-y-2.5">
        {DOCUMENTOS.map(({ campo, etiqueta, nota }) => (
          <div key={campo} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-3">
            <div className="flex-1">
              <p className="m-0 text-sm font-semibold text-gray-700">{etiqueta}</p>
              <p className="m-0 text-[11px] text-gray-400">{nota}</p>
            </div>
            {data[campo] && (
              <a href={data[campo] as string} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                ✓ Ver documento
              </a>
            )}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700">
              <Upload className="h-3.5 w-3.5" />
              {subiendo === campo ? 'Subiendo…' : data[campo] ? 'Reemplazar' : 'Subir PDF'}
              <input type="file" accept="application/pdf" hidden disabled={!!subiendo} onChange={(e) => e.target.files?.[0] && onSubir(e.target.files[0], campo)} />
            </label>
          </div>
        ))}
      </div>

      {!completo && (
        <p className="mt-2 text-xs font-semibold text-amber-600">
          {!data.pdfCedulaUrl ? 'Falta la cédula (obligatoria)' : 'Falta subir el RUT o la Cámara de Comercio'}
        </p>
      )}

      <Toast mensaje={mensaje} />
    </div>
  );
}
