/**
 * Catálogo central de motivos de citas disponibles para el CRM de Óptica
 */
export const MOTIVOS_CITAS_PREDETERMINADOS = [
  'Examen Visual y Control Anual',
  'Primera Vez - Examen Computarizado',
  'Adaptación de Lentes de Contacto',
  'Control de Miopía y Astigmatismo',
  'Revisión de Montura y Graduación',
  'Molestia Ocular / Urgencia Visual',
];

/**
 * Obtiene los motivos disponibles a partir del perfil de la óptica o catálogo predeterminado
 */
export function obtenerMotivosDisponiblesOptica(motivosOptica?: string[] | null): string[] {
  if (Array.isArray(motivosOptica) && motivosOptica.length > 0) {
    return motivosOptica.map((m) => String(m).trim()).filter(Boolean);
  }
  return [...MOTIVOS_CITAS_PREDETERMINADOS];
}
