'use client';

import { useEffect } from 'react';

// Port de IndexComponent (Angular, "/config/store/index", modulo lazy bodega) -- landing con 2
// secciones (bodegas destacadas + productos certificados) IDENTICA en concepto a la ya portada
// /config/verCatalagoProveedor (misma UsuariosService.getStore + ProductoService.get real). En vez
// de duplicar esa pantalla bajo otra URL, se redirige ahi directamente.

export default function StoreIndexPage() {
  useEffect(() => {
    window.location.href = '/config/verCatalagoProveedor';
  }, []);
  return null;
}
