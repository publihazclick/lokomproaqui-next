import { supabase } from './supabase';
import { guardarProducto, type ProductoForm, type ColorForm, type OpcionSimple } from './productosAdmin';

// Carga masiva REAL de productos (pedido explicito del usuario 2026-07-25, "no sabes como hacen
// las plataformas de dropshipping" -- lo que se habia construido antes era solo un formulario
// rapido uno por uno, no una plantilla que crea muchos productos de un solo golpe). Formato CSV
// (no .xlsx real): se evalua agregar la libreria `xlsx`/SheetJS para poder generar/leer un archivo
// de Excel nativo, pero la version publicada en npm (0.18.5) tiene 2 vulnerabilidades conocidas SIN
// parche (prototype pollution + ReDoS, ver `npm audit`) -- CSV se abre y se guarda perfecto desde
// Excel/Google Sheets igual (es el mismo formato que usa Shopify para su import masivo), sin traer
// esa dependencia insegura.
//
// Fotos: el proveedor pega la URL de la foto en la plantilla -- el navegador no puede descargar los
// bytes de un dominio externo por CORS, asi que se manda a la Edge Function `import-product-image`
// (descarga del lado del servidor y resube al bucket real).
//
// Alcance recortado a proposito: solo hasta 1 eje de variante (ej "Color: Rojo:10, Azul:5") por
// fila -- un producto con 2 ejes cruzados (Color Y Talla juntos, con stock por combinacion) no se
// puede expresar en una sola fila de forma simple, se deja para "Carga Rápida" (uno por uno).

export const CSV_HEADERS = [
  'Codigo (opcional)',
  'Nombre',
  'Categoria (copia el nombre exacto de la lista)',
  'Precio a distribuidor',
  'Precio de venta',
  'Alto empacado CM',
  'Ancho empacado CM',
  'Largo empacado CM',
  'Peso empacado KG',
  'Cantidad disponible (solo si NO tiene variantes)',
  'Nombre de la variante (opcional, ej: Color, Sabor, Talla)',
  'Valores y cantidades (ej: Rojo:10, Azul:5)',
  'URL de la foto principal',
  'Descripcion detallada',
] as const;

const EJEMPLO_CON_VARIANTE = [
  '',
  'Camiseta básica (EJEMPLO - BORRA ESTA FILA)',
  'Ropa y Accesorios',
  '25000',
  '45000',
  '5',
  '30',
  '40',
  '0.3',
  '',
  'Color',
  'Rojo:10, Azul:5, Verde:0',
  'https://ejemplo.com/foto-camiseta.jpg',
  'Camiseta 100% algodón, talla única, varios colores disponibles.',
];

const EJEMPLO_SIN_VARIANTE = [
  '',
  'Cargador USB-C 20W (EJEMPLO - BORRA ESTA FILA)',
  'Tecnología',
  '15000',
  '32000',
  '3',
  '8',
  '8',
  '0.1',
  '50',
  '',
  '',
  'https://ejemplo.com/foto-cargador.jpg',
  'Cargador rápido USB-C de 20W, compatible con la mayoría de celulares.',
];

