import { base_datos, pool } from '../cliente/src/backend/base_datos/conexion.mjs';

async function retroalimentar() {
  console.log('Iniciando recuperación de nombres de archivos históricos...');
  const eventos = await base_datos.prepare(
    "SELECT payload_json FROM eventos_webhook WHERE payload_json::text LIKE '%filename%'"
  ).all();

  console.log(`Eventos con 'filename' encontrados: ${eventos.length}`);
  let actualizados = 0;

  for (const ev of eventos) {
    try {
      const p = typeof ev.payload_json === 'string' ? JSON.parse(ev.payload_json) : ev.payload_json;
      const att = p.message?.attachments?.[0];
      const url = att?.url;
      const fn = att?.payload?.filename;
      const mime = att?.payload?.mimeType;
      const idPlat = p.message?.platformMessageId || p.message?.id;

      if (fn && (url || idPlat)) {
        const res = await base_datos.prepare(`
          UPDATE mensajes 
          SET nombre_archivo = ?, 
              mime_tipo = ?, 
              tipo_contenido = 'documento' 
          WHERE (url_adjunto = ? OR (id_mensaje_plataforma IS NOT NULL AND id_mensaje_plataforma = ?))
            AND (nombre_archivo IS NULL OR nombre_archivo = '')
        `).run(fn, mime || null, url || '', idPlat || '');

        if (res.changes > 0) {
          console.log(`✓ Archivo recuperado: "${fn}" (Mensajes actualizados: ${res.changes})`);
          actualizados += res.changes;
        }
      }
    } catch (err) {
      console.warn('Error procesando evento individual:', err.message);
    }
  }

  console.log(`\n✅ Proceso finalizado. Total de mensajes históricos actualizados: ${actualizados}`);
  await pool.end();
}

retroalimentar().catch(console.error);

