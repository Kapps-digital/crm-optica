import { base_datos } from '../base_datos/conexion.mjs';
import { sincronizar_mensajes_conversacion } from './sincronizador_zernio.mjs';

/**
 * Normaliza y procesa los eventos entrantes del webhook de Zernio.
 * Aplica las reglas de arquitectura para evitar duplicados y desorden en Supabase.
 */

/**
 * Extrae y normaliza un contacto a partir de los datos del remitente.
 * Resuelve la regla de WhatsApp donde el teléfono puede ser nulo (BSUID).
 */
export async function obtener_o_crear_contacto({ nombre, telefono, bsuid, correo }) {
  // 1. Si viene BSUID, buscar primero por BSUID
  if (bsuid) {
    const consulta_bsuid = base_datos.prepare('SELECT * FROM contactos WHERE business_scoped_user_id = ?');
    const contacto_existente = await consulta_bsuid.get(bsuid);
    if (contacto_existente) {
      if (nombre && !contacto_existente.nombre_completo) {
        await base_datos.prepare("UPDATE contactos SET nombre_completo = ?, actualizado_en = now() WHERE id = ?").run(nombre, contacto_existente.id);
      }
      return contacto_existente.id;
    }
  }

  // 2. Si viene teléfono, buscar por teléfono
  if (telefono) {
    const consulta_telefono = base_datos.prepare('SELECT * FROM contactos WHERE telefono = ?');
    const contacto_existente = await consulta_telefono.get(telefono);
    if (contacto_existente) {
      if (bsuid && !contacto_existente.business_scoped_user_id) {
        await base_datos.prepare("UPDATE contactos SET business_scoped_user_id = ?, actualizado_en = now() WHERE id = ?").run(bsuid, contacto_existente.id);
      }
      return contacto_existente.id;
    }
  }

  // 3. Crear nuevo contacto
  const insercion = await base_datos.prepare(`
    INSERT INTO contactos (nombre_completo, telefono, correo, business_scoped_user_id)
    VALUES (?, ?, ?, ?)
  `).run(nombre || 'Paciente Sin Nombre', telefono || null, correo || null, bsuid || null);

  return Number(insercion.lastInsertRowid);
}

/**
 * Obtiene o crea la conversación correspondiente.
 * Recuerda: La conversación no es el contacto; un mismo contacto puede tener chats distintos por canal.
 */