function escaparCeldaCSV(valor: string): string {
  if (valor.includes(',') || valor.includes('"') || valor.includes('\n')) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

export function generarPlantillaCSV(): string {
  const filas = [CSV_HEADERS as unknown as string[], EJEMPLO_CON_VARIANTE, EJEMPLO_SIN_VARIANTE];
  // BOM para que Excel en Windows detecte UTF-8 solo (si no, tildes/ñ salen mal al abrirlo).
  return '﻿' + filas.map((fila) => fila.map(escaparCeldaCSV).join(',')).join('\r\n');
}

export function descargarPlantillaCSV() {
  const blob = new Blob([generarPlantillaCSV()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-carga-masiva-lokomproaqui.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Parser CSV robusto (comillas, comas y saltos de linea dentro de un campo, comillas escapadas
// como "" dentro de un campo) -- necesario porque la propia columna "Valores y cantidades" usa
// comas como separador interno (ej "Rojo:10, Azul:5"), Excel la guarda entre comillas al exportar.
export function parsearCSV(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '');
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let dentroDeComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (dentroDeComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroDeComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      dentroDeComillas = true;
    } else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\r') {
      // se ignora, el \n que sigue cierra la fila
    } else if (c === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((celda) => celda.trim() !== ''));
}

export interface ValorVariante {
  nombre: string;
  cantidad: number;
}

export interface FilaCargaMasiva {
  numeroFila: number; // 1-based, tal como se ve en Excel (fila 1 = encabezados)
  codigo: string;
  nombre: string;
  categoriaNombre: string;
  precioDistribuidor: string;
  precioVenta: string;
  alto: string;
  ancho: string;
  largo: string;
  peso: string;
  cantidad: string;
  varianteLabel: string;
  varianteValores: string;
  fotoUrl: string;
  descripcion: string;
}

export interface FilaValidada {
  fila: FilaCargaMasiva;
  errores: string[];
  categoriaId: number | null;
  valoresVariante: ValorVariante[] | null; // null = producto sin variantes
}

// Convierte las filas crudas del CSV (ya parseado) a objetos con nombre de campo, saltandose el
// encabezado. Si el CSV tiene menos/mas columnas de las esperadas en alguna fila, se completa con
// '' en vez de reventar -- se reporta como error de esa fila en validarFila, no rompe el resto.
export function mapearFilas(filasCSV: string[][]): FilaCargaMasiva[] {
  return filasCSV.slice(1).map((celdas, idx) => ({
    numeroFila: idx + 2,
    codigo: (celdas[0] || '').trim(),
    nombre: (celdas[1] || '').trim(),
    categoriaNombre: (celdas[2] || '').trim(),
    precioDistribuidor: (celdas[3] || '').trim(),
    precioVenta: (celdas[4] || '').trim(),
    alto: (celdas[5] || '').trim(),
    ancho: (celdas[6] || '').trim(),
    largo: (celdas[7] || '').trim(),
    peso: (celdas[8] || '').trim(),
    cantidad: (celdas[9] || '').trim(),
    varianteLabel: (celdas[10] || '').trim(),
    varianteValores: (celdas[11] || '').trim(),
    fotoUrl: (celdas[12] || '').trim(),
    descripcion: (celdas[13] || '').trim(),
  }));
}

function numeroPositivo(texto: string): number | null {
  const n = Number(texto.replace(',', '.'));
  return texto !== '' && !isNaN(n) && n > 0 ? n : null;
}

// Formato esperado de "Valores y cantidades": "Rojo:10, Azul:5, Verde:0" -- nombre:cantidad
// separados por coma. Devuelve null si el formato no es valido (para reportar error claro).
function parsearValoresVariante(texto: string): ValorVariante[] | null {
  const partes = texto.split(',').map((p) => p.trim()).filter(Boolean);
  if (!partes.length) return null;
  const valores: ValorVariante[] = [];
  for (const parte of partes) {
    const idx = parte.lastIndexOf(':');
    if (idx === -1) return null;
    const nombre = parte.slice(0, idx).trim();
    const cantidad = Number(parte.slice(idx + 1).trim());
    if (!nombre || isNaN(cantidad) || cantidad < 0) return null;
    valores.push({ nombre, cantidad });
  }
  return valores;
}

export function validarFila(fila: FilaCargaMasiva, categorias: OpcionSimple[]): FilaValidada {
  const errores: string[] = [];

  if (!fila.nombre) errores.push('Falta el nombre');

  const categoria = categorias.find((c) => c.nombre.trim().toLowerCase() === fila.categoriaNombre.toLowerCase());
  if (!fila.categoriaNombre) errores.push('Falta la categoría');
  else if (!categoria) errores.push(`La categoría "${fila.categoriaNombre}" no existe (copia el nombre exacto de la lista)`);

  if (numeroPositivo(fila.precioDistribuidor) === null) errores.push('Precio a distribuidor inválido');
  if (numeroPositivo(fila.precioVenta) === null) errores.push('Precio de venta inválido');
  if (numeroPositivo(fila.alto) === null) errores.push('Alto empacado inválido');
  if (numeroPositivo(fila.ancho) === null) errores.push('Ancho empacado inválido');
  if (numeroPositivo(fila.largo) === null) errores.push('Largo empacado inválido');
  if (numeroPositivo(fila.peso) === null) errores.push('Peso empacado inválido');
  if (!fila.fotoUrl) errores.push('Falta la URL de la foto');
  else if (!/^https?:\/\//i.test(fila.fotoUrl)) errores.push('La URL de la foto no es válida (debe empezar con http:// o https://)');
  if (!fila.descripcion) errores.push('Falta la descripción');

  let valoresVariante: ValorVariante[] | null = null;
  if (fila.varianteLabel || fila.varianteValores) {
    if (!fila.varianteLabel) errores.push('Falta el nombre de la variante (o borra también "Valores y cantidades")');
    if (!fila.varianteValores) errores.push('Falta "Valores y cantidades" de la variante');
    if (fila.varianteLabel && fila.varianteValores) {
      valoresVariante = parsearValoresVariante(fila.varianteValores);
      if (!valoresVariante) errores.push('El formato de "Valores y cantidades" no es válido (usa: Rojo:10, Azul:5)');
    }
  } else if (numeroPositivo(fila.cantidad) === null) {
    errores.push('Falta la cantidad disponible (o define una variante)');
  }

  return { fila, errores, categoriaId: categoria?.id ?? null, valoresVariante };
}

async function subirFotoDesdeUrl(url: string): Promise<{ url: string | null; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('import-product-image', { body: { url } });
    if (error) return { url: null, error: 'No pudimos descargar esa foto' };
    if (data?.error) return { url: null, error: data.error };
    return { url: data?.url ?? null };
  } catch {
    return { url: null, error: 'No pudimos descargar esa foto' };
  }
}

function codigoAleatorio(): string {
  return (Date.now().toString(20).substring(2, 5) + Math.random().toString(20).substring(2, 5)).toUpperCase();
}

export interface ResultadoFila {
  numeroFila: number;
  nombre: string;
  ok: boolean;
  error?: string;
}

// Crea los productos de las filas validas, una por una (secuencial a proposito -- cada una sube su
// propia foto, no tiene sentido paralelizar y saturar la Edge Function). `onFila` se llama despues
// de cada fila para que la pantalla pueda ir mostrando el progreso en vivo.
export async function crearProductosDesdeFilas(
  filasValidas: FilaValidada[],
  ownerProfileId: string,
  esAdmin: boolean,
  onFila: (resultado: ResultadoFila) => void,
): Promise<void> {
  for (const { fila, categoriaId, valoresVariante } of filasValidas) {
    const { url: fotoUrl, error: errorFoto } = await subirFotoDesdeUrl(fila.fotoUrl);
    if (!fotoUrl) {
      onFila({ numeroFila: fila.numeroFila, nombre: fila.nombre, ok: false, error: errorFoto || 'No pudimos descargar la foto' });
      continue;
    }

    const colores: ColorForm[] = valoresVariante
      ? valoresVariante.map((v) => ({
          key: v.nombre,
          nombre: v.nombre,
          foto: fotoUrl,
          galeria: [],
          tallas: [{ tallaId: 0, nombre: '', check: true, cantidad: v.cantidad }],
        }))
      : [
          {
            key: 'sin-variante',
            nombre: '',
            foto: fotoUrl,
            galeria: [],
            tallas: [{ tallaId: 0, nombre: '', check: true, cantidad: Number(fila.cantidad.replace(',', '.')) || 0 }],
          },
        ];

    const form: ProductoForm = {
      id: null,
      nombre: fila.nombre,
      codigo: fila.codigo || codigoAleatorio(),
      foto: fotoUrl,
      descripcion: fila.descripcion,
      categoriaId,
      subcategoriaId: null,
      precioDistribuidor: Number(fila.precioDistribuidor.replace(',', '.')),
      precioVenta: Number(fila.precioVenta.replace(',', '.')),
      alto: Number(fila.alto.replace(',', '.')),
      ancho: Number(fila.ancho.replace(',', '.')),
      largo: Number(fila.largo.replace(',', '.')),
      peso: Number(fila.peso.replace(',', '.')),
      tipoTallaId: null,
      variante1Label: fila.varianteLabel || 'Color',
      variante2Label: null,
      estado: 0,
      colores,
    };

    const id = await guardarProducto(form, ownerProfileId, esAdmin);
    onFila({ numeroFila: fila.numeroFila, nombre: fila.nombre, ok: !!id, error: id ? undefined : 'Error al guardar en la base de datos' });
  }
}
