'use client';

import { useState } from 'react';
import Image from 'next/image';
import Cropper, { type Area } from 'react-easy-crop';
import { Upload, Check, X } from 'lucide-react';
import { recortarImagen } from '@/lib/cropImage';
import { subirArchivoPublico } from '@/lib/perfil';

// Pedido explicito del usuario 2026-07-24: la version vieja de Angular recortaba la foto principal
// del producto a 1:1 antes de subirla (image-cropper) -- la version Next.js subia la foto cruda tal
// cual. Se agrega este mismo paso, con react-easy-crop (arrastrar para mover, deslizador para
// zoom, un boton "Listo") en vez de reconstruir a mano la logica de arrastre/zoom -- misma idea que
// Angular, interaccion mas simple (nada que aprender: elegis foto, la acomodas, click en Listo).

interface ImageCropUploadProps {
  value: string | null;
  onUploaded: (url: string) => void;
  label: string;
  subiendo: boolean;
  setSubiendo: (v: boolean) => void;
  // Pedido explicito del usuario 2026-07-25: una vez el producto ya existe (editando), la foto se
  // muestra distinto a como se pide al crear -- una miniatura chica con el nombre y "Eliminar" a la
  // izquierda, y la foto grande con boton "Agregar Foto" a la derecha, identico a su captura.
  variant?: 'dropzone' | 'edit';
  nombreProducto?: string;
  onEliminar?: () => void;
  // Pedido explicito del usuario 2026-07-25: la foto es obligatoria -- si falta al intentar
  // guardar, la caja se marca en rojo con este mensaje debajo (mismo patron que el resto de
  // campos obligatorios del formulario).
  error?: string;
}

export function ImageCropUpload({ value, onUploaded, label, subiendo, setSubiendo, variant = 'dropzone', nombreProducto, onEliminar, error }: ImageCropUploadProps) {
  const [archivoOriginal, setArchivoOriginal] = useState<File | null>(null);
  const [imagenParaRecortar, setImagenParaRecortar] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixeles, setAreaPixeles] = useState<Area | null>(null);

  function onFileSeleccionado(file: File) {
    setArchivoOriginal(file);
    setImagenParaRecortar(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  function cancelarRecorte() {
    if (imagenParaRecortar) URL.revokeObjectURL(imagenParaRecortar);
    setImagenParaRecortar(null);
    setArchivoOriginal(null);
  }

  async function confirmarRecorte() {
    if (!imagenParaRecortar || !areaPixeles || !archivoOriginal) return;
    setSubiendo(true);
    try {
      const archivoRecortado = await recortarImagen(imagenParaRecortar, areaPixeles, archivoOriginal.name);
      const url = await subirArchivoPublico(archivoRecortado);
      if (url) onUploaded(url);
    } finally {
      setSubiendo(false);
      cancelarRecorte();
    }
  }

  if (imagenParaRecortar) {
    return (
      <div className="w-full max-w-xs">
        <div className="relative h-56 w-full overflow-hidden rounded-lg bg-gray-900">
          <Cropper
            image={imagenParaRecortar}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area, areaPx) => setAreaPixeles(areaPx)}
          />
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="mt-2 w-full"
          aria-label="Acercar o alejar"
        />
        <p className="mt-1 text-center text-xs text-gray-500">Arrastra la foto para acomodarla, usa la barra para acercar</p>
        {/* Pedido explicito del usuario 2026-07-25: si intento guardar sin haber confirmado el
            recorte con "Listo", se le avisa en rojo aca mismo (no solo con un toast generico). */}
        {error && <p className="mt-1 text-center text-xs font-medium text-red-600">Todavía no confirmaste la foto -- ajústala y presiona &quot;Listo&quot;</p>}
        <div className="mt-2 flex justify-center gap-2">
          <button
            type="button"
            onClick={confirmarRecorte}
            disabled={subiendo}
            className="flex items-center gap-1.5 rounded-full bg-[#02a0e3] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" /> {subiendo ? 'Subiendo…' : 'Listo'}
          </button>
          <button type="button" onClick={cancelarRecorte} className="flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700">
            <X className="h-3.5 w-3.5" /> Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (value && variant === 'edit') {
    return (
      <div className="flex flex-wrap items-start gap-8">
        <div className="w-36 shrink-0 text-center">
          <div className="relative aspect-square w-full">
            <Image src={value} alt="" fill sizes="144px" className="rounded-md border border-gray-200 object-cover" />
          </div>
          <p className="mt-1.5 truncate text-xs font-medium text-gray-700">{nombreProducto || 'Sin nombre'}</p>
          <button type="button" onClick={onEliminar} className="text-xs font-medium text-[#0d6efd] hover:underline">
            Eliminar
          </button>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Image src={value} alt="" width={176} height={176} className="h-44 w-44 rounded-md border border-gray-200 bg-gray-50 object-contain" />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-[#0d6efd] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            <Upload className="h-4 w-4" />
            {/* Pedido explicito del usuario 2026-07-25: si ya hay una foto (siempre el caso aca,
                este bloque solo se renderiza cuando value existe), el boton dice "Cambiar" en vez
                de "Agregar" -- no tiene sentido invitar a "agregar" una foto que ya esta puesta. */}
            {subiendo ? 'Subiendo…' : 'Cambiar Foto Principal'}
            <input type="file" accept="image/*" hidden disabled={subiendo} onChange={(e) => e.target.files?.[0] && onFileSeleccionado(e.target.files[0])} />
          </label>
        </div>
      </div>
    );
  }

  // Pedido explicito del usuario 2026-07-25 (fidelidad exacta a su captura de referencia): caja
  // grande de borde punteado a todo el ancho, con la foto ya subida mostrada adentro en vez de un
  // boton chico aparte -- reemplaza el diseño anterior (foto + boton pill separados).
  if (value) {
    return (
      <label className="relative flex h-56 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400">
        <Image src={value} alt="" fill sizes="(max-width: 640px) 90vw, 400px" className="object-contain" />
        <span className="absolute bottom-2 right-2 rounded border border-gray-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700">
          {subiendo ? 'Subiendo…' : 'Cambiar foto'}
        </span>
        <input type="file" accept="image/*" hidden disabled={subiendo} onChange={(e) => e.target.files?.[0] && onFileSeleccionado(e.target.files[0])} />
      </label>
    );
  }

  return (
    <div>
      <label
        className={`flex h-56 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center ${
          error ? 'border-red-400 hover:border-red-500' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span className={`rounded border px-4 py-1.5 text-sm ${error ? 'border-red-400 text-red-600' : 'border-gray-400 text-gray-700'}`}>
          {subiendo ? 'Subiendo…' : label}
        </span>
        <input type="file" accept="image/*" hidden disabled={subiendo} onChange={(e) => e.target.files?.[0] && onFileSeleccionado(e.target.files[0])} />
      </label>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
