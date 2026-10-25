/**
 * ============================================================================
 * CONFIGURACIÓN DE SEGURIDAD: TIEMPO DE CIERRE DE SESIÓN POR INACTIVIDAD
 * ============================================================================
 * 
 * Puedes ajustar el tiempo de inactividad permitido antes de que el CRM cierre
 * la sesión del usuario automáticamente por motivos de seguridad.
 *
 * Ejemplos de configuración para HORAS_INACTIVIDAD_SESION:
 *   3    -> 3 horas (predeterminado solicitado)
 *   1    -> 1 hora
 *   0.5  -> 30 minutos
 *   8    -> 8 horas (jornada laboral continua)
 */
export const HORAS_INACTIVIDAD_SESION = 3; /* Horas */

// Conversión automática a milisegundos (Horas * 60 minutos * 60 segundos * 1000 ms)
export const TIEMPO_MAXIMO_INACTIVIDAD_MS = HORAS_INACTIVIDAD_SESION * 60 * 60 * 1000;

// Clave en almacenamiento local para coordinar la actividad entre todas las pestañas
export const CLAVE_ULTIMA_ACTIVIDAD = 'crm_ultima_actividad';
