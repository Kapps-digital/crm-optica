import { ClienteZernio } from './cliente_zernio.mjs';
import { base_datos } from '../base_datos/conexion.mjs';
import { obtener_o_crear_contacto } from './procesador_eventos.mjs';

/**
 * Servicio de sincronización bidireccional entre la API de Zernio y la base de datos Supabase Postgres.
 * Permite traer todas las conversaciones y mensajes históricos de los números que han escrito al WhatsApp.
 */

/**
 * Normaliza un número de teléfono para asegurar consistencia (+57...)
 */
function normalizar_telefono_o_bsuid(valor_participante, nombre_usuario) {
  const candidato = (nombre_usuario || valor_participante || '').trim();

  // Si tiene formato de BSUID (por ejemplo CO.2759736461095651)
  if (candidato.startsWith('CO.') || /^[a-zA-Z]/.test(candidato)) {
    return { telefono: null, bsuid: candidato };
  }

  // Limpiar caracteres no numéricos
  const solo_numeros = candidato.replace(/\D/g, '');
  if (solo_numeros.length >= 7) {
    const telefono_formateado = candidato.startsWith('+') ? candidato : `+${solo_numeros}`;
    return { telefono: telefono_formateado, bsuid: null };
  }

  return { telefono: candidato || null, bsuid: null };
}

/**
 * Convierte una fecha ISO (Zernio) al formato datetime estándar (YYYY-MM-DD HH:MM:SS)
 */
