// Replica el formato real de Angular DatePipe 'medium' (usado en TODAS las tablas del panel
// admin portadas de dashboard-config: {{ row.createdAt | date:'medium' }}) -- dia sin cero
// adelante, mes abreviado en minusculas con punto, año, hora en formato 24h con segundos.
// Ej: "9 jul. 2026 21:39:00". El `.toLocaleString()` por defecto del navegador (usado antes)
// produce un formato distinto (con barras y AM/PM) que no coincide con la captura real de Angular.
const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];

export function fechaMedium(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dia = d.getDate();
  const mes = MESES[d.getMonth()];
  const anio = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dia} ${mes} ${anio} ${hh}:${mm}:${ss}`;
}
