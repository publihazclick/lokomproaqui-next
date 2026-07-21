'use client';

import { X, Users, Wallet, CheckCircle2, AlertTriangle, PackageX, Copy } from 'lucide-react';

// Explicacion del sistema de comisiones multinivel (pedido explicito del usuario 2026-07-21,
// "que quede muy claro hasta para un niño de kinder... para curarme en salud"): el boton "Link
// para crear mi equipo de vendedores" (src/app/config/perfil/page.tsx) ahora abre este modal
// ANTES de copiar el link -- asi cualquier vendedor ve la explicacion completa de reglas y
// alcance cada vez que obtiene su link, no como un texto opcional que puede ignorar.
//
// Reglas explicadas aca = exactamente las de supabase/migrations/069_referral_commission_flat_payout.sql
// (pay_referral_commissions) y 068_referral_commission_schema.sql (niveles/config). Si esos
// valores cambian en el futuro, actualizar tambien este texto.

const NIVELES = [
  { nivel: 1, etiqueta: 'Nivel 1 — tu referido directo', monto: 500 },
  { nivel: 2, etiqueta: 'Nivel 2', monto: 400 },
  { nivel: 3, etiqueta: 'Nivel 3', monto: 300 },
  { nivel: 4, etiqueta: 'Nivel 4', monto: 200 },
  { nivel: 5, etiqueta: 'Nivel 5', monto: 100 },
];

const TOTAL_MAXIMO = NIVELES.reduce((sum, n) => sum + n.monto, 0);

function formatCOP(n: number): string {
  return `$ ${n.toLocaleString('es-CO')}`;
}

interface EquipoVendedoresInfoModalProps {
  urlRegistro: string;
  onClose: () => void;
  onCopiar: () => void;
}

