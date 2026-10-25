/**
 * Utilidades de formateo visual para CRM Óptica
 * Convención de código: Estrictamente en español
 */

/**
 * Formatea un número telefónico al estándar comercial con código, paréntesis y guión:
 * Ejemplo: +57 (313) 253-1494
 */
export function formatearTelefono(telefono?: string | null): string {
  if (!telefono) return '';

  const textoLimpio = String(telefono).trim();
  const soloDigitos = textoLimpio.replace(/\D/g, '');

  if (!soloDigitos) return textoLimpio;

  // Caso: Colombia con código 57 (12 dígitos, ej. 573132531494)
  if (soloDigitos.length === 12 && soloDigitos.startsWith('57')) {
    const area = soloDigitos.substring(2, 5);
    const grupo1 = soloDigitos.substring(5, 8);
    const grupo2 = soloDigitos.substring(8, 12);
    return `+57 (${area}) ${grupo1}-${grupo2}`;
  }

  // Caso: Colombia móvil estándar sin prefijo internacional (10 dígitos, ej. 3132531494)
  if (soloDigitos.length === 10) {
    const area = soloDigitos.substring(0, 3);
    const grupo1 = soloDigitos.substring(3, 6);
    const grupo2 = soloDigitos.substring(6, 10);
    return `+57 (${area}) ${grupo1}-${grupo2}`;
  }

  // Caso: Internacional general con más de 10 dígitos (ej. +1 800 555 1234)
  if (soloDigitos.length > 10) {
    const diezFinales = soloDigitos.slice(-10);
    const codigoPais = soloDigitos.slice(0, -10);
    const area = diezFinales.substring(0, 3);
    const grupo1 = diezFinales.substring(3, 6);
    const grupo2 = diezFinales.substring(6, 10);
    return `+${codigoPais} (${area}) ${grupo1}-${grupo2}`;
  }

  return textoLimpio;
}

/**
 * Formatea un número telefónico sin prefijo internacional ni código +57 (ej. 313 253 1694)
 */
export function formatearTelefonoSinPrefijo(telefono?: string | null): string {
  if (!telefono) return '';
  const textoLimpio = String(telefono).trim();
  let soloDigitos = textoLimpio.replace(/\D/g, '');
  if (!soloDigitos) return textoLimpio;

  if (soloDigitos.length === 12 && soloDigitos.startsWith('57')) {
    soloDigitos = soloDigitos.substring(2);
  }

  if (soloDigitos.length === 10) {
    const area = soloDigitos.substring(0, 3);
    const grupo1 = soloDigitos.substring(3, 6);
    const grupo2 = soloDigitos.substring(6, 10);
    return `${area} ${grupo1} ${grupo2}`;
  }

  return textoLimpio.replace(/^\+?57\s*/, '');
}

/**
 * Formatea un número o texto numérico con separador de miles (estándar Colombia con puntos: 1.002.021.660)
 */
export function formatearSeparadorMiles(valor?: string | number | null): string {
  if (valor === undefined || valor === null) return '';
  const digitos = String(valor).replace(/\D/g, '');
  if (!digitos) return '';
  return new Intl.NumberFormat('es-CO').format(Number(digitos));
}

/**
 * Detecta si un nombre es genérico del canal (ej: "Contacto +57...", o solo números telefónicos)
 */
export function esNombreGenericoOTelefono(texto?: string | null): boolean {
  if (!texto) return true;
  const t = texto.trim();
  if (!t) return true;
  if (/^contacto\s*\+?\d+/i.test(t)) return true;
  if (/^paciente(\s*sin\s*nombre)?$/i.test(t)) return true;
  if (/^sin\s*nombre$/i.test(t)) return true;
  // Si contiene solo símbolos de teléfono y dígitos (ej: +57313..., 313253...)
  const soloDigitos = t.replace(/[^\d]/g, '');
  const sinSimbolosTel = t.replace(/[\d\s\-+().]/g, '');
  if (sinSimbolosTel === '' && soloDigitos.length >= 7) {
    return true;
  }
  return false;
}

/**
 * Obtiene el nombre formateado de un paciente o contacto.
 * Si no tiene nombre registrado real, retorna 'Paciente sin nombre'.
 */
export function obtenerNombrePaciente(contacto?: {
  nombre_completo?: string | null;
  nombre?: string | null;
  contacto_nombre?: string | null;
  telefono?: string | null;
  contacto_telefono?: string | null;
} | null): string {
  if (!contacto) return 'Paciente sin nombre';
  const nombreDirecto = (contacto.nombre_completo || contacto.nombre || contacto.contacto_nombre || '').trim();
  if (nombreDirecto && !esNombreGenericoOTelefono(nombreDirecto)) {
    return nombreDirecto;
  }
  return 'Paciente sin nombre';
}

