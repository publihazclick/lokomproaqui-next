'use client';

import { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchWoocommerceConnection, conectarWoocommerce, desconectarWoocommerce, type WoocommerceConnection } from '@/lib/woocommerce';
import { useToast, Toast } from '@/components/Toast';

// Port de WoocommerceConnectComponent (Angular, "/config/woocommerce") -- mismo mecanismo que
// Shopify (ver /config/shopify), WoocommerceService ya estaba bien implementado, sin bugs reales.

export default function WoocommerceConnectPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [conexion, setConexion] = useState<WoocommerceConnection | null>(null);
  const [form, setForm] = useState({ store_url: '', consumer_key: '', consumer_secret: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      setConexion(await fetchWoocommerceConnection(usuario.id));
      setEstado('listo');
    });
  }, []);

  async function conectar() {
    if (!form.store_url || !form.consumer_key || !form.consumer_secret) {
      mostrar('Completa los 3 campos para conectar tu tienda');
      return;
    }
    if (!dataUser) return;
    setGuardando(true);
    const res = await conectarWoocommerce({ profile_id: dataUser.id, ...form });
    setGuardando(false);
    if (!res.success) {
      mostrar(res.message || 'No se pudo conectar la tienda');
      return;
    }
    mostrar('Tienda de WooCommerce conectada correctamente');
    setForm({ store_url: '', consumer_key: '', consumer_secret: '' });
    setConexion(await fetchWoocommerceConnection(dataUser.id));
  }

  async function desconectar() {
    if (!dataUser) return;
    setGuardando(true);
    const ok = await desconectarWoocommerce(dataUser.id);
    setGuardando(false);
    if (!ok) {
      mostrar('No se pudo desconectar la tienda');
      return;
    }
    mostrar('Tienda desconectada');
    setConexion(null);
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1000px] px-3 py-6">
      <div className="rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
          <Store className="h-5 w-5" />
          <h4 className="text-lg font-bold">Conectar WooCommerce</h4>
        </div>
        <div className="p-5">
          {conexion ? (
            <div>
              <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
                <strong>Tu tienda ya esta conectada</strong>
                <br />
                Tienda: <b>{conexion.store_url}</b>
                <br />
                Conectada desde: {new Date(conexion.connected_at).toLocaleString('es-CO')}
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Los pedidos nuevos de esta tienda van a aparecer automaticamente en <b>Autorizar Despacho</b>. Si algun producto no se puede identificar, te va a aparecer un aviso en{' '}
                <b>Pedidos WooCommerce por Revisar</b> para que lo relaciones una sola vez.
              </p>
              <button onClick={desconectar} disabled={guardando} className="mt-4 rounded bg-[#dc3545] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                Desconectar tienda
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <h5 className="font-semibold text-gray-800">Como conectar tu tienda</h5>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-600">
                  <li>Entra al panel de administracion de tu tienda de WordPress (wp-admin).</li>
                  <li>
                    Ve a <b>WooCommerce &gt; Ajustes &gt; Avanzado &gt; API REST</b>.
                  </li>
                  <li>
                    Da clic en <b>Agregar clave</b> (o &quot;Crear una clave de API&quot;).
                  </li>
                  <li>
                    Ponle cualquier descripcion (por ejemplo &quot;LokomproAqui&quot;) y en <b>Permisos</b> elige <b>Lectura/Escritura</b>.
                  </li>
                  <li>
                    Genera la clave y copia el <b>Consumer key</b> (empieza con &quot;ck_&quot;) y el <b>Consumer secret</b> (empieza con &quot;cs_&quot;) que te muestra WooCommerce, junto con la
                    URL de tu tienda.
                  </li>
                </ol>
                <p className="mt-2 text-xs italic text-gray-500">
                  Importante: en cada producto de tu tienda de WooCommerce, en el campo &quot;SKU&quot; (o el SKU de cada variacion), pon el mismo codigo que tiene el producto en LokomproAqui, para
                  que los pedidos se relacionen solos.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">URL de tu tienda</label>
                  <input
                    value={form.store_url}
                    onChange={(e) => setForm({ ...form, store_url: e.target.value })}
                    placeholder="https://mitienda.com"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Consumer key</label>
                  <input
                    value={form.consumer_key}
                    onChange={(e) => setForm({ ...form, consumer_key: e.target.value })}
                    placeholder="ck_..."
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Consumer secret</label>
                  <input
                    value={form.consumer_secret}
                    onChange={(e) => setForm({ ...form, consumer_secret: e.target.value })}
                    placeholder="cs_..."
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <button onClick={conectar} disabled={guardando} className="rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                  {guardando ? 'Conectando...' : 'Conectar tienda'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
