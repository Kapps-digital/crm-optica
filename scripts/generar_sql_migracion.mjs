import { base_datos } from '../base_datos/conexion.mjs';
import fs from 'node:fs';
import path from 'node:path';

function escaparSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generarInserts() {
  const lotes = [];

  // 1. Eventos Webhook
  const eventos = base_datos.prepare('SELECT * FROM eventos_webhook').all();
  if (eventos.length > 0) {
    const valores = eventos.map((e) => {
      const payload = e.payload_json ? `'${e.payload_json.replace(/'/g, "''")}'::jsonb` : 'NULL';
      return `(${escaparSql(e.id_evento)}, ${escaparSql(e.tipo_evento)}, ${escaparSql(e.estado)}, ${e.intentos || 0}, ${payload}, ${escaparSql(e.error_mensaje)}, ${escaparSql(e.creado_en)}::timestamptz, ${escaparSql(e.actualizado_en)}::timestamptz)`;
    });
    lotes.push(`
      INSERT INTO "CRM_Opticas".eventos_webhook (id_evento, tipo_evento, estado, intentos, payload_json, error_mensaje, creado_en, actualizado_en)
      VALUES ${valores.join(',\n')}
      ON CONFLICT (id_evento) DO NOTHING;
    `);
  }

  // 2. Contactos
  const contactos = base_datos.prepare('SELECT * FROM contactos ORDER BY id ASC').all();
  if (contactos.length > 0) {
    const valores = contactos.map((c) => {
      return `(${c.id}, ${escaparSql(c.nombre)}, ${escaparSql(c.telefono)}, ${escaparSql(c.correo)}, ${escaparSql(c.business_scoped_user_id)}, ${escaparSql(c.creado_en)}::timestamptz, ${escaparSql(c.actualizado_en)}::timestamptz)`;
    });
    lotes.push(`
      INSERT INTO "CRM_Opticas".contactos (id, nombre, telefono, correo, business_scoped_user_id, creado_en, actualizado_en)
      OVERRIDING SYSTEM VALUE
      VALUES ${valores.join(',\n')}
      ON CONFLICT (id) DO NOTHING;
      SELECT setval(pg_get_serial_sequence('"CRM_Opticas".contactos', 'id'), COALESCE((SELECT MAX(id) FROM "CRM_Opticas".contactos), 1));
    `);
  }

  // 3. Conversaciones
  const conversaciones = base_datos.prepare('SELECT * FROM conversaciones ORDER BY id ASC').all();
  if (conversaciones.length > 0) {
    const valores = conversaciones.map((c) => {
      const ultimo = c.ultimo_mensaje_entrante_en ? `${escaparSql(c.ultimo_mensaje_entrante_en)}::timestamptz` : 'NULL';
      return `(${c.id}, ${c.contacto_id}, ${escaparSql(c.canal)}, ${escaparSql(c.id_cuenta_zernio)}, ${escaparSql(c.id_conversacion_zernio)}, ${ultimo}, ${escaparSql(c.estado)}, ${escaparSql(c.creado_en)}::timestamptz, ${escaparSql(c.actualizado_en)}::timestamptz)`;
    });
    lotes.push(`
      INSERT INTO "CRM_Opticas".conversaciones (id, contacto_id, canal, id_cuenta_zernio, id_conversacion_zernio, ultimo_mensaje_entrante_en, estado, creado_en, actualizado_en)
      OVERRIDING SYSTEM VALUE
      VALUES ${valores.join(',\n')}
      ON CONFLICT (id) DO NOTHING;
      SELECT setval(pg_get_serial_sequence('"CRM_Opticas".conversaciones', 'id'), COALESCE((SELECT MAX(id) FROM "CRM_Opticas".conversaciones), 1));
    `);
  }

  // 4. Mensajes (en lotes de 250 para no saturar memoria)
  const mensajes = base_datos.prepare('SELECT * FROM mensajes ORDER BY id ASC').all();
  const TAMANO_LOTE = 250;
  for (let i = 0; i < mensajes.length; i += TAMANO_LOTE) {
    const grupo = mensajes.slice(i, i + TAMANO_LOTE);
    const valores = grupo.map((m) => {
      return `(${m.id}, ${m.conversacion_id}, ${escaparSql(m.id_mensaje_plataforma)}, ${escaparSql(m.id_mensaje_zernio)}, ${escaparSql(m.direccion)}, ${escaparSql(m.texto)}, ${escaparSql(m.tipo_contenido)}, ${escaparSql(m.url_adjunto)}, ${escaparSql(m.estado_entrega)}, ${escaparSql(m.atribucion_anuncio)}, ${escaparSql(m.creado_en)}::timestamptz)`;
    });
    const resetSeq = (i + TAMANO_LOTE >= mensajes.length)
      ? `SELECT setval(pg_get_serial_sequence('"CRM_Opticas".mensajes', 'id'), COALESCE((SELECT MAX(id) FROM "CRM_Opticas".mensajes), 1));`
      : '';
    lotes.push(`
      INSERT INTO "CRM_Opticas".mensajes (id, conversacion_id, id_mensaje_plataforma, id_mensaje_zernio, direccion, texto, tipo_contenido, url_adjunto, estado_entrega, atribucion_anuncio, creado_en)
      OVERRIDING SYSTEM VALUE
      VALUES ${valores.join(',\n')}
      ON CONFLICT (id) DO NOTHING;
      ${resetSeq}
    `);
  }

  // 5. Fórmulas Ópticas
  const formulas = base_datos.prepare('SELECT * FROM formulas_opticas ORDER BY id ASC').all();
  if (formulas.length > 0) {
    const valores = formulas.map((f) => {
      return `(${f.id}, ${f.contacto_id}, ${escaparSql(f.od_esfera)}, ${escaparSql(f.od_cilindro)}, ${escaparSql(f.od_eje)}, ${escaparSql(f.od_adicion)}, ${escaparSql(f.od_agudeza_visual)}, ${escaparSql(f.oi_esfera)}, ${escaparSql(f.oi_cilindro)}, ${escaparSql(f.oi_eje)}, ${escaparSql(f.oi_adicion)}, ${escaparSql(f.oi_agudeza_visual)}, ${escaparSql(f.distancia_pupilar)}, ${escaparSql(f.tipo_lente)}, ${escaparSql(f.observaciones)}, ${escaparSql(f.optometra)}, ${escaparSql(f.fecha_examen)}, ${escaparSql(f.proximo_control)}, ${escaparSql(f.creado_en)}::timestamptz)`;
    });
    lotes.push(`
      INSERT INTO "CRM_Opticas".formulas_opticas (id, contacto_id, od_esfera, od_cilindro, od_eje, od_adicion, od_agudeza_visual, oi_esfera, oi_cilindro, oi_eje, oi_adicion, oi_agudeza_visual, distancia_pupilar, tipo_lente, observaciones, optometra, fecha_examen, proximo_control, creado_en)
      OVERRIDING SYSTEM VALUE
      VALUES ${valores.join(',\n')}
      ON CONFLICT (id) DO NOTHING;
      SELECT setval(pg_get_serial_sequence('"CRM_Opticas".formulas_opticas', 'id'), COALESCE((SELECT MAX(id) FROM "CRM_Opticas".formulas_opticas), 1));
    `);
  }

  // 6. Citas
  const citas = base_datos.prepare('SELECT * FROM citas ORDER BY id ASC').all();
  if (citas.length > 0) {
    const valores = citas.map((c) => {
      return `(${c.id}, ${c.contacto_id}, ${escaparSql(c.fecha_cita)}, ${escaparSql(c.hora_cita)}, ${escaparSql(c.motivo)}, ${escaparSql(c.especialista)}, ${escaparSql(c.observaciones)}, ${escaparSql(c.estado)}, ${escaparSql(c.creado_en)}::timestamptz)`;
    });
    lotes.push(`
      INSERT INTO "CRM_Opticas".citas (id, contacto_id, fecha_cita, hora_cita, motivo, especialista, observaciones, estado, creado_en)
      OVERRIDING SYSTEM VALUE
      VALUES ${valores.join(',\n')}
      ON CONFLICT (id) DO NOTHING;
      SELECT setval(pg_get_serial_sequence('"CRM_Opticas".citas', 'id'), COALESCE((SELECT MAX(id) FROM "CRM_Opticas".citas), 1));
    `);
  }

  const carpetaSalida = path.resolve('datos/migracion_supabase');
  if (!fs.existsSync(carpetaSalida)) fs.mkdirSync(carpetaSalida, { recursive: true });

  fs.writeFileSync(path.join(carpetaSalida, 'lotes.json'), JSON.stringify(lotes, null, 2), 'utf8');
  console.log(`Generados ${lotes.length} lotes de inserción SQL en ${carpetaSalida}`);
}

generarInserts();