/**
 * Formatea el nombre del paciente exclusivamente para la píldora compacta del calendario mensual:
 * - 4 nombres/palabras (ej. "Moises Enrique Leguizamo Barrios") -> muestra 1er y 3er nombre ("Moises Leguizamo").
 * - 3 nombres/palabras (ej. "Samir Bolívar Barrios") -> muestra 1er y 2do nombre ("Samir Bolívar").
 * - 2 o menos palabras -> muestra el nombre tal cual.
 * - Más de 4 palabras -> muestra 1er y 3er nombre.
 */
export function formatearNombrePildoraCita(nombre?: string | null): string {
  if (!nombre) return 'Paciente';
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 4 || palabras.length > 4) {
    return `${palabras[0]} ${palabras[2]}`;
  }
  if (palabras.length === 3) {
    return `${palabras[0]} ${palabras[1]}`;
  }
  return palabras.join(' ');
}

/**
 * Determina si una conversación o interacción se encuentra dentro de la ventana de 24 horas oficial de Meta WhatsApp.
 */
export function estaEnVentana24Horas(ultimoMensajeEntranteEn?: string | null): boolean {
  if (!ultimoMensajeEntranteEn) return false;
  const fecha = new Date(ultimoMensajeEntranteEn).getTime();
  if (isNaN(fecha)) return false;
  return (Date.now() - fecha) < 24 * 60 * 60 * 1000;
}

/**
 * Convierte un texto de hora en cualquier formato (ej: '03:00 PM', '11:00 AM', '15:30', '9:00am')
 * a minutos totales desde la medianoche (0 - 1439).
 * Permite ordenar cronológicamente de la cita más temprana a la más tardía.
 */
export function convertirHoraAMinutos(hora?: string | null): number {
  if (!hora || typeof hora !== 'string') return 0;
  const texto = hora.trim().toUpperCase();
  const esPM = texto.includes('PM');
  const esAM = texto.includes('AM');

  const match = texto.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;

  let horas = parseInt(match[1], 10);
  const minutos = parseInt(match[2], 10);

  if (esPM) {
    if (horas < 12) horas += 12;
  } else if (esAM) {
    if (horas === 12) horas = 0;
  }

  return horas * 60 + minutos;
}

/**
 * Función de comparación para ordenar citas estrictamente cronológicas:
 * 1. Por fecha ascendente (YYYY-MM-DD)
 * 2. Por hora ascendente (de más temprana a más tardía considerando AM/PM)
 * 3. Por id ascendente
 */
export function compararCitasPorFechaYHora<T extends { fecha_cita?: string | null; hora_cita?: string | null; id?: any }>(a: T, b: T): number {
  const fA = a.fecha_cita || '';
  const fB = b.fecha_cita || '';
  if (fA !== fB) {
    return fA.localeCompare(fB);
  }
  const minA = convertirHoraAMinutos(a.hora_cita);
  const minB = convertirHoraAMinutos(b.hora_cita);
  if (minA !== minB) {
    return minA - minB;
  }
  return Number(a.id || 0) - Number(b.id || 0);
}

/**
 * Formatea el eje de refracción óptica asegurando exactamente un único símbolo de grados (°).
 * Si el valor ya contiene uno o más símbolos de grado (ej: '20°', '20°°') o no los tiene (ej: '20', 20),
 * garantiza que se visualice siempre con un solo grado '20°'. Si es nulo o vacío, retorna el fallback.
 */
export function formatearEjeVisual(eje?: string | number | null, fallback: string = '0°'): string {
  if (eje === undefined || eje === null || String(eje).trim() === '') {
    return fallback;
  }
  const limpio = String(eje).replace(/°+/g, '').trim();
  if (!limpio) return fallback;
  return `${limpio}°`;
}

/**
 * Formatea la distancia pupilar (DP) asegurando el sufijo ' mm' únicamente si hay un número válido.
 * Si el campo está vacío o no contiene dígitos, retorna una cadena vacía.
 */
export function formatearDistanciaPupilar(valor?: string | number | null): string {
  if (valor === undefined || valor === null) return '';
  const soloDigitos = String(valor).replace(/\D/g, '').trim();
  if (!soloDigitos) return '';
  return `${soloDigitos} mm`;
}

/**
 * Formatea el nombre de un especialista / optómetra garantizando:
 * 1. Limpieza de espacios redundantes al inicio, al final y entre palabras.
 * 2. Si está vacío o solo contiene espacios o prefijos aislados, retorna ''.
 * 3. Garantiza el prefijo 'Dr.' (o 'Dra.') al inicio (sin duplicarlo si ya lo tenía).
 * 4. Pone en mayúscula la primera letra de cada palabra y el resto en minúscula (Title Case).
 */
