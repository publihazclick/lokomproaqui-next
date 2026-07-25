'use client';

import { useEffect, useRef } from 'react';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';

// Pedido explicito del usuario 2026-07-24: la version vieja de Angular tenia un editor de texto
// enriquecido (angular-editor, con toolbar de fuentes/tamaños/colores) para la descripcion del
// producto -- la version Next.js quedo con un textarea de HTML plano. Se agrega un editor MINIMO
// (negrita, cursiva, lista con viñetas, lista numerada) en vez de traer una libreria WYSIWYG
// completa -- 4 botones grandes es mas facil de entender para un proveedor sin experiencia que un
// toolbar con 15 opciones, y el resultado (HTML) se guarda/muestra exactamente igual que antes
// (el catalogo ya renderiza esta descripcion con dangerouslySetInnerHTML).

interface SimpleRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  // Pedido explicito del usuario 2026-07-25: la descripcion es obligatoria -- si falta, el borde se
  // marca en rojo (mismo patron que el resto de campos obligatorios).
  error?: boolean;
}

export function SimpleRichTextEditor({ value, onChange, error }: SimpleRichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Solo pone el HTML inicial UNA vez al montar (nunca reactivo a `value`), para no pelearle al
  // cursor mientras el usuario escribe -- el padre debe usar `key={productoId}` para forzar un
  // remount limpio cuando cambia de producto (crear vs editar otro), en vez de reusar esta misma
  // instancia con contenido viejo.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function comando(nombre: string) {
    ref.current?.focus();
    document.execCommand(nombre);
    onChange(ref.current?.innerHTML ?? '');
  }

  return (
    <div className={`rounded border ${error ? 'border-red-500' : 'border-gray-300'}`}>
      <div className="flex gap-1 border-b border-gray-200 bg-gray-50 p-1.5">
        <button type="button" onClick={() => comando('bold')} className="rounded p-1.5 hover:bg-gray-200" aria-label="Negrita" title="Negrita">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => comando('italic')} className="rounded p-1.5 hover:bg-gray-200" aria-label="Cursiva" title="Cursiva">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => comando('insertUnorderedList')} className="rounded p-1.5 hover:bg-gray-200" aria-label="Lista con viñetas" title="Lista con viñetas">
          <List className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => comando('insertOrderedList')} className="rounded p-1.5 hover:bg-gray-200" aria-label="Lista numerada" title="Lista numerada">
          <ListOrdered className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        className="min-h-[120px] px-3 py-2 text-sm outline-none"
        data-placeholder="Cuéntale a los vendedores por qué este producto se vende bien…"
      />
    </div>
  );
}
