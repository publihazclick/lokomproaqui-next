'use client';

import { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchShopifyConnection, conectarShopify, desconectarShopify, type ShopifyConnection } from '@/lib/shopify';
import { useToast, Toast } from '@/components/Toast';

// Port de ShopifyConnectComponent (Angular, "/config/shopify") -- port 1:1, ShopifyService ya
// estaba bien implementado (Edge Function shopify-connect), sin bugs reales.

export default function ShopifyConnectPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [conexion, setConexion] = useState<ShopifyConnection | null>(null);
  const [form, setForm] = useState({ shop_domain: '', access_token: '', api_secret: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      setConexion(await fetchShopifyConnection(usuario.id));
      setEstado('listo');
    });
  }, []);

  async function conectar() {
    if (!form.shop_domain || !form.access_token || !form.api_secret) {
      mostrar('Completa los 3 campos para conectar tu tienda');
      return;
    }
    if (!dataUser) return;
    setGuardando(true);
    const res = await conectarShopify({ profile_id: dataUser.id, ...form });
    setGuardando(false);
    if (!res.success) {
      mostrar(res.message || 'No se pudo conectar la tienda');
      return;
    }
    mostrar('Tienda de Shopify conectada correctamente');
    setForm({ shop_domain: '', access_token: '', api_secret: '' });
    setConexion(await fetchShopifyConnection(dataUser.id));
  }

  async function desconectar() {
    if (!dataUser) return;
    setGuardando(true);
    const ok = await desconectarShopify(dataUser.id);
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
          <h4 className="text-lg font-bold">Conectar Shopify</h4>
        </div>
        <div className="p-5">
          {conexion ? (
            <div>
              <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
                <strong>Tu tienda ya esta conectada</strong>
                <br />
                Tienda: <b>{conexion.shop_domain}</b>
                <br />
                Conectada desde: {new Date(conexion.connected_at).toLocaleString('es-CO')}
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Los pedidos nuevos de esta tienda van a aparecer automaticamente en <b>Autorizar Despacho</b>. Si algun producto no se puede identificar, te va a aparecer un aviso en{' '}
                <b>Pedidos Shopify por Revisar</b> para que lo relaciones una sola vez.
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
                  <li>Entra al panel de administracion de tu tienda de Shopify.</li>
                  <li>
                    Ve a <b>Configuracion &gt; Aplicaciones y canales de venta &gt; Desarrollar aplicaciones</b>.
                  </li>
                  <li>Crea una aplicacion personalizada (dale cualquier nombre, por ejemplo &quot;LokomproAqui&quot;).</li>
                  <li>
                    En permisos de la API Admin, activa <b>lectura y escritura</b> de <b>Pedidos (orders)</b> y <b>lectura</b> de <b>Productos (products)</b>.
                  </li>
                  <li>Instala la aplicacion en tu tienda.</li>
                  <li>
                    Copia el <b>token de acceso de la API Admin</b> (empieza con &quot;shpat_&quot;) y el <b>Client secret</b> (secreto de la API) que te muestra Shopify, y pegalos aqui abajo junto
                    con el dominio de tu tienda.
                  </li>
                </ol>
                <p className="mt-2 text-xs italic text-gray-500">
                  Importante: en cada producto de tu tienda de Shopify, en el campo &quot;SKU&quot; de la variante, pon el mismo codigo que tiene el producto en LokomproAqui, para que los pedidos se
                  relacionen solos.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Dominio de tu tienda</label>
                  <input
                    value={form.shop_domain}
                    onChange={(e) => setForm({ ...form, shop_domain: e.target.value })}
                    placeholder="mitienda.myshopify.com"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Token de acceso de la API Admin</label>
                  <input
                    value={form.access_token}
                    onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                    placeholder="shpat_..."
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Client secret (secreto de la API)</label>
                  <input
                    value={form.api_secret}
                    onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
                    placeholder="shpss_..."
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
