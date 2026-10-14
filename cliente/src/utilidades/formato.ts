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
 * Determina si una conversación o interacción se encuentra dentro de la ventana de 24 horas oficial de Meta WhatsApp.
 */
export function estaEnVentana24Horas(ultimoMensajeEntranteEn?: string | null): boolean {
  if (!ultimoMensajeEntranteEn) return false;
  const fecha = new Date(ultimoMensajeEntranteEn).getTime();
  if (isNaN(fecha)) return false;
  return (Date.now() - fecha) < 24 * 60 * 60 * 1000;
}



