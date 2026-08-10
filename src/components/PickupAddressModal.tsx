'use client';

import { X } from 'lucide-react';
import { PickupAddressCard } from '@/components/PickupAddressCard';

// Bug real reportado por el usuario 2026-08-10: la direccion/cedula de recogida de un proveedor
// (pickup_addresses, usada para generar guias reales de Mipaquete) solo se podia editar desde la
// PROPIA cuenta del proveedor (PickupAddressCard en /config/perfil, pestaña "bodega") -- el admin
// no tenia ninguna forma de corregirla si el proveedor la escribio mal (caso real: una cedula de 9
// digitos, invalida para Mipaquete, que rompia createSendings con un 500 dificil de diagnosticar).
// Se reusa el MISMO componente/formulario ya construido y probado (mismas validaciones, mismo
// buscador de ciudad Mipaquete) en vez de duplicar el formulario -- PickupAddressCard no asume que
// el usuario logueado es el dueno del profileId, solo recibe el id como prop.
interface PickupAddressModalProps {
  profileId: string;
  nombreProveedor: string;
  onClose: () => void;
}

export function PickupAddressModal({ profileId, nombreProveedor, onClose }: PickupAddressModalProps) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h4 className="text-base font-bold text-gray-900">Dirección de recogida — {nombreProveedor}</h4>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 py-4">
          <PickupAddressCard profileId={profileId} />
        </div>
      </div>
    </div>
  );
}
