/**
 * Formatea un número o texto de salario insertando automáticamente un punto cada 3 dígitos
 * contando de derecha a izquierda (separador de miles).
 * Ejemplo: "5000000" -> "5.000.000"
 * Ejemplo: "40000000" -> "40.000.000"
 */
export function formatSalaryNumber(text: string): string {
  if (!text) return '';

  // Extraer únicamente los dígitos
  const digitsOnly = text.replace(/\D/g, '');

  if (!digitsOnly) {
    // Si el usuario escribió un texto sin números (ej: "A convenir"), conservar el texto
    return text;
  }

  // Insertar punto cada 3 dígitos de derecha a izquierda
  const formattedDigits = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Si el texto incluye símbolo de pesos, formatear manteniendo el prefijo
  if (text.trim().startsWith('$')) {
    return `$ ${formattedDigits}`;
  }

  return formattedDigits;
}
