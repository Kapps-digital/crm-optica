import webpush from 'web-push';
import { pool } from '../base_datos/conexion.mjs';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BCx3K3gUN-0vW8EQuBm4cHfhQwjux-_05eW4OS8YRRVpeyVCHg2TRzbKO9dNudGJV6nKxMHHlkb77tS5IuwIUDc';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'LVxr0XGe2muZ4SpAIs4YqLhxK1Zr6Q9kmeMb-IlV3OY';
const VAPID_EMAIL = process.env.VAPID_SUBJECT || 'mailto:notificaciones@crmopticas.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (error) {
    console.warn('⚠️ [Push] Aviso al configurar VAPID details:', error.message);
  }
}

/**
 * Guarda o actualiza la suscripción push de un dispositivo/usuario para una óptica
 */
export async function guardarSuscripcionPush({ usuario_id, optica_id, suscripcion, user_agent = '' }) {
  if (!suscripcion || !suscripcion.endpoint || !suscripcion.keys) {
    throw new Error('Suscripción Push inválida');
  }

  const { endpoint, keys } = suscripcion;
  const p256dh = keys.p256dh || '';
  const auth = keys.auth || '';

  if (!p256dh || !auth) {
    throw new Error('Faltan claves criptográficas p256dh o auth en la suscripción');
  }

  const consulta = `
    INSERT INTO "CRM_Opticas".suscripciones_push 
      (usuario_id, optica_id, endpoint, p256dh, auth, user_agent, actualizado_en)
    VALUES 
      ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (endpoint) 
    DO UPDATE SET 
      usuario_id = EXCLUDED.usuario_id,
      optica_id = EXCLUDED.optica_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent,
      actualizado_en = NOW()
    RETURNING id;
  `;

  const res = await pool.query(consulta, [
    usuario_id || null,
    optica_id,
    endpoint,
    p256dh,
    auth,
    user_agent || null,
  ]);

  return res.rows[0];
}

/**
 * Elimina una suscripción caducada o cancelada
 */
export async function eliminarSuscripcionPush(endpoint) {
  try {
    await pool.query('DELETE FROM "CRM_Opticas".suscripciones_push WHERE endpoint = $1', [endpoint]);
  } catch (err) {
    console.error('❌ [Push] Error al eliminar suscripción push caducada:', err.message);
  }
}

/**
 * Envía una notificación push a todos los dispositivos registrados de una óptica
 */
export async function enviarNotificacionPushAOptica({
  optica_id,
  titulo,
  cuerpo,
  icono = '/icono-notificacion-192.png',
  badge = '/badge-notificacion-96.png',
  url = '/',
  etiqueta = 'alerta-asesor',
  datos = {},
  acciones = null,
}) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('⚠️ [Push] No se pueden enviar notificaciones push: claves VAPID no configuradas.');
    return { enviadas: 0, fallidas: 0 };
  }

  try {
    const res = await pool.query(
      `SELECT endpoint, p256dh, auth 
       FROM "CRM_Opticas".suscripciones_push 
       WHERE optica_id = $1`,
      [optica_id]
    );

    if (res.rows.length === 0) {
      return { enviadas: 0, fallidas: 0, motivo: 'sin_dispositivos' };
    }

    const payload = JSON.stringify({
      titulo: titulo || 'CRM Óptica',
      cuerpo: cuerpo || 'Nueva alerta de atención.',
      icono: icono || '/icono-notificacion-192.png',
      badge: badge || '/badge-notificacion-96.png',
      url: url || '/',
      tag: etiqueta || 'crm-alerta',
      datos: datos || {},
      vibrate: [100, 80, 120],
      actions: acciones || [
        { action: 'abrir_chat', title: '💬 Abrir Chat' },
        { action: 'cerrar', title: 'Descartar' },
      ],
    });

    let enviadas = 0;
    let fallidas = 0;

    await Promise.allSettled(
      res.rows.map(async (fila) => {
        const sub = {
          endpoint: fila.endpoint,
          keys: {
            p256dh: fila.p256dh,
            auth: fila.auth,
          },
        };

        try {
          await webpush.sendNotification(sub, payload, {
            urgency: 'high',
            TTL: 60 * 60 * 24, // 24 horas de vigencia en cola
          });
          enviadas++;
        } catch (error) {
          fallidas++;
          // Si el endpoint ya no existe (404 o 410 Gone), eliminarlo de la base de datos
          if (error.statusCode === 404 || error.statusCode === 410) {
            await eliminarSuscripcionPush(fila.endpoint);
          } else {
            console.error('⚠️ [Push] Error al entregar push a dispositivo:', error.message);
          }
        }
      })
    );

    return { enviadas, fallidas };
  } catch (err) {
    console.error('❌ [Push] Error general al enviar notificación a óptica:', err.message);
    return { enviadas: 0, fallidas: 0, error: err.message };
  }
}