export function formatearNombreEspecialista(nombre?: string | null): string {
  if (!nombre) return '';
  const limpio = String(nombre).trim().replace(/\s+/g, ' ');
  if (!limpio) return '';

  const palabras = limpio.split(' ');
  if (palabras.length === 0) return '';

  // Detectar si la primera palabra es variante de Dr. o Dra.
  const primeraLimpia = palabras[0].toLowerCase().replace(/\.+$/, '');
  let prefijo = 'Dr.';
  let palabrasRestantes: string[] = [];

  if (primeraLimpia === 'dr' || primeraLimpia === 'doctor') {
    prefijo = 'Dr.';
    palabrasRestantes = palabras.slice(1);
  } else if (primeraLimpia === 'dra' || primeraLimpia === 'doctora') {
    prefijo = 'Dra.';
    palabrasRestantes = palabras.slice(1);
  } else {
    prefijo = 'Dr.';
    palabrasRestantes = palabras;
  }

  // Filtrar palabras vacías
  palabrasRestantes = palabrasRestantes.filter((p) => p.trim().length > 0);

  // Si no hay palabras tras remover el prefijo, retornar vacío
  if (palabrasRestantes.length === 0) {
    return '';
  }

  // Capitalizar cada palabra (Title Case): primera letra mayúscula, resto minúscula
  const palabrasFormateadas = palabrasRestantes.map((palabra) => {
    const min = palabra.toLowerCase();
    return min.charAt(0).toUpperCase() + min.slice(1);
  });

  return `${prefijo} ${palabrasFormateadas.join(' ')}`;
}

/**
 * Determina si la ficha clínica de un paciente/contacto está incompleta.
 * Se considera incompleta si no tiene documento/cédula registrada.
 */
export function esFichaIncompleta(contacto?: {
  cedula?: string | null;
  documento?: string | null;
  contacto_cedula?: string | null;
  nombre?: string | null;
  nombre_completo?: string | null;
  contacto_nombre?: string | null;
} | null): boolean {
  if (!contacto) return true;
  const doc = (contacto.cedula || contacto.documento || contacto.contacto_cedula || '').trim();
  return !doc;
}

/**
 * Devuelve lista amigable de campos clínicos pendientes por completar en recepción.
 */
export function obtenerCamposFaltantesFicha(contacto?: {
  cedula?: string | null;
  documento?: string | null;
  contacto_cedula?: string | null;
  edad?: number | null;
  contacto_edad?: number | null;
  telefono?: string | null;
  contacto_telefono?: string | null;
} | null): string[] {
  if (!contacto) return ['Documento', 'Edad'];
  const faltantes: string[] = [];
  const doc = (contacto.cedula || contacto.documento || contacto.contacto_cedula || '').trim();
  if (!doc) faltantes.push('Documento de identidad');
  const edad = contacto.edad ?? contacto.contacto_edad;
  if (edad === undefined || edad === null || edad <= 0) faltantes.push('Edad');
  return faltantes;
}

/**
 * Obtiene la fecha actual en la zona horaria oficial de Colombia ('America/Bogota') en formato ISO YYYY-MM-DD
 */
export function obtenerFechaHoyColombia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/**
 * Obtiene la fecha de mañana en la zona horaria oficial de Colombia ('America/Bogota') en formato ISO YYYY-MM-DD
 */
export function obtenerFechaMananaColombia(): string {
  const hoyStr = obtenerFechaHoyColombia();
  const [ano, mes, dia] = hoyStr.split('-').map(Number);
  const fechaUtc = new Date(Date.UTC(ano, mes - 1, dia));
  fechaUtc.setUTCDate(fechaUtc.getUTCDate() + 1);
  return fechaUtc.toISOString().slice(0, 10);
}

/**
 * Obtiene un objeto Date con la fecha local de Colombia (año, mes y día de Colombia)
 */
export function obtenerFechaObjetoColombia(): Date {
  const hoyStr = obtenerFechaHoyColombia();
  const [ano, mes, dia] = hoyStr.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

/**
 * Obtiene las partes numéricas de la fecha actual en Colombia { ano, mes (0-11), dia }
 */
export function obtenerPartesFechaColombia(): { ano: number; mes: number; dia: number } {
  const hoyStr = obtenerFechaHoyColombia();
  const [ano, mes, dia] = hoyStr.split('-').map(Number);
  return { ano, mes: mes - 1, dia };
}

