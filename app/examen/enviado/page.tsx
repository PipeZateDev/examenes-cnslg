export default function ExamenEnviadoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-teal-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="text-7xl mb-6">✅</div>
        <h1 className="text-2xl font-bold text-emerald-800 mb-3">¡Examen Enviado!</h1>
        <p className="text-gray-600 mb-2">Tus respuestas han sido registradas exitosamente.</p>
        <p className="text-gray-500 text-sm mb-8">
          Tu docente podrá ver los resultados. Puedes cerrar esta ventana.
        </p>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-700">
          <p className="font-semibold">Recuerda:</p>
          <p>No podrás volver a presentar este examen a menos que el administrador te habilite un nuevo intento.</p>
        </div>
        <p className="text-xs text-gray-400 mt-6">
          Colegio Nuevo San Luis Gonzaga — Sistema de Exámenes
        </p>
      </div>
    </div>
  );
}
