export const metadata = {
  title: 'LokomproAqui | Política de Privacidad',
  description: 'Política de privacidad y tratamiento de datos personales de LokomproAqui.',
  alternates: { canonical: '/privacidad' },
};

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-gray-700">
      <h1 className="text-3xl font-extrabold text-gray-900">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-gray-500">Última actualización: agosto de 2026</p>

      <p className="mt-8 leading-relaxed">
        LokomproAqui.com S.A.S. ("LokomproAqui", "nosotros") opera la plataforma web y la aplicación móvil
        LokomproAqui, disponibles en www.lokomproaqui.com y en Google Play. Esta política explica qué información
        recolectamos, cómo la usamos y cuáles son tus derechos como titular de tus datos personales, en cumplimiento
        de la Ley 1581 de 2012 (Habeas Data) y el Decreto 1377 de 2013 de Colombia.
      </p>

      <h2 className="mt-10 text-xl font-bold text-gray-900">1. Información que recolectamos</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
        <li>Datos de registro: nombre completo, correo electrónico, número de teléfono, contraseña (almacenada de forma cifrada).</li>
        <li>Datos de ubicación para envíos: dirección, ciudad, departamento, información necesaria para generar guías de envío con nuestros transportadores aliados.</li>
        <li>Datos de pago: la información de tarjetas y medios de pago es procesada directamente por nuestra pasarela de pagos (ePayco); LokomproAqui no almacena números de tarjeta.</li>
        <li>Datos de negocio: productos publicados, pedidos, historial de ventas, comisiones y saldos, para proveedores y vendedores.</li>
        <li>Archivos que subas voluntariamente: fotos de productos o documentos de soporte para tu tienda.</li>
        <li>Datos técnicos básicos: dirección IP y datos de uso de la app, para seguridad y prevención de fraude.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-gray-900">2. Uso de la información</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
        <li>Crear y administrar tu cuenta, y darte acceso a las funciones de la plataforma.</li>
        <li>Procesar pedidos, generar guías de envío y coordinar la logística con nuestros aliados transportadores (Mipaquete y transportadoras asociadas).</li>
        <li>Procesar pagos y retiros a través de nuestra pasarela de pagos.</li>
        <li>Comunicarnos contigo sobre tus pedidos, tu cuenta o novedades del servicio (correo, WhatsApp).</li>
        <li>Mejorar la plataforma y prevenir fraude o uso indebido.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-gray-900">3. Con quién compartimos tu información</h2>
      <p className="mt-3 leading-relaxed">
        Compartimos únicamente la información necesaria con: transportadoras (para la entrega de pedidos), nuestra
        pasarela de pagos (para procesar transacciones) y proveedores de infraestructura tecnológica que almacenan
        nuestros datos de forma segura. No vendemos tu información personal a terceros con fines publicitarios.
      </p>

      <h2 className="mt-10 text-xl font-bold text-gray-900">4. Tus derechos</h2>
      <p className="mt-3 leading-relaxed">Como titular de tus datos personales, tienes derecho a:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
        <li>Conocer, actualizar y rectificar tus datos personales.</li>
        <li>Solicitar prueba de la autorización otorgada para el tratamiento de tus datos.</li>
        <li>Ser informado sobre el uso que se le ha dado a tus datos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley.</li>
        <li>Revocar la autorización y/o solicitar la supresión de tus datos, cuando no exista un deber legal o contractual que impida eliminarlos.</li>
        <li>Acceder de forma gratuita a tus datos personales.</li>
      </ul>
      <p className="mt-3 leading-relaxed">
        Puedes solicitar cualquiera de estos derechos escribiendo a{' '}
        <a href="mailto:soporte@lokomproaqui.com" className="font-semibold text-[#02a0e3] underline">
          soporte@lokomproaqui.com
        </a>
        .
      </p>

      <h2 className="mt-10 text-xl font-bold text-gray-900">5. Seguridad y retención de datos</h2>
      <p className="mt-3 leading-relaxed">
        Aplicamos medidas técnicas y administrativas razonables para proteger tu información contra acceso no
        autorizado, pérdida o alteración. Conservamos tus datos mientras tu cuenta esté activa o mientras sea
        necesario para cumplir obligaciones legales, contables o contractuales.
      </p>

      <h2 className="mt-10 text-xl font-bold text-gray-900">6. Cambios a esta política</h2>
      <p className="mt-3 leading-relaxed">
        Podemos actualizar esta política ocasionalmente. Publicaremos cualquier cambio en esta misma página con su
        fecha de actualización.
      </p>

      <h2 className="mt-10 text-xl font-bold text-gray-900">7. Contacto</h2>
      <p className="mt-3 leading-relaxed">
        Si tienes preguntas sobre esta política de privacidad, escríbenos a{' '}
        <a href="mailto:soporte@lokomproaqui.com" className="font-semibold text-[#02a0e3] underline">
          soporte@lokomproaqui.com
        </a>
        .
      </p>
    </div>
  );
}
