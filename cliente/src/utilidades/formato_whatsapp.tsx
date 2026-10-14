import React from 'react';

/**
 * Regex para capturar tokens de formato estándar de WhatsApp:
 * 1. Bloque de código: ```...```
 * 2. Código en línea: `...`
 * 3. Negrita: *...* (sin espacios inmediatamente dentro de los asteriscos)
 * 4. Cursiva: _..._ (sin espacios inmediatamente dentro de los guiones bajos)
 * 5. Tachado: ~...~ (sin espacios inmediatamente dentro de las tildes)
 */
const REGEX_WHATSAPP = /(```[\s\S]*?```|`[^`\n]+`|\*(?!\s)[^*\n]+?(?<!\s)\*|_(?!\s)[^_\n]+?(?<!\s)_|~(?!\s)[^~\n]+?(?<!\s)~)/g;

/**
 * Convierte texto con sintaxis de formato de WhatsApp en nodos de React nativos.
 * Respeta saltos de línea y anidación simple de formatos.
 * 
 * @param texto Cadena con texto en formato WhatsApp
 * @param profundidad Nivel de recursión para evitar bucles
 */
export function formatearTextoWhatsApp(texto: string, profundidad: number = 0): React.ReactNode {
  if (!texto) return null;
  if (profundidad > 2) return texto;

  const segmentos = texto.split(REGEX_WHATSAPP);

  if (segmentos.length === 1) {
    return texto;
  }

  return segmentos.map((segmento, indice) => {
    if (!segmento) return null;

    // 1. Bloque de código (```código```)
    if (segmento.startsWith('```') && segmento.endsWith('```') && segmento.length >= 6) {
      const contenido = segmento.slice(3, -3);
      return (
        <pre key={indice} className="whatsapp-bloque-codigo">
          <code>{contenido}</code>
        </pre>
      );
    }

    // 2. Código en línea (`código`)
    if (segmento.startsWith('`') && segmento.endsWith('`') && segmento.length >= 2) {
      const contenido = segmento.slice(1, -1);
      return (
        <code key={indice} className="whatsapp-codigo-enlinea">
          {contenido}
        </code>
      );
    }

    // 3. Negrita (*texto*)
    if (segmento.startsWith('*') && segmento.endsWith('*') && segmento.length >= 2) {
      const contenido = segmento.slice(1, -1);
      return (
        <strong key={indice} className="whatsapp-negrita">
          {formatearTextoWhatsApp(contenido, profundidad + 1)}
        </strong>
      );
    }

    // 4. Cursiva (_texto_)
    if (segmento.startsWith('_') && segmento.endsWith('_') && segmento.length >= 2) {
      const contenido = segmento.slice(1, -1);
      return (
        <em key={indice} className="whatsapp-cursiva">
          {formatearTextoWhatsApp(contenido, profundidad + 1)}
        </em>
      );
    }

    // 5. Tachado (~texto~)
    if (segmento.startsWith('~') && segmento.endsWith('~') && segmento.length >= 2) {
      const contenido = segmento.slice(1, -1);
      return (
        <del key={indice} className="whatsapp-tachado">
          {formatearTextoWhatsApp(contenido, profundidad + 1)}
        </del>
      );
    }

    // Texto regular
    return <React.Fragment key={indice}>{segmento}</React.Fragment>;
  });
}
