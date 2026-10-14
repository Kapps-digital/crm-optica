import crypto from 'node:crypto';
import { base_datos } from '../base_datos/conexion.mjs';
import { ClienteZernio } from './cliente_zernio.mjs';

const cliente_zernio = new ClienteZernio();

/**
 * Gestor de Mensajería Omnicanal para el CRM de Óptica.
 * Aplica reglas estrictas de la ventana de 24 horas y persistencia en Supabase.
 */

/**
 * Determina si una conversación se encuentra dentro de la ventana de 24 horas de WhatsApp.
 */
export function esta_en_ventana_24_horas(ultimo_mensaje_entrante_en) {
  if (!ultimo_mensaje_entrante_en) return false;

  const fecha_ultimo = new Date(ultimo_mensaje_entrante_en).getTime();
  if (isNaN(fecha_ultimo)) return false;

  const ahora = Date.now();
  const diferencia_horas = (ahora - fecha_ultimo) / (1000 * 60 * 60);

  return diferencia_horas < 24;
}

/**
 * Envía un mensaje respetando las políticas de canal y registra el mensaje en Supabase.
 */
export async function enviar_mensaje({
  conversacion_id,
  id_conversacion_zernio,
  canal = 'whatsapp',
  destinatario,
  texto,
  nombre_plantilla,
  idioma_plantilla = 'es',
  parametros_plantilla = [],
  componentes_plantilla = [],
}) {
  try {
    let conv = null;
    let id_num = conversacion_id != null ? Number(conversacion_id) : null;
    if (id_num !== null && (isNaN(id_num) || id_num <= 0)) {
      id_num = null;
    }

    if (id_num) {
      conv = await base_datos.prepare('SELECT * FROM conversaciones WHERE id = ?').get(id_num);
      if (conv) {
        id_conversacion_zernio = conv.id_conversacion_zernio;
        canal = conv.canal;
      }
    }

    // 1. Control de la ventana de 24 horas
    const dentro_de_ventana = conv ? esta_en_ventana_24_horas(conv.ultimo_mensaje_entrante_en) : false;
    const es_whatsapp = canal === 'whatsapp';

    if (es_whatsapp && !dentro_de_ventana && !nombre_plantilla) {
      return {
        exito: false,
        error: {
          codigo: 'VENTANA_24H_EXPIRADA',
          mensaje: 'La ventana de atención de 24 horas de WhatsApp ha expirado o el hilo es nuevo. Es obligatorio enviar una plantilla aprobada.',
        },
      };
    }

    // 2. Clave de idempotencia única para este intento
    const clave_idempotencia = crypto.randomUUID();

    let resultado_envio;

    const id_cuenta = conv?.id_cuenta_zernio || process.env.ZERNIO_ACCOUNT_ID || '6ab6a5ade55ed05c5f3a902b';

    // 3. Caso A: Enviar dentro de un hilo existente en Zernio
    if (id_conversacion_zernio) {
      const ruta = `/inbox/conversations/${id_conversacion_zernio}/messages?accountId=${encodeURIComponent(id_cuenta)}`;
      const cuerpo_peticion = {
        accountId: id_cuenta,
      };

      if (dentro_de_ventana || !es_whatsapp) {
        cuerpo_peticion.message = texto;
        if (!dentro_de_ventana && (canal === 'instagram' || canal === 'messenger')) {
          cuerpo_peticion.messageTag = 'HUMAN_AGENT';
          cuerpo_peticion.messagingType = 'MESSAGE_TAG';
        }
      } else {
        const componentes = componentes_plantilla.length > 0
          ? componentes_plantilla
          : (parametros_plantilla.length > 0
              ? [{ type: 'body', parameters: parametros_plantilla.map((param) => ({ type: 'text', text: String(param) })) }]
              : []);

        cuerpo_peticion.template = {
          name: nombre_plantilla,
          language: idioma_plantilla || 'es',
          ...(componentes.length > 0 ? { components: componentes } : {}),
          elements: [
            {
              name: nombre_plantilla,
              language: idioma_plantilla || 'es',
              ...(componentes.length > 0 ? { components: componentes } : {}),
            },
          ],
        };
      }

      resultado_envio = await cliente_zernio.solicitar(ruta, {
        metodo: 'POST',
        cuerpo: cuerpo_peticion,
        clave_idempotencia,
      });
    } else {
      // 4. Caso B: Abrir un hilo nuevo (requiere plantilla en WhatsApp)
      if (!destinatario && !conv) {
        return {
          exito: false,
          error: {
            codigo: 'DESTINATARIO_FALTANTE',
            mensaje: 'No se especificó un destinatario ni una conversación válida.',
          },
        };
      }

      const ruta = `/inbox/conversations?accountId=${encodeURIComponent(id_cuenta)}`;
      const cuerpo_peticion = {
        accountId: id_cuenta,
        channel: canal,
        recipient: destinatario,
      };

      if (nombre_plantilla) {
        cuerpo_peticion.templateName = nombre_plantilla;
        cuerpo_peticion.templateLanguage = idioma_plantilla;
        cuerpo_peticion.templateParams = parametros_plantilla;
      } else {
        cuerpo_peticion.message = texto;
      }

      resultado_envio = await cliente_zernio.solicitar(ruta, {
        metodo: 'POST',
        cuerpo: cuerpo_peticion,
        clave_idempotencia,
      });
    }

    if (!resultado_envio.exito) {
      return { exito: false, error: resultado_envio.error };
    }

    // 5. Extraer ID de respuesta devuelto por Zernio
    const datos_respuesta = resultado_envio.datos?.data || resultado_envio.datos || {};
    const id_mensaje_zernio = datos_respuesta.messageId || datos_respuesta.id || datos_respuesta.messageIds?.[0] || `crm_envio_${Date.now()}`;
    const id_conv_retornada = datos_respuesta.conversationId || id_conversacion_zernio;

    // 6. Persistir el mensaje en la base de datos Supabase
    let conv_final_id = id_num;
    if (!conv_final_id && id_conv_retornada) {
      const consulta_conv = await base_datos.prepare('SELECT id FROM conversaciones WHERE id_conversacion_zernio = ?').get(id_conv_retornada);
      if (consulta_conv) {
        conv_final_id = Number(consulta_conv.id);
      }
    }

    if (conv_final_id) {
      const insercion = await base_datos.prepare(`
        INSERT INTO mensajes (
          conversacion_id, id_mensaje_plataforma, id_mensaje_zernio, direccion, texto, tipo_contenido, estado_entrega, creado_en
        ) VALUES (?, ?, ?, 'saliente', ?, ?, 'enviado', now())
        ON CONFLICT (id_mensaje_plataforma) DO UPDATE SET
          estado_entrega = EXCLUDED.estado_entrega,
          texto = EXCLUDED.texto,
          tipo_contenido = EXCLUDED.tipo_contenido
      `).run(
        conv_final_id,
        id_mensaje_zernio,
        id_mensaje_zernio,
        texto || `[Plantilla: ${nombre_plantilla}]`,
        nombre_plantilla ? 'plantilla' : 'texto'
      );

      // Actualizar fecha de la conversación y marcar como leída al enviar respuesta
      await base_datos.prepare(`
        UPDATE conversaciones 
        SET actualizado_en = now(),
            mensajes_no_leidos = 0,
            ultimo_leido_en = now()
        WHERE id = ?
      `).run(conv_final_id);

      const idInsertado = insercion?.lastInsertRowid;
      const mensaje_guardado = idInsertado
        ? await base_datos.prepare('SELECT * FROM mensajes WHERE id = ?').get(idInsertado)
        : null;

      return {
        exito: true,
        mensaje_id: idInsertado ? Number(idInsertado) : undefined,
        id_mensaje_zernio,
        id_conversacion_zernio: id_conv_retornada,
        mensaje: mensaje_guardado,
      };
    }

    return {
      exito: true,
      id_mensaje_zernio,
      id_conversacion_zernio: id_conv_retornada,
    };
  } catch (error) {
    console.error('❌ Error capturado en enviar_mensaje:', error);
    return {
      exito: false,
      error: {
        codigo: 'ERROR_INTERNO_ENVIO',
        mensaje: error.message || 'Error interno al procesar el mensaje.',
      },
    };
  }
}
