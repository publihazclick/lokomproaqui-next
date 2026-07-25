'use client';

import { useEffect, useState } from 'react';
import { X, Download, Upload, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react';
import { fetchCategoriasPrincipales, type OpcionSimple } from '@/lib/productosAdmin';
import {
  descargarPlantillaCSV,
  parsearCSV,
  mapearFilas,
  validarFila,
  crearProductosDesdeFilas,
  type FilaValidada,
  type ResultadoFila,
} from '@/lib/cargaMasivaExcel';

// Carga masiva REAL de productos con Excel (pedido explicito del usuario 2026-07-25, corrigiendo
// el malentendido de la sesion anterior: "eso no es subir carga masiva... no sabes como hacen las
// plataformas de dropshipping" -- lo anterior era un formulario rapido uno por uno, esto SI crea
// muchos productos de un solo archivo, igual que Shopify/Dropi/MercadoLibre). Ver
// src/lib/cargaMasivaExcel.ts para el detalle de la plantilla, el parser CSV y la creacion en lote.

interface CargaMasivaExcelModalProps {
  ownerProfileId: string;
  esAdmin: boolean;
  onClose: () => void;
  onTerminado: () => void;
}

type Paso = 'instrucciones' | 'revisando' | 'creando' | 'resultado';

export function CargaMasivaExcelModal({ ownerProfileId, esAdmin, onClose, onTerminado }: CargaMasivaExcelModalProps) {
  const [paso, setPaso] = useState<Paso>('instrucciones');
  const [categorias, setCategorias] = useState<OpcionSimple[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [filasValidadas, setFilasValidadas] = useState<FilaValidada[]>([]);
  const [progreso, setProgreso] = useState(0);
  const [resultados, setResultados] = useState<ResultadoFila[]>([]);

  useEffect(() => {
    fetchCategoriasPrincipales().then(setCategorias);
  }, []);

  const filasConError = filasValidadas.filter((f) => f.errores.length > 0);
  const filasOk = filasValidadas.filter((f) => f.errores.length === 0);

  async function onArchivoSeleccionado(file: File) {
    setNombreArchivo(file.name);
    const texto = await file.text();
    const filasCSV = parsearCSV(texto);
    const filas = mapearFilas(filasCSV);
    setFilasValidadas(filas.map((f) => validarFila(f, categorias)));
    setPaso('revisando');
  }

  async function crearTodo() {
    setPaso('creando');
    setProgreso(0);
    const nuevosResultados: ResultadoFila[] = [];
    await crearProductosDesdeFilas(filasOk, ownerProfileId, esAdmin, (r) => {
      nuevosResultados.push(r);
      setResultados([...nuevosResultados]);
      setProgreso(nuevosResultados.length);
    });
    setPaso('resultado');
  }

  const exitosos = resultados.filter((r) => r.ok).length;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={paso === 'creando' ? undefined : onClose}>
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h4 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <FileSpreadsheet className="h-5 w-5 text-[#198754]" /> Carga Masiva con Excel
            </h4>
            <p className="mt-0.5 text-xs text-gray-500">Sube muchos productos de una sola vez con una plantilla.</p>
          </div>
          {paso !== 'creando' && (
            <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="space-y-4 px-4 py-4">
          {paso === 'instrucciones' && (
            <>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
                <li>
                  Descarga la plantilla y ábrela con Excel o Google Sheets. Ya trae 2 filas de ejemplo (una con variantes, otra sin
                  variantes) — bórralas antes de subir el archivo.
                </li>
                <li>
                  Llena una fila por producto. La columna <b>Categoría</b> debe copiar EXACTO uno de estos nombres:
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {categorias.map((c) => (
                      <span key={c.id} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        {c.nombre}
                      </span>
                    ))}
                  </div>
                </li>
                <li>
                  Si el producto tiene variantes (color, sabor, presentación...), llena <b>&quot;Nombre de la variante&quot;</b> (ej.
                  &quot;Color&quot;) y <b>&quot;Valores y cantidades&quot;</b> así: <code className="rounded bg-gray-100 px-1 py-0.5">Rojo:10, Azul:5, Verde:0</code>{' '}
                  (nombre y cantidad separados por dos puntos, cada valor separado por coma). Si no tiene variantes, deja esas 2
                  columnas vacías y llena &quot;Cantidad disponible&quot;.
                </li>
                <li>
                  En <b>&quot;URL de la foto principal&quot;</b> pega un link directo a la imagen (que abra la foto sola, no una
                  página) — puede ser de Google Drive público, de otra página, donde la tengas subida.
                </li>
                <li>
                  Guarda el archivo como <b>CSV</b> (Archivo → Guardar como / Descargar → Valores separados por comas) y súbelo
                  aquí abajo.
                </li>
              </ol>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ¿Tu producto tiene 2 variantes que se cruzan (por ejemplo Color Y Talla juntos, con stock distinto por cada
                combinación)? Súbelo con <b>Carga Rápida (uno por uno)</b> en vez de esta plantilla.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={descargarPlantillaCSV}
                  className="flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" /> Descargar plantilla
                </button>
                <label className="flex cursor-pointer items-center gap-2 rounded-full bg-[#198754] px-4 py-2 text-sm font-bold text-white hover:opacity-90">
                  <Upload className="h-4 w-4" /> Subir archivo lleno
                  <input type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && onArchivoSeleccionado(e.target.files[0])} />
                </label>
              </div>
            </>
          )}

          {paso === 'revisando' && (
            <>
              <p className="text-sm text-gray-700">
                Archivo <b>{nombreArchivo}</b>: {filasValidadas.length} fila{filasValidadas.length === 1 ? '' : 's'} encontrada
                {filasValidadas.length === 1 ? '' : 's'} —{' '}
                <span className="font-semibold text-emerald-700">{filasOk.length} lista{filasOk.length === 1 ? '' : 's'} para crear</span>
                {filasConError.length > 0 && (
                  <>
                    {' '}
                    y <span className="font-semibold text-red-600">{filasConError.length} con error</span>
                  </>
                )}
                .
              </p>
              <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasValidadas.map((f) => (
                      <tr key={f.fila.numeroFila} className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2 text-gray-500">{f.fila.numeroFila}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{f.fila.nombre || '(sin nombre)'}</td>
                        <td className="px-3 py-2">
                          {f.errores.length === 0 ? (
                            <span className="flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" /> Lista
                            </span>
                          ) : (
                            <div className="text-red-600">
                              <span className="flex items-center gap-1 font-medium">
                                <XCircle className="h-4 w-4" /> {f.errores.length} error{f.errores.length === 1 ? '' : 'es'}
                              </span>
                              <ul className="mt-0.5 list-disc pl-5 text-xs">
                                {f.errores.map((e, i) => (
                                  <li key={i}>{e}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button onClick={() => setPaso('instrucciones')} className="rounded px-3 py-1.5 text-sm text-gray-600">
                  Subir otro archivo
                </button>
                <button
                  onClick={crearTodo}
                  disabled={filasOk.length === 0}
                  className="rounded bg-[#198754] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  Crear {filasOk.length} producto{filasOk.length === 1 ? '' : 's'} válido{filasOk.length === 1 ? '' : 's'}
                </button>
              </div>
            </>
          )}

          {paso === 'creando' && (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-gray-700">
                Creando productos… {progreso} de {filasOk.length}
              </p>
              <div className="mx-auto mt-3 h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-[#198754] transition-all"
                  style={{ width: `${filasOk.length ? (progreso / filasOk.length) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">No cierres esta ventana, cada foto tarda un poquito en descargarse.</p>
            </div>
          )}

          {paso === 'resultado' && (
            <>
              <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                Se crearon <b>{exitosos}</b> de <b>{resultados.length}</b> productos. Quedaron{' '}
                <b>pendientes de activar</b> — ve a &quot;Mis Productos&quot; para revisarlos y activarlos (uno por uno, o
                selecciónalos todos y elimínalos si algo salió mal).
              </div>
              {resultados.some((r) => !r.ok) && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-gray-800">Filas que no se pudieron crear:</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-red-600">
                    {resultados
                      .filter((r) => !r.ok)
                      .map((r) => (
                        <li key={r.numeroFila}>
                          Fila {r.numeroFila} ({r.nombre || 'sin nombre'}): {r.error}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={onTerminado} className="rounded bg-[#0d6efd] px-4 py-2 text-sm font-bold text-white">
                  Ver mis productos
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