export async function obtener_o_crear_conversacion({ contacto_id, canal, id_cuenta_zernio, id_conversacion_zernio, es_entrante = false, fecha_mensaje = null }) {
  const consulta = base_datos.prepare('SELECT * FROM conversaciones WHERE id_conversacion_zernio = ?');
  let conversacion = await consulta.get(id_conversacion_zernio);

  const fecha_efectiva = fecha_mensaje ? new Date(fecha_mensaje).toISOString() : new Date().toISOString();

  if (conversacion) {
    if (es_entrante) {
      await base_datos.prepare(`
        UPDATE conversaciones 
        SET ultimo_mensaje_entrante_en = ?, 
            actualizado_en = now(),
            mensajes_no_leidos = COALESCE(mensajes_no_leidos, 0) + 1
        WHERE id = ?
      `).run(fecha_efectiva, conversacion.id);
    }
    return conversacion.id;
  }

  const insercion = await base_datos.prepare(`
    INSERT INTO conversaciones (
      contacto_id, canal, id_cuenta_zernio, id_conversacion_zernio, ultimo_mensaje_entrante_en, mensajes_no_leidos
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    contacto_id,
    canal || 'whatsapp',
    id_cuenta_zernio || '',
    id_conversacion_zernio,
    es_entrante ? fecha_efectiva : null,
    es_entrante ? 1 : 0
  );

  return Number(insercion.lastInsertRowid);
}

/**
 * Procesa un evento individual despachado por el webhook.
 */
export async function procesar_evento_webhook(payload) {
  const tipo_evento = payload.event;
  const mensaje_datos = payload.message;
  const conversacion_datos = payload.conversation;
  const cuenta_datos = payload.account;

  const id_cuenta = cuenta_datos?.id || cuenta_datos?._id || process.env.ZERNIO_ACCOUNT_ID || '';
  const canal = cuenta_datos?.platform || conversacion_datos?.channel || 'whatsapp';

  switch (tipo_evento) {
    case 'message.received': {
      if (!mensaje_datos) break;

      const remitente = mensaje_datos.sender || {};
      const telefono = remitente.phone || remitente.phoneNumber;
      const bsuid = remitente.businessScopedUserId || remitente.id;
      const nombre = remitente.name || remitente.username;

      const contacto_id = await obtener_o_crear_contacto({
        nombre,
        telefono,
        bsuid,
      });

      let fecha_mensaje = null;
      const raw_fecha = mensaje_datos.timestamp || mensaje_datos.sentAt || mensaje_datos.createdAt || payload.timestamp;
      if (raw_fecha) {
        if (typeof raw_fecha === 'number') {
          fecha_mensaje = raw_fecha < 10000000000 ? new Date(raw_fecha * 1000).toISOString() : new Date(raw_fecha).toISOString();
        } else {
          fecha_mensaje = new Date(raw_fecha).toISOString();
        }
      }

      const id_conv_zernio = conversacion_datos?.id || conversacion_datos?._id || mensaje_datos.conversationId;
      const conversacion_id = await obtener_o_crear_conversacion({
        contacto_id,
        canal,
        id_cuenta_zernio: id_cuenta,
        id_conversacion_zernio: id_conv_zernio,
        es_entrante: true,
        fecha_mensaje,
      });

      // Extraer metadatos de atribución (CTWA / Meta Ads)
      const metadatos = mensaje_datos.metadata || payload.metadata || {};
      const atribucion = {};
      for (const [clave, valor] of Object.entries(metadatos)) {
        if (clave.startsWith('ctwa_') || clave.startsWith('meta_ad_')) {
          atribucion[clave] = valor;
        }
      }

      const id_plataforma = mensaje_datos.platformMessageId || mensaje_datos.id;
      const texto = mensaje_datos.text || mensaje_datos.message || '';
      const url_adjunto = mensaje_datos.attachments?.[0]?.url || mensaje_datos.mediaUrl || null;
      const tipo_contenido = mensaje_datos.type || (url_adjunto ? 'adjunto' : 'texto');

      // Inserción con deduplicación por ID de plataforma
      try {
        await base_datos.prepare(`
          INSERT INTO mensajes (
            conversacion_id, id_mensaje_plataforma, id_mensaje_zernio, direccion,
            texto, tipo_contenido, url_adjunto, estado_entrega, atribucion_anuncio, creado_en
          ) VALUES (?, ?, ?, 'entrante', ?, ?, ?, 'recibido', ?, COALESCE(?::timestamptz, now()))
          ON CONFLICT (id_mensaje_plataforma) DO NOTHING
        `).run(
          conversacion_id,
          id_plataforma,
          mensaje_datos.id || null,
          texto,
          tipo_contenido,
          url_adjunto,
          Object.keys(atribucion).length > 0 ? JSON.stringify(atribucion) : null,
          fecha_mensaje
        );
      } catch (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('UNIQUE constraint')) {
          // Mensaje ya registrado previamente; se ignora de forma segura
          break;
        }
        throw error;
      }

      // Disparar procesamiento del Agente de IA en segundo plano si es texto y no reacción
      if (texto && !texto.startsWith('[reaction') && tipo_contenido !== 'reaction') {
        const convInfo = await base_datos.prepare('SELECT optica_id, contacto_id FROM conversaciones WHERE id = ?').get(conversacion_id);
        const opticaId = convInfo?.optica_id || 1;
        import('./motor_ia.mjs')
          .then(({ procesarMensajeConIA }) => {
            procesarMensajeConIA({
              conversacion_id,
              contacto_id: convInfo?.contacto_id || contacto_id,
              optica_id: opticaId,
              texto_mensaje: texto,
            }).catch((err) => {
              console.error('[Webhook] Error en procesamiento del Agente IA:', err);
            });
          })
          .catch((err) => {
            console.error('[Webhook] No se pudo cargar motor_ia.mjs:', err);
          });
      }
      break;
    }

    case 'message.sent': {
      if (!mensaje_datos) break;

      const id_plataforma = mensaje_datos.platformMessageId || mensaje_datos.id;
      const id_zernio = mensaje_datos.id || mensaje_datos._id;
      const texto = mensaje_datos.text || mensaje_datos.message || '';

      // Regla de deduplicación del eco:
      // Si ya existe un mensaje saliente con este id_mensaje_zernio o id_mensaje_plataforma, actualizar
      if (id_zernio) {
        const existente = await base_datos.prepare('SELECT id FROM mensajes WHERE id_mensaje_zernio = ? OR id_mensaje_plataforma = ?').get(id_zernio, id_plataforma);
        if (existente) {
          await base_datos.prepare("UPDATE mensajes SET estado_entrega = 'enviado', id_mensaje_plataforma = coalesce(id_mensaje_plataforma, ?) WHERE id = ?").run(id_plataforma, existente.id);
          break;
        }
      }

      // Red de seguridad: Adopción de mensaje saliente reciente (< 2 min) con el mismo texto y sin ID externo
      const mensaje_huerfano = await base_datos.prepare(`
        SELECT id FROM mensajes 
        WHERE direccion = 'saliente' 
          AND texto = ? 
          AND id_mensaje_plataforma IS NULL 
          AND creado_en >= (now() - interval '2 minutes')
        ORDER BY id DESC LIMIT 1
      `).get(texto);

      if (mensaje_huerfano) {
        await base_datos.prepare(`
          UPDATE mensajes 
          SET id_mensaje_plataforma = ?, id_mensaje_zernio = ?, estado_entrega = 'enviado' 
          WHERE id = ?
        `).run(id_plataforma, id_zernio, mensaje_huerfano.id);
        break;
      }

      // Si no existe, proviene de la app WhatsApp Business móvil (modo coexistencia)
      const id_conv_zernio = conversacion_datos?.id || conversacion_datos?._id || mensaje_datos.conversationId;
      if (id_conv_zernio) {
        let conv = await base_datos.prepare('SELECT id FROM conversaciones WHERE id_conversacion_zernio = ?').get(id_conv_zernio);
        if (conv) {
          await base_datos.prepare(`
            INSERT INTO mensajes (
              conversacion_id, id_mensaje_plataforma, id_mensaje_zernio, direccion,
              texto, tipo_contenido, estado_entrega
            ) VALUES (?, ?, ?, 'saliente', ?, 'texto', 'enviado')
            ON CONFLICT (id_mensaje_plataforma) DO NOTHING
          `).run(conv.id, id_plataforma, id_zernio, texto);

          if (texto === '[reaction]' || texto.startsWith('[reaction')) {
            setImmediate(async () => {
              try {
                await sincronizar_mensajes_conversacion(id_conv_zernio, id_cuenta, conv.id);
              } catch (e) {
                console.warn('Sync reacción saliente:', e.message);
              }
            });
          }
        }
      }
      break;
    }

    case 'message.delivered': {
      if (!mensaje_datos) break;
      const id_plataforma = mensaje_datos.platformMessageId || mensaje_datos.id;
      const id_zernio = mensaje_datos.id || mensaje_datos._id || mensaje_datos.messageId;
      await base_datos.prepare(`
        UPDATE mensajes SET estado_entrega = 'entregado' 
        WHERE id_mensaje_plataforma = ? OR (id_mensaje_zernio IS NOT NULL AND id_mensaje_zernio = ?)
      `).run(id_plataforma, id_zernio);
      break;
    }

    case 'message.read': {
      if (!mensaje_datos) break;
      const id_plataforma = mensaje_datos.platformMessageId || mensaje_datos.id;
      const id_zernio = mensaje_datos.id || mensaje_datos._id || mensaje_datos.messageId;
      await base_datos.prepare(`
        UPDATE mensajes SET estado_entrega = 'leido' 
        WHERE id_mensaje_plataforma = ? OR (id_mensaje_zernio IS NOT NULL AND id_mensaje_zernio = ?)
      `).run(id_plataforma, id_zernio);
      break;
    }

    case 'message.failed': {
      if (!mensaje_datos) break;
      const id_plataforma = mensaje_datos.platformMessageId || mensaje_datos.id;
      const id_zernio = mensaje_datos.id || mensaje_datos._id || mensaje_datos.messageId;
      await base_datos.prepare(`
        UPDATE mensajes SET estado_entrega = 'fallido' 
        WHERE id_mensaje_plataforma = ? OR (id_mensaje_zernio IS NOT NULL AND id_mensaje_zernio = ?)
      `).run(id_plataforma, id_zernio);
      break;
    }

    default:
      // Otros eventos como conversation.started, account.connected se registran en eventos_webhook
      break;
  }
}