export function EquipoVendedoresInfoModal({ urlRegistro, onClose, onCopiar }: EquipoVendedoresInfoModalProps) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: '#e5e7eb' }}>
          <div className="min-w-0">
            <h4 className="m-0 flex items-center gap-1.5 text-lg font-bold" style={{ color: '#1f2937' }}>
              <Users className="h-5 w-5 shrink-0" style={{ color: '#198754' }} />
              Así funciona tu Equipo de Vendedores
            </h4>
            <p className="m-0 mt-0.5 text-xs" style={{ color: '#9ca3af' }}>
              Léelo antes de compartir tu link — así sabes exactamente qué ganas y cómo
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: '#f1f3f5' }}>
            <X className="h-4 w-4" style={{ color: '#6b7280' }} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* 1. Que es el link */}
          <section>
            <p className="m-0 text-sm font-bold" style={{ color: '#1f2937' }}>
              1. ¿Qué hace este link?
            </p>
            <p className="m-0 mt-1 text-sm leading-relaxed" style={{ color: '#4b5563' }}>
              Es tu link personal de invitación. Toda persona que se registre como vendedor a través de él queda
              conectada a ti para siempre, como parte de <strong>tu equipo</strong>. Esa persona puede a su vez invitar
              a otras, y así se va formando una cadena de hasta <strong>5 niveles</strong> debajo de ti.
            </p>
          </section>

          {/* 2. Cuanto ganas */}
          <section className="rounded-2xl p-3.5" style={{ background: '#f0fdf4' }}>
            <p className="m-0 flex items-center gap-1.5 text-sm font-bold" style={{ color: '#166534' }}>
              <Wallet className="h-4 w-4" />
              2. ¿Cuánto ganas?
            </p>
            <p className="m-0 mt-1 text-sm leading-relaxed" style={{ color: '#4b5563' }}>
              Cada vez que alguien de tu equipo (hasta 5 niveles hacia abajo) <strong>entrega un pedido</strong>, tú
              recibes una comisión fija en pesos colombianos. Entre más abajo esté esa persona en tu cadena, menor es
              el monto:
            </p>
            <div className="mt-2 space-y-1">
              {NIVELES.map((n) => (
                <div key={n.nivel} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm">
                  <span style={{ color: '#374151' }}>{n.etiqueta}</span>
                  <span className="font-bold" style={{ color: '#166534' }}>
                    {formatCOP(n.monto)}
                  </span>
                </div>
              ))}
            </div>
            <p className="m-0 mt-2 text-xs" style={{ color: '#6b7280' }}>
              Si tu cadena llega a los 5 niveles completos, puedes ganar hasta <strong>{formatCOP(TOTAL_MAXIMO)}</strong>{' '}
              por un solo pedido entregado (repartido entre todos los que están arriba en la cadena de esa venta).
            </p>
          </section>

          {/* 3. Cuando se paga */}
          <section>
            <p className="m-0 flex items-center gap-1.5 text-sm font-bold" style={{ color: '#1f2937' }}>
              <CheckCircle2 className="h-4 w-4" style={{ color: '#198754' }} />
              3. ¿Cuándo se paga la comisión?
            </p>
            <p className="m-0 mt-1 text-sm leading-relaxed" style={{ color: '#4b5563' }}>
              Solo cuando el pedido queda marcado como <strong>ENTREGADO</strong>. Si el cliente lo devuelve o el
              pedido se cancela, <strong>no se paga ninguna comisión</strong> por ese pedido, a nadie de la cadena.
            </p>
          </section>

          {/* 4. Reglas importantes */}
          <section className="rounded-2xl p-3.5" style={{ background: '#fffbeb' }}>
            <p className="m-0 flex items-center gap-1.5 text-sm font-bold" style={{ color: '#92400e' }}>
              <AlertTriangle className="h-4 w-4" />
              4. Reglas que debes conocer
            </p>
            <ul className="m-0 mt-1.5 list-disc space-y-2 pl-4 text-sm leading-relaxed" style={{ color: '#4b5563' }}>
              <li>
                <strong>Actividad mínima:</strong> para que tú cobres por las ventas de alguien de tu equipo, esa
                persona debe haber entregado al menos <strong>2 pedidos ese mismo mes</strong>. Si no llega a 2, ese
                mes no cobras por sus ventas — solo gana comisión la persona que vendió directamente.
              </li>
              <li>
                <strong>Tiempo límite:</strong> los 5 niveles pagan comisión solo durante los primeros{' '}
                <strong>90 días</strong> desde que cada persona se registró. Pasado ese tiempo, tu nivel 1 (tus
                referidos directos) te sigue pagando <strong>para siempre</strong>, pero los niveles 2 al 5 ya no.
              </li>
              <li>
                <strong>Cadena incompleta:</strong> si tu equipo no llega a los 5 niveles, se paga solo hasta donde
                exista gente real en la cadena — no se inventan niveles.
              </li>
            </ul>
          </section>

          {/* 5. Alcance */}
          <section>
            <p className="m-0 flex items-center gap-1.5 text-sm font-bold" style={{ color: '#1f2937' }}>
              <PackageX className="h-4 w-4" style={{ color: '#dc2626' }} />
              5. ¿Esto aplica a todo?
            </p>
            <p className="m-0 mt-1 text-sm leading-relaxed" style={{ color: '#4b5563' }}>
              No. Estas comisiones aplican <strong>únicamente a las ventas del marketplace</strong> (productos que se
              venden a través de tu tienda). <strong>No aplica</strong> a los envíos que tú mismo generes en
              &quot;Generación de Guías&quot; para tus propios paquetes — eso es un servicio aparte, sin comisión de
              equipo.
            </p>
          </section>

          <section className="rounded-2xl border p-3.5 text-center" style={{ borderColor: '#e5e7eb', background: '#f8fafc' }}>
            <p className="m-0 text-sm font-semibold" style={{ color: '#1f2937' }}>
              En resumen: entre más gente activa tengas vendiendo, y entre más pedidos entreguen, más ganas tú —
              automático, sin hacer nada más que compartir tu link.
            </p>
          </section>

          <div>
            <p className="m-0 mb-1 text-xs font-medium" style={{ color: '#6b7280' }}>
              Tu link para invitar vendedores:
            </p>
            <div className="break-all rounded-lg border px-3 py-2 text-xs" style={{ borderColor: '#e5e7eb', color: '#374151', background: '#f9fafb' }}>
              {urlRegistro}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end" style={{ borderColor: '#e5e7eb' }}>
          <button onClick={onClose} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: '#d1d5db', color: '#4b5563' }}>
            Cerrar
          </button>
          <button
            onClick={onCopiar}
            className="flex items-center justify-center gap-1.5 rounded-full bg-[#198754] px-5 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            <Copy className="h-4 w-4" />
            Entendido, copiar mi link
          </button>
        </div>
      </div>
    </div>
  );
}
