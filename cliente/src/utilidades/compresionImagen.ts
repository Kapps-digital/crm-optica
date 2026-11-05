/**
 * Límite máximo global por archivo: 10 MB
 */
export const LIMITE_MAXIMO_ARCHIVO_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Optimiza y comprime imágenes automáticamente en el navegador usando HTML5 Canvas.
 * Reduce fotos pesadas de celulares (5 MB - 10 MB) a ~150 KB - 250 KB
 * sin pérdida visible de nitidez en WhatsApp.
 */
export async function optimizarImagenNavegador(
  archivo: File,
  dimensionMaxima: number = 1600,
  calidad: number = 0.82
): Promise<File> {
  // Si no es imagen o es SVG / GIF animado, retornar el archivo original
  if (
    !archivo.type.startsWith('image/') ||
    archivo.type.includes('svg') ||
    archivo.type.includes('gif')
  ) {
    return archivo;
  }

  // Si ya es sumamente liviana (<= 180 KB), no requiere compresión agresiva
  if (archivo.size <= 180 * 1024) {
    return archivo;
  }

  return new Promise((resolve) => {
    const urlTemporal = URL.createObjectURL(archivo);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(urlTemporal);

      let ancho = img.naturalWidth || img.width;
      let alto = img.naturalHeight || img.height;

      if (!ancho || !alto) {
        resolve(archivo);
        return;
      }

      // Escalar proporcionalmente si supera la dimensión máxima permitida
      if (ancho > dimensionMaxima || alto > dimensionMaxima) {
        if (ancho > alto) {
          alto = Math.round((alto * dimensionMaxima) / ancho);
          ancho = dimensionMaxima;
        } else {
          ancho = Math.round((ancho * dimensionMaxima) / alto);
          alto = dimensionMaxima;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = ancho;
      canvas.height = alto;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(archivo);
        return;
      }

      // Dibujar imagen redimensionada
      ctx.drawImage(img, 0, 0, ancho, alto);

      // Usar WebP para máxima compresión y compatibilidad moderna con Meta WhatsApp
      const formatoSalida = 'image/webp';
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= archivo.size) {
            // Si la conversión no ahorró peso, conservar archivo original
            resolve(archivo);
            return;
          }

          const nombreBase = archivo.name.includes('.')
            ? archivo.name.substring(0, archivo.name.lastIndexOf('.'))
            : archivo.name;
          const nuevoNombre = `${nombreBase}.webp`;

          const archivoComprimido = new File([blob], nuevoNombre, {
            type: formatoSalida,
            lastModified: Date.now(),
          });

          resolve(archivoComprimido);
        },
        formatoSalida,
        calidad
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(urlTemporal);
      resolve(archivo);
    };

    img.src = urlTemporal;
  });
}