function formatear_fecha(fecha_iso) {
  if (!fecha_iso) return new Date().toISOString();
  try {
    const d = new Date(fecha_iso);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Sincroniza los mensajes de una conversación individual desde Zernio hacia Supabase.
 */
export async function sincronizar_mensajes_conversacion(id_conversacion_zernio, id_cuenta_zernio, id_conversacion_local) {
  const cliente = new ClienteZernio();
  const ruta = `/inbox/conversations/${id_conversacion_zernio}/messages?accountId=${encodeURIComponent(id_cuenta_zernio)}&sortOrder=desc&limit=50`;

  const respuesta = await cliente.solicitar(ruta);
  if (!respuesta.exito || !respuesta.datos) {
    return { exito: false, mensajes_insertados: 0 };
  }

  let lista_mensajes = [];
  if (Array.isArray(respuesta.datos.data)) {
    lista_mensajes = respuesta.datos.data;
  } else if (Array.isArray(respuesta.datos)) {
    lista_mensajes = respuesta.datos;
  } else if (Array.isArray(respuesta.datos.messages)) {
    lista_mensajes = respuesta.datos.messages;
  }

  const sentencia_insertar = base_datos.prepare(`
    INSERT INTO mensajes (
      conversacion_id, id_mensaje_plataforma, id_mensaje_zernio, direccion,
      texto, tipo_contenido, url_adjunto, estado_entrega, creado_en, reacciones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
    ON CONFLICT (id_mensaje_plataforma) DO UPDATE 
    SET reacciones = COALESCE(EXCLUDED.reacciones, mensajes.reacciones),
        estado_entrega = EXCLUDED.estado_entrega,
        url_adjunto = COALESCE(mensajes.url_adjunto, EXCLUDED.url_adjunto),
        tipo_contenido = CASE WHEN (mensajes.tipo_contenido IS NULL OR mensajes.tipo_contenido = 'texto' OR mensajes.tipo_contenido = 'adjunto') AND EXCLUDED.tipo_contenido NOT IN ('texto', 'adjunto') THEN EXCLUDED.tipo_contenido ELSE COALESCE(mensajes.tipo_contenido, EXCLUDED.tipo_contenido) END,
        texto = CASE WHEN (mensajes.texto IS NULL OR mensajes.texto = '' OR mensajes.texto = '[Unsupported message]') AND EXCLUDED.texto != '' THEN EXCLUDED.texto ELSE mensajes.texto END
  `);

  let insertados = 0;
  let ultimo_entrante_fecha = null;

  let entrantes_insertados = 0;

  for (const m of lista_mensajes) {
    const id_plataforma = m.id || m.platformMessageId;
    const direccion = m.direction === 'outgoing' ? 'saliente' : 'entrante';
    const texto = m.message || m.text || '';
    const url_raw = m.attachments?.[0]?.url || m.mediaUrl || null;
    const url_adjunto = url_raw ? (url_raw.startsWith('http') ? url_raw : `https://zernio.com${url_raw.startsWith('/') ? '' : '/'}${url_raw}`) : null;
    const tipo_adjunto = m.attachments?.[0]?.type;
    const tipo_contenido = tipo_adjunto || m.type || (url_adjunto ? 'adjunto' : 'texto');
    const estado_entrega = m.deliveryStatus || (direccion === 'saliente' ? 'enviado' : 'recibido');
    const creado_en = formatear_fecha(m.createdAt || m.sentAt);

    const reacciones_array = Array.isArray(m.reactions) ? m.reactions.map(r => ({
      emoji: r.emoji,
      de_mi: !!r.fromMe,
      reaccionado_en: r.reactedAt || null
    })) : [];
    const reacciones_json = JSON.stringify(reacciones_array);

    try {
      const res = await sentencia_insertar.run(
        id_conversacion_local,
        id_plataforma,
        m.id || null,
        direccion,
        texto,
        tipo_contenido,
        url_adjunto,
        estado_entrega,
        creado_en,
        reacciones_json
      );
      if (res.changes > 0) {
        insertados++;
        if (direccion === 'entrante') {
          entrantes_insertados++;
        }
      }

      // Si el mensaje ya existía y trae reacciones o adjunto, asegurar actualización de columnas
      if (reacciones_array.length > 0 || url_adjunto) {
        await base_datos.prepare(`
          UPDATE mensajes 
          SET reacciones = CASE WHEN ? != '[]' THEN ?::jsonb ELSE reacciones END,
              url_adjunto = COALESCE(url_adjunto, ?),
              tipo_contenido = CASE WHEN (tipo_contenido IS NULL OR tipo_contenido = 'texto') AND ? != 'texto' THEN ? ELSE tipo_contenido END
          WHERE (id_mensaje_plataforma = ? OR (id_mensaje_zernio IS NOT NULL AND id_mensaje_zernio = ?))
        `).run(reacciones_json, reacciones_json, url_adjunto, tipo_contenido, tipo_contenido, id_plataforma, m.id || null);
      }
    } catch {
      // Ignorar errores de clave única
    }

    if (direccion === 'entrante') {
      if (!ultimo_entrante_fecha || new Date(creado_en) > new Date(ultimo_entrante_fecha)) {
        ultimo_entrante_fecha = creado_en;
      }
    }
  }

  // Eliminar mensajes de previsualización temporales si ya existen mensajes reales
  await base_datos.prepare(`
    DELETE FROM mensajes 
    WHERE conversacion_id = ? 
      AND id_mensaje_plataforma LIKE 'preview_%'
      AND EXISTS (
        SELECT 1 FROM mensajes m2 
        WHERE m2.conversacion_id = ? AND m2.id_mensaje_plataforma NOT LIKE 'preview_%'
      )
  `).run(id_conversacion_local, id_conversacion_local);

  // Actualizar la fecha del último mensaje entrante y actualizado_en para que suba al tope
  if (ultimo_entrante_fecha) {
    await base_datos.prepare(`
      UPDATE conversaciones 
      SET ultimo_mensaje_entrante_en = ?,
          actualizado_en = now()
      WHERE id = ? AND (ultimo_mensaje_entrante_en IS NULL OR ultimo_mensaje_entrante_en < ?::timestamptz)
    `).run(ultimo_entrante_fecha, id_conversacion_local, ultimo_entrante_fecha);
  }

  return { exito: true, mensajes_insertados: insertados };
}

/**
 * Sincroniza todas las conversaciones de Zernio hacia Supabase.
 * Trae los números, nombres de contactos, últimos mensajes y opcionalmente su historial.
 */
export async function sincronizar_conversaciones_zernio({ sincronizar_mensajes_profundo = true, max_conversaciones_mensajes = 15 } = {}) {
  const cliente = new ClienteZernio();

  const respuesta = await cliente.solicitar('/inbox/conversations');

  if (!respuesta.exito || !respuesta.datos) {
    console.error('❌ Error al consultar conversaciones en Zernio:', respuesta.error);
    return { exito: false, error: respuesta.error };
  }

  let conversaciones_remotas = [];
  if (Array.isArray(respuesta.datos.data)) {
    conversaciones_remotas = respuesta.datos.data;
  } else if (Array.isArray(respuesta.datos)) {
    conversaciones_remotas = respuesta.datos;
  }

  let total_sincronizadas = 0;
  let total_mensajes_sincronizados = 0;

  for (let i = 0; i < conversaciones_remotas.length; i++) {
    const conv = conversaciones_remotas[i];
    const id_conv_zernio = conv.id;
    const id_cuenta = conv.accountId || process.env.ZERNIO_ACCOUNT_ID || '';
    const canal = conv.platform || 'whatsapp';

    const { telefono, bsuid } = normalizar_telefono_o_bsuid(conv.participantId, conv.participantUsername);
    let nombre = (conv.participantName || '').trim();
    if (!nombre || nombre === conv.participantId || nombre === conv.participantUsername) {
      nombre = telefono ? `Contacto ${telefono}` : 'Paciente WhatsApp';
    }

    // 1. Obtener o crear el contacto en Supabase
    const contacto_id = await obtener_o_crear_contacto({
      nombre,
      telefono,
      bsuid,
    });

    // 2. Obtener o crear la conversación en Supabase
    const fecha_actualizado = formatear_fecha(conv.updatedTime);
    const no_leidos = Number(conv.unreadCount || conv.unread_count || 0);
    let conv_existente = await base_datos.prepare('SELECT id, ultimo_leido_en, ultimo_mensaje_entrante_en, mensajes_no_leidos FROM conversaciones WHERE id_conversacion_zernio = ?').get(id_conv_zernio);
    let conversacion_id = null;

    if (conv_existente) {
      conversacion_id = conv_existente.id;
      const fechaEntrante = conv_existente.ultimo_mensaje_entrante_en ? new Date(conv_existente.ultimo_mensaje_entrante_en).getTime() : 0;
      const fechaLeido = conv_existente.ultimo_leido_en ? new Date(conv_existente.ultimo_leido_en).getTime() : 0;
      const ya_leido_en_crm = fechaLeido > 0 && fechaLeido >= fechaEntrante;

      // Preservar los no leídos acumulados en el CRM (evitar que la API de Zernio los ponga en 0)
      let conteo_final_no_leidos = Number(conv_existente.mensajes_no_leidos || 0);
      if (ya_leido_en_crm) {
        conteo_final_no_leidos = 0;
      } else {
        conteo_final_no_leidos = Math.max(conteo_final_no_leidos, no_leidos);
      }

      await base_datos.prepare(`
        UPDATE conversaciones 
        SET actualizado_en = ?, estado = ?, mensajes_no_leidos = ?
        WHERE id = ?
      `).run(fecha_actualizado, conv.status || 'abierta', conteo_final_no_leidos, conversacion_id);
    } else {
      const insercion = await base_datos.prepare(`
        INSERT INTO conversaciones (
          contacto_id, canal, id_cuenta_zernio, id_conversacion_zernio,
          ultimo_mensaje_entrante_en, estado, creado_en, actualizado_en, mensajes_no_leidos
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        contacto_id,
        canal,
        id_cuenta,
        id_conv_zernio,
        null,
        conv.status || 'abierta',
        fecha_actualizado,
        fecha_actualizado,
        no_leidos
      );
      conversacion_id = Number(insercion.lastInsertRowid);
    }

    total_sincronizadas++;

    // 3. Si tiene último mensaje y ningún mensaje registrado, insertar placeholder temporal
    if (conv.lastMessage) {
      const tiene_mensajes = await base_datos.prepare('SELECT 1 FROM mensajes WHERE conversacion_id = ? LIMIT 1').get(conversacion_id);
      if (!tiene_mensajes) {
        const id_msg_placeholder = `preview_${id_conv_zernio}`;
        await base_datos.prepare(`
          INSERT INTO mensajes (
            conversacion_id, id_mensaje_plataforma, direccion, texto, tipo_contenido, estado_entrega, creado_en
          ) VALUES (?, ?, 'entrante', ?, 'texto', 'recibido', ?)
          ON CONFLICT (id_mensaje_plataforma) DO NOTHING
        `).run(conversacion_id, id_msg_placeholder, conv.lastMessage, fecha_actualizado);
      }
    }

    // 4. Sincronización profunda de mensajes para los primeros chats más recientes
    if (sincronizar_mensajes_profundo && i < max_conversaciones_mensajes) {
      const res_msg = await sincronizar_mensajes_conversacion(id_conv_zernio, id_cuenta, conversacion_id);
      total_mensajes_sincronizados += res_msg.mensajes_insertados || 0;
    }
  }

  if (total_mensajes_sincronizados > 0) {
    console.log(`📥 Zernio: ${total_mensajes_sincronizados} mensajes nuevos sincronizados al CRM.`);
  }

  return {
    exito: true,
    total_conversaciones: total_sincronizadas,
    total_mensajes: total_mensajes_sincronizados,
  };
}
