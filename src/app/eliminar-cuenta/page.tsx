export const metadata = {
  title: 'LokomproAqui | Eliminar cuenta y datos',
  description: 'Cómo solicitar la eliminación de tu cuenta y tus datos en LokomproAqui.',
  alternates: { canonical: '/eliminar-cuenta' },
};

export default function EliminarCuentaPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-gray-700">
      <h1 className="text-3xl font-extrabold text-gray-900">Eliminar tu cuenta y tus datos en LokomproAqui</h1>

      <p className="mt-8 leading-relaxed">
        Si quieres eliminar tu cuenta de LokomproAqui (aplicación y sitio web www.lokomproaqui.com) y los datos
        asociados a ella, escríbenos a{' '}
        <a href="mailto:soporte@lokomproaqui.com" className="font-semibold text-[#02a0e3] underline">
          soporte@lokomproaqui.com
        </a>{' '}
        desde el correo con el que te registraste, indicando en el asunto <strong>&quot;Eliminar cuenta&quot;</strong>.
      </p>

      <h2 className="mt-10 text-xl font-bold text-gray-900">Pasos para solicitar la eliminación</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-6 leading-relaxed">
        <li>Envía un correo a soporte@lokomproaqui.com desde la cuenta de correo registrada en LokomproAqui.</li>
        <li>Incluye tu nombre completo y el correo o número de teléfono con el que te registraste.</li>
        <li>Nuestro equipo confirmará tu identidad y procesará la solicitud en un plazo máximo de 15 días hábiles.</li>
      </ol>

      <h2 className="mt-10 text-xl font-bold text-gray-900">Qué datos se eliminan</h2>
      <p className="mt-3 leading-relaxed">
        Se elimina tu perfil de usuario (nombre, correo, teléfono, dirección) y el acceso a tu cuenta.
      </p>

      <h2 className="mt-10 text-xl font-bold text-gray-900">Qué datos se conservan y por cuánto tiempo</h2>
      <p className="mt-3 leading-relaxed">
        Por obligaciones legales, contables y tributarias, conservamos durante un período adicional los registros de
        pedidos, pagos y guías de envío ya realizados (facturación, prevención de fraude y requisitos de las
        autoridades tributarias colombianas), aunque tu cuenta ya no esté activa. Estos registros no se usan para
        ningún otro fin.
      </p>

      <p className="mt-10 leading-relaxed">
        Más información sobre el tratamiento de tus datos en nuestra{' '}
        <a href="/privacidad" className="font-semibold text-[#02a0e3] underline">
          Política de Privacidad
        </a>
        .
      </p>
    </div>
  );
}
