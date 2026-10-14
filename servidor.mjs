import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { base_datos, pool } from './base_datos/conexion.mjs';
import { ClienteZernio } from './servicios/cliente_zernio.mjs';
import { procesar_evento_webhook } from './servicios/procesador_eventos.mjs';
import { enviar_mensaje, esta_en_ventana_24_horas } from './servicios/gestor_mensajeria.mjs';
import { sincronizar_conversaciones_zernio, sincronizar_mensajes_conversacion } from './servicios/sincronizador_zernio.mjs';
import {
  obtenerSegmentosConConteo,
  obtenerPacientesDeSegmento,
  crearSegmentoPersonalizado,
  actualizarSegmentoPersonalizado,
  eliminarSegmentoPersonalizado,
} from './servicios/gestor_segmentacion.mjs';
import {
  obtenerPlantillas,
  crearPlantilla,
  sincronizarPlantillasConZernio,
  obtenerCuotaDiaria,
  calcularAudienciaLote,
  lanzarLoteCampana,
  obtenerHistorialLotes,
  eliminarLoteCampana,
  obtenerMapaPlantillasPorNombre,
} from './servicios/gestor_plantillas.mjs';
import {
  obtener_canales_optica,
  obtener_url_conexion_whatsapp,
  vincular_cuenta_whatsapp_activa,
  desconectar_canal_whatsapp,
  reconectar_canal_whatsapp,
  actualizar_datos_optica,
  subir_logo_storage_optica,
} from './servicios/gestor_canales.mjs';

const app = express();
const PUERTO = process.env.PUERTO || 3000;
const SECRETO_WEBHOOK = process.env.ZERNIO_WEBHOOK_SECRET;
const SECRETO_JWT = process.env.JWT_SECRET || 'crm_optica_secreto_super_seguro_2026';

// Middleware para capturar el cuerpo crudo en texto plano para validar la firma HMAC y admitir multimedia
app.use(
  express.json({
    limit: '25mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

// Servir archivos multimedia de plantillas de forma pública para validación en Meta / WhatsApp
const rutaArchivosPlantillas = path.join(process.cwd(), 'cliente/public/archivos_plantillas');
if (!fs.existsSync(rutaArchivosPlantillas)) {
  fs.mkdirSync(rutaArchivosPlantillas, { recursive: true });
}
app.use('/archivos_plantillas', express.static(rutaArchivosPlantillas));

// Middleware para extraer sesión y multi-inquilino a través de JWT
app.use((req, _res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.usuario = jwt.verify(token, SECRETO_JWT);
      const opticaSolicitada = req.headers['x-optica-id'] || req.query.optica_id;
      // Superadministrador ('admin') puede alternar óptica si lo solicita
      if (req.usuario.rol === 'admin' && opticaSolicitada) {
        req.optica_id = Number(opticaSolicitada);
      } else {
        req.optica_id = Number(req.usuario.optica_id) || 1;
      }
    } catch {
      req.usuario = null;
      req.optica_id = 1;
    }
  } else {
    req.usuario = null;
    req.optica_id = 1;
  }
  next();
});

// Ruta raíz informativa del backend
app.get('/', (_req, res) => {
  res.json({
    nombre: 'API CRM Óptica con Zernio',
    estado: 'activo',
    puerto_backend: PUERTO,
    frontend: 'http://localhost:3001',
    rutas_principales: [
      '/api/estado',
      '/api/conversaciones',
      '/api/contactos',
      '/api/webhook/zernio',
    ],
  });
});

/**
 * Validador criptográfico de la firma de Zernio (HMAC SHA256).
 * Regla: Comparación de tiempo constante (timingSafeEqual) sobre el texto crudo.
 */
function validar_firma_webhook(cuerpo_crudo, firma_recibida, secreto) {
  if (!secreto || !firma_recibida || typeof cuerpo_crudo !== 'string') {
    return false; // Fail-closed
  }

  const hash_esperado = crypto
    .createHmac('sha256', secreto)
    .update(cuerpo_crudo, 'utf8')
    .digest('hex');

  const buffer_esperado = Buffer.from(hash_esperado, 'utf8');
  const buffer_recibido = Buffer.from(firma_recibida, 'utf8');

  // timingSafeEqual lanza excepción si las longitudes difieren
  if (buffer_esperado.length !== buffer_recibido.length) {
    return false;
  }

  return crypto.timingSafeEqual(buffer_esperado, buffer_recibido);
}

// =========================================================================
// ENDPOINT PRINCIPAL DEL WEBHOOK DE ZERNIO
// =========================================================================
app.post('/api/webhook/zernio', async (req, res) => {
  const firma = req.headers['x-zernio-signature'];
  const cuerpo_crudo = req.rawBody || JSON.stringify(req.body);

  // 1. Verificación de firma criptográfica
  if (!validar_firma_webhook(cuerpo_crudo, firma, SECRETO_WEBHOOK)) {
    console.warn('⚠️ Webhook rechazado: Firma HMAC inválida o ausente.');
    return res.status(401).json({ error: 'Firma de webhook inválida' });
  }

  const payload = req.body;
  if (!payload || !payload.event) {
    return res.status(400).json({ error: 'Payload de webhook mal formado' });
  }

  // 2. Extraer ID del evento para deduplicación e idempotencia
  const id_evento =
    req.headers['x-zernio-event-id'] ||
    payload.id ||
    crypto.createHash('sha256').update(cuerpo_crudo).digest('hex');

  // 3. Idempotencia real en Supabase (un solo round-trip sin carreras)
  const insercion = await base_datos.prepare(`
    INSERT OR IGNORE INTO eventos_webhook (id_evento, tipo_evento, payload_json, estado)
    VALUES (?, ?, ?, 'recibido')
  `).run(id_evento, payload.event, cuerpo_crudo);

  // Si no se insertó ninguna fila, el evento ya fue recibido/procesado previamente
  if (insercion.changes === 0) {
    return res.status(200).json({ duplicado: true, mensaje: 'Evento ya registrado previamente.' });
  }

  // 4. Responder 200 OK INMEDIATAMENTE (< 5 segundos para evitar reintentos de Zernio)
  res.status(200).json({ exito: true, id_evento });

  // 5. Procesamiento en segundo plano de forma asíncrona
  setImmediate(async () => {
    try {
      await procesar_evento_webhook(payload);
      await base_datos.prepare("UPDATE eventos_webhook SET estado = 'procesado', actualizado_en = datetime('now') WHERE id_evento = ?").run(id_evento);
    } catch (error) {
      console.error(`❌ Error al procesar evento en segundo plano (${id_evento}):`, error);
      await base_datos.prepare("UPDATE eventos_webhook SET estado = 'fallido', error_mensaje = ?, actualizado_en = datetime('now') WHERE id_evento = ?").run(error.message, id_evento);
    }
  });
});

// =========================================================================
// SWEEPER DE RECUPERACIÓN (Eventos huérfanos o con caídas)
// =========================================================================
async function ejecutar_sweeper() {
  try {
    const eventos_pendientes = await base_datos.prepare(`
      SELECT id_evento, payload_json, intentos 
      FROM eventos_webhook 
      WHERE estado = 'recibido' 
        AND creado_en <= datetime('now', '-2 minutes')
        AND intentos < 5
      LIMIT 20
    `).all();

    for (const evento of eventos_pendientes) {
      try {
        const payload = typeof evento.payload_json === 'string' 
          ? JSON.parse(evento.payload_json) 
          : evento.payload_json;
        await procesar_evento_webhook(payload);
        await base_datos.prepare("UPDATE eventos_webhook SET estado = 'procesado', actualizado_en = datetime('now') WHERE id_evento = ?").run(evento.id_evento);
      } catch (error) {
        await base_datos.prepare("UPDATE eventos_webhook SET intentos = intentos + 1, error_mensaje = ?, actualizado_en = datetime('now') WHERE id_evento = ?").run(error.message, evento.id_evento);
      }
    }
  } catch (error) {
    console.error('Error en sweeper de eventos:', error.message);
  }
}

// Ejecutar el sweeper de recuperación cada 2 minutos en segundo plano
setInterval(ejecutar_sweeper, 2 * 60 * 1000);

// Polling periódico de conversaciones Zernio en segundo plano (cada 15 segundos)
let sincronizando_en_segundo_plano = false;
async function sondeo_conversaciones_segundo_plano() {
  if (sincronizando_en_segundo_plano) return;
  sincronizando_en_segundo_plano = true;
  try {
    await sincronizar_conversaciones_zernio({ sincronizar_mensajes_profundo: true, max_conversaciones_mensajes: 5 });
  } catch (error) {
    console.warn('Aviso en sondeo de conversaciones Zernio:', error.message);
  } finally {
    sincronizando_en_segundo_plano = false;
  }
}

setInterval(sondeo_conversaciones_segundo_plano, 15 * 1000);
setImmediate(sondeo_conversaciones_segundo_plano);

// Endpoint manual del sweeper
app.post('/api/webhook/sweeper', async (_req, res) => {
  await ejecutar_sweeper();
  res.json({ exito: true, mensaje: 'Sweeper ejecutado correctamente' });
});

// =========================================================================
// ENDPOINTS DE AUTENTICACIÓN Y MULTI-INQUILINO (USUARIO + CONTRASEÑA)
// =========================================================================

// Inicio de sesión con usuario y contraseña
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, contrasena } = req.body;
    if (!usuario || !contrasena) {
      return res.status(400).json({ exito: false, error: 'Debe ingresar usuario y contraseña' });
    }

    const usuarioLimpio = usuario.trim().toLowerCase();
    const usuarioDb = await base_datos.prepare(`
      SELECT 
        u.id, u.optica_id, u.nombre, u.usuario, u.hash_contrasena, u.rol, u.activo,
        o.nombre AS optica_nombre, o.slug AS optica_slug, o.logo_url AS optica_logo,
        o.color_primario, o.color_secundario, o.telefono AS optica_telefono
      FROM usuarios u
      JOIN opticas o ON u.optica_id = o.id
      WHERE LOWER(u.usuario) = ? AND u.activo = true AND o.activo = true
    `).get(usuarioLimpio);

    if (!usuarioDb) {
      return res.status(401).json({ exito: false, error: 'Usuario o contraseña incorrectos' });
    }

    const coincide = bcrypt.compareSync(contrasena, usuarioDb.hash_contrasena);
    if (!coincide) {
      return res.status(401).json({ exito: false, error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      {
        id: Number(usuarioDb.id),
        usuario: usuarioDb.usuario,
        nombre: usuarioDb.nombre,
        rol: usuarioDb.rol,
        optica_id: Number(usuarioDb.optica_id),
      },
      SECRETO_JWT,
      { expiresIn: '7d' }
    );

    base_datos.prepare("UPDATE usuarios SET ultimo_acceso = datetime('now') WHERE id = ?").run(usuarioDb.id).catch(() => {});

    res.json({
      exito: true,
      token,
      usuario: {
        id: Number(usuarioDb.id),
        usuario: usuarioDb.usuario,
        nombre: usuarioDb.nombre,
        rol: usuarioDb.rol,
        optica_id: Number(usuarioDb.optica_id),
      },
      optica: {
        id: Number(usuarioDb.optica_id),
        nombre: usuarioDb.optica_nombre,
        slug: usuarioDb.optica_slug,
        logo_url: usuarioDb.optica_logo,
        color_primario: usuarioDb.color_primario || '#0284c7',
        color_secundario: usuarioDb.color_secundario || '#0369a1',
        telefono: usuarioDb.optica_telefono,
      },
    });
  } catch (error) {
    console.error('Error en autenticación login:', error);
    res.status(500).json({ exito: false, error: 'Error interno del servidor en autenticación' });
  }
});

// Perfil del usuario autenticado
app.get('/api/auth/perfil', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ exito: false, error: 'Sesión no iniciada' });
  }

  try {
    const usuarioDb = await base_datos.prepare(`
      SELECT id, optica_id, nombre, usuario, rol
      FROM usuarios
      WHERE id = ? AND activo = true
    `).get(req.usuario.id);

    if (!usuarioDb) {
      return res.status(404).json({ exito: false, error: 'Usuario no encontrado' });
    }

    const idOpticaConsultar = (usuarioDb.rol === 'admin' && req.optica_id) ? req.optica_id : usuarioDb.optica_id;
    const opticaDb = await base_datos.prepare(`
      SELECT 
        id, nombre, slug, logo_url, color_primario, color_secundario, telefono,
        duracion_cita_minutos, control_meses_defecto, especialista_defecto,
        registro_profesional_defecto, motivo_cita_defecto, notificacion_auto_citas_whatsapp,
        hora_inicio_atencion, hora_fin_atencion
      FROM opticas
      WHERE id = ? AND activo = true
    `).get(idOpticaConsultar);

    res.json({
      exito: true,
      usuario: {
        id: Number(usuarioDb.id),
        usuario: usuarioDb.usuario,
        nombre: usuarioDb.nombre,
        rol: usuarioDb.rol,
        optica_id: Number(usuarioDb.optica_id),
      },
      optica: opticaDb ? {
        id: Number(opticaDb.id),
        nombre: opticaDb.nombre,
        slug: opticaDb.slug,
        logo_url: opticaDb.logo_url,
        color_primario: opticaDb.color_primario || '#0284c7',
        color_secundario: opticaDb.color_secundario || '#0369a1',
        telefono: opticaDb.telefono,
        duracion_cita_minutos: Number(opticaDb.duracion_cita_minutos) || 30,
        control_meses_defecto: Number(opticaDb.control_meses_defecto) || 12,
        especialista_defecto: opticaDb.especialista_defecto || '',
        registro_profesional_defecto: opticaDb.registro_profesional_defecto || '',
        motivo_cita_defecto: opticaDb.motivo_cita_defecto || '',
        notificacion_auto_citas_whatsapp: opticaDb.notificacion_auto_citas_whatsapp !== false,
        hora_inicio_atencion: opticaDb.hora_inicio_atencion || '08:00',
        hora_fin_atencion: opticaDb.hora_fin_atencion || '18:00',
      } : null,
    });
  } catch (error) {
    console.error('Error al consultar perfil:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Listado de ópticas activas en el sistema
app.get('/api/opticas', async (_req, res) => {
  try {
    const opticas = await base_datos.prepare(`
      SELECT id, nombre, slug, logo_url, color_primario, color_secundario, telefono, activo 
      FROM opticas 
      WHERE activo = true 
      ORDER BY id ASC
    `).all();

    const normalizadas = opticas.map((o) => ({
      ...o,
      id: Number(o.id),
    }));

    res.json({ exito: true, opticas: normalizadas });
  } catch (error) {
    console.error('Error al listar ópticas:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Listado de líneas de comunicación de la óptica activa
app.get('/api/lineas', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const lineas = await base_datos.prepare(`
      SELECT id, optica_id, canal, numero, id_cuenta_zernio, etiqueta, estado, es_predeterminada, creado_en
      FROM lineas_canales
      WHERE optica_id = ?
      ORDER BY es_predeterminada DESC, id ASC
    `).all(optica_id);

    res.json({ exito: true, lineas });
  } catch (error) {
    console.error('Error al listar líneas de la óptica:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Estado del sistema y métricas
app.get('/api/estado', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const total_contactos = (await base_datos.prepare('SELECT COUNT(*) AS total FROM contactos WHERE optica_id = ?').get(optica_id))?.total || 0;
    const total_conversaciones = (await base_datos.prepare('SELECT COUNT(*) AS total FROM conversaciones WHERE optica_id = ?').get(optica_id))?.total || 0;
    const total_mensajes = (await base_datos.prepare('SELECT COUNT(*) AS total FROM mensajes').get())?.total || 0;
    const eventos_recibidos = (await base_datos.prepare("SELECT COUNT(*) AS total FROM eventos_webhook WHERE estado = 'recibido'").get())?.total || 0;

    res.json({
      sistema: 'CRM Óptica',
      estado: 'en_linea',
      motor_bd: 'Supabase PostgreSQL (CRM_Opticas)',
      optica_id,
      metricas: {
        total_contactos: Number(total_contactos),
        total_conversaciones: Number(total_conversaciones),
        total_mensajes: Number(total_mensajes),
        eventos_pendientes_sweeper: Number(eventos_recibidos),
      },
      canal_whatsapp: {
        numero: '+57 313 2531694',
        modo: 'coexistencia',
      },
    });
  } catch (error) {
    console.error('Error al consultar estado:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Listado de conversaciones con indicador de ventana de 24 horas (filtrado por óptica)
app.get('/api/conversaciones', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const conversaciones = await base_datos.prepare(`
      SELECT 
        c.id,
        c.contacto_id,
        c.canal,
        c.id_cuenta_zernio,
        c.id_conversacion_zernio,
        c.ultimo_mensaje_entrante_en,
        c.ultimo_leido_en,
        c.estado,
        COALESCE(c.mensajes_no_leidos, 0) AS mensajes_no_leidos,
        co.nombre_completo AS contacto_nombre,
        co.telefono AS contacto_telefono,
        co.business_scoped_user_id AS contacto_bsuid,
        (SELECT texto FROM mensajes WHERE conversacion_id = c.id ORDER BY creado_en DESC, id DESC LIMIT 1) AS ultimo_mensaje_texto,
        (SELECT creado_en FROM mensajes WHERE conversacion_id = c.id ORDER BY creado_en DESC, id DESC LIMIT 1) AS ultimo_mensaje_fecha,
        (SELECT direccion FROM mensajes WHERE conversacion_id = c.id ORDER BY creado_en DESC, id DESC LIMIT 1) AS ultimo_mensaje_direccion,
        (
          SELECT COUNT(*)::int 
          FROM mensajes m 
          WHERE m.conversacion_id = c.id 
            AND m.direccion = 'entrante' 
            AND (c.ultimo_leido_en IS NULL OR m.creado_en > c.ultimo_leido_en)
        ) AS mensajes_entrantes_sin_leer
      FROM conversaciones c
      JOIN contactos co ON c.contacto_id = co.id
      WHERE c.optica_id = ?
      ORDER BY COALESCE(
        (SELECT MAX(creado_en) FROM mensajes WHERE conversacion_id = c.id),
        c.ultimo_mensaje_entrante_en,
        c.actualizado_en,
        c.creado_en
      ) DESC
    `).all(optica_id);

    const mapaPlantillas = await obtenerMapaPlantillasPorNombre(optica_id);

    const enriquecidas = conversaciones.map((conv) => {
      const entrantesSinLeer = Number(conv.mensajes_entrantes_sin_leer || 0);
      const enTablaNoLeidos = Number(conv.mensajes_no_leidos || 0);

      // Si la última interacción fue saliente (nosotros respondimos al contacto), no hay pendientes de lectura
      let cantidad_no_leidos = 0;
      if (conv.ultimo_mensaje_direccion !== 'saliente') {
        cantidad_no_leidos = Math.max(entrantesSinLeer, enTablaNoLeidos);

        // Si el último mensaje registrado es entrante y es posterior a la lectura (o nunca leído), asegurar mínimo 1
        const fechaMsg = conv.ultimo_mensaje_fecha ? new Date(conv.ultimo_mensaje_fecha).getTime() : 0;
        const fechaLeido = conv.ultimo_leido_en ? new Date(conv.ultimo_leido_en).getTime() : 0;
        if (conv.ultimo_mensaje_direccion === 'entrante' && (!fechaLeido || fechaMsg > fechaLeido) && cantidad_no_leidos === 0) {
          cantidad_no_leidos = 1;
        }
      }

      const esNoLeido = cantidad_no_leidos > 0;

      let ultimoTexto = conv.ultimo_mensaje_texto || '';
      const matchTemplate = ultimoTexto.match(/\[Template:\s*([a-zA-Z0-9_-]+)\]/i);
      if (matchTemplate) {
        const nombrePlantilla = matchTemplate[1].toLowerCase();
        const pInfo = mapaPlantillas.get(nombrePlantilla);
        if (pInfo) {
          const prefijo = pInfo.encabezado_tipo === 'IMAGEN' ? '📷 ' : (pInfo.encabezado_tipo === 'VIDEO' ? '📹 ' : '');
          ultimoTexto = `${prefijo}${pInfo.cuerpo || pInfo.etiqueta || pInfo.nombre}`;
        } else {
          ultimoTexto = `Plantilla: ${matchTemplate[1]}`;
        }
      } else if (/^\[reaction(?::\s*[^\]]+)?\]$/i.test(ultimoTexto.trim())) {
        const matchReaccion = ultimoTexto.match(/\[reaction(?::\s*([^\]]+))?\]/i);
        const emojiReaccion = matchReaccion && matchReaccion[1]?.trim() ? matchReaccion[1].trim() : '';
        ultimoTexto = emojiReaccion ? `${emojiReaccion} Reacción` : 'Reacción';
      }

      return {
        ...conv,
        ultimo_mensaje_texto: ultimoTexto,
        mensajes_no_leidos: cantidad_no_leidos,
        no_leido: esNoLeido,
        ventana_24h_activa: esta_en_ventana_24_horas(conv.ultimo_mensaje_entrante_en),
        sin_contestar: conv.ultimo_mensaje_direccion === 'entrante',
      };
    });

    res.json({ exito: true, conversaciones: enriquecidas });
  } catch (error) {
    console.error('Error al listar conversaciones:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Endpoint explícito para sincronizar conversaciones de Zernio
app.all('/api/conversaciones/sincronizar', async (_req, res) => {
  try {
    const resultado = await sincronizar_conversaciones_zernio({ sincronizar_mensajes_profundo: true, max_conversaciones_mensajes: 15 });
    res.json(resultado);
  } catch (error) {
    console.error('Error en sincronización manual:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Mapa de control de frecuencia para no saturar la API de Zernio (máximo 1 consulta cada 3s por chat)
const marcas_tiempo_sync_chat = new Map();

// Historial de mensajes de una conversación
app.get('/api/conversaciones/:id/mensajes', async (req, res) => {
  const conversacion_id = req.params.id;
  const ahora = Date.now();
  const ultimo_sync = marcas_tiempo_sync_chat.get(conversacion_id) || 0;

  try {
    function normalizarUrlMedia(url) {
      if (!url) return null;
      const match = url.match(/\/whatsapp\/media\/([a-zA-Z0-9_-]+)/);
      if (match) {
        const mediaId = match[1];
        let accountId = '6ab6a5ade55ed05c5f3a902b';
        const matchAcc = url.match(/accountId=([a-zA-Z0-9_-]+)/);
        if (matchAcc) accountId = matchAcc[1];
        return `/api/media/whatsapp/${mediaId}?accountId=${accountId}`;
      }
      return url;
    }

    // 1. Responder con los mensajes desde Supabase (excluyendo eventos vacíos no soportados de Meta)
    const mensajes = await base_datos.prepare(`
      SELECT * FROM mensajes 
      WHERE conversacion_id = ? 
      AND (texto != '[Unsupported message]' OR url_adjunto IS NOT NULL)
      ORDER BY creado_en ASC, id ASC
    `).all(conversacion_id);

    const optica_id = req.optica_id || 1;
    const mapaPlantillas = await obtenerMapaPlantillasPorNombre(optica_id);

    const mensajesEnriquecidos = mensajes.map((m) => {
      let plantillaInfo = null;
      const match = (m.texto || '').match(/\[Template:\s*([a-zA-Z0-9_-]+)\]/i);
      if (match) {
        const nombrePl = match[1].toLowerCase();
        const p = mapaPlantillas.get(nombrePl);
        if (p) {
          plantillaInfo = p;
        }
      }

      let tipoContenido = m.tipo_contenido;
      if (m.texto === '[reaction]' || (m.texto && /^\[reaction(?::\s*[^\]]+)?\]$/i.test(m.texto.trim()))) {
        tipoContenido = 'reaction';
      }

      let reaccionesNormalizadas = [];
      if (Array.isArray(m.reacciones)) {
        reaccionesNormalizadas = m.reacciones.map(r => ({
          emoji: r.emoji,
          direccion: r.de_mi ? 'saliente' : (r.direccion || 'entrante'),
          id: r.id || undefined,
        }));
      } else if (typeof m.reacciones === 'string') {
        try {
          const parsed = JSON.parse(m.reacciones);
          if (Array.isArray(parsed)) {
            reaccionesNormalizadas = parsed.map(r => ({
              emoji: r.emoji,
              direccion: r.de_mi ? 'saliente' : (r.direccion || 'entrante'),
              id: r.id || undefined,
            }));
          }
        } catch {}
      }

      return {
        ...m,
        tipo_contenido: tipoContenido,
        url_adjunto: normalizarUrlMedia(m.url_adjunto),
        plantilla: plantillaInfo,
        reacciones: reaccionesNormalizadas,
      };
    });

    res.json({ exito: true, mensajes: mensajesEnriquecidos });

    // 3. Precargar en segundo plano archivos multimedia para que estén listos en disco local (< 2ms)
    setImmediate(async () => {
      for (const m of mensajesEnriquecidos) {
        if (m.url_adjunto) {
          const matchMedia = m.url_adjunto.match(/\/whatsapp\/media\/([a-zA-Z0-9_-]+)/);
          if (matchMedia) {
            const mediaId = matchMedia[1];
            let accountId = '6ab6a5ade55ed05c5f3a902b';
            const matchAcc = m.url_adjunto.match(/accountId=([a-zA-Z0-9_-]+)/);
            if (matchAcc) accountId = matchAcc[1];
            obtener_o_descargar_medio_local(mediaId, accountId).catch(() => {});
          }
        }
      }
    });

    // 4. Si pasaron más de 15 segundos, actualizar en segundo plano con Zernio sin congelar la respuesta
    if (ahora - ultimo_sync > 15000) {
      marcas_tiempo_sync_chat.set(conversacion_id, ahora);
      setImmediate(async () => {
        try {
          const conv = await base_datos.prepare('SELECT * FROM conversaciones WHERE id = ?').get(conversacion_id);
          if (conv && conv.id_conversacion_zernio) {
            await sincronizar_mensajes_conversacion(conv.id_conv_zernio || conv.id_conversacion_zernio, conv.id_cuenta_zernio, conv.id);
          }
        } catch (error) {
          console.warn(`Aviso: Sincronización en segundo plano para conversación ${conversacion_id}:`, error.message);
        }
      });
    }
  } catch (error) {
    console.error(`Error al obtener mensajes de conversación ${conversacion_id}:`, error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Endpoint explícito para marcar conversación como leída
app.post('/api/conversaciones/:id/marcar-leido', async (req, res) => {
  const conversacion_id = req.params.id;
  try {
    await base_datos.prepare('UPDATE conversaciones SET mensajes_no_leidos = 0, ultimo_leido_en = now() WHERE id = ?').run(conversacion_id);
    const conv = await base_datos.prepare('SELECT * FROM conversaciones WHERE id = ?').get(conversacion_id);
    if (conv && conv.id_conversacion_zernio && conv.id_cuenta_zernio) {
      setImmediate(async () => {
        try {
          const cliente = new ClienteZernio();
          await cliente.solicitar(`/inbox/conversations/${conv.id_conversacion_zernio}/read`, {
            metodo: 'POST',
            cuerpo: { accountId: conv.id_cuenta_zernio },
            sin_reintentos: true,
          });
        } catch {}
      });
    }
    res.json({ exito: true });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

// =========================================================================
// ALMACENAMIENTO LOCAL EN DISCO Y PROXY MULTIMEDIA RESILIENTE
// =========================================================================
const RUTA_CACHE_MULTIMEDIA = path.join(process.cwd(), 'datos/archivos_multimedia');
if (!fs.existsSync(RUTA_CACHE_MULTIMEDIA)) {
  fs.mkdirSync(RUTA_CACHE_MULTIMEDIA, { recursive: true });
}

// Mapa de coalescing de descargas en curso para no saturar conexiones con Zernio
const descargas_multimedia_en_curso = new Map();

/**
 * Obtiene o descarga un archivo multimedia garantizando almacenamiento local en disco.
 * Si ya existe en disco, se sirve en < 2ms sin consultar a la API de Zernio.
 */
async function obtener_o_descargar_medio_local(media_id, account_id) {
  const rutaArchivo = path.join(RUTA_CACHE_MULTIMEDIA, `${media_id}.bin`);
  const rutaMeta = path.join(RUTA_CACHE_MULTIMEDIA, `${media_id}.meta.json`);

  // 1. Servir desde caché en disco si ya existe y tiene datos válidos
  if (fs.existsSync(rutaMeta)) {
    try {
      const meta = JSON.parse(await fs.promises.readFile(rutaMeta, 'utf8'));
      if (meta.expirado) {
        return {
          expirado: true,
          error: 'Este archivo multimedia ha caducado en los servidores de WhatsApp.',
        };
      }
      if (fs.existsSync(rutaArchivo)) {
        const stats = await fs.promises.stat(rutaArchivo);
        if (stats.size > 0) {
          const buffer = await fs.promises.readFile(rutaArchivo);
          return {
            buffer,
            tipo_contenido: meta.tipo_contenido || 'application/octet-stream',
            longitud: stats.size,
            desde_cache: true,
          };
        }
      }
    } catch (e) {
      console.warn(`[Caché Multimedia] Error al leer archivo en disco para ${media_id}:`, e.message);
    }
  }

  // 2. Si ya hay una descarga activa para este ID, esperar a la misma promesa
  if (descargas_multimedia_en_curso.has(media_id)) {
    return await descargas_multimedia_en_curso.get(media_id);
  }

  // 3. Descargar desde la API de Zernio con reintentos y guardar en disco
  const promesaDescarga = (async () => {
    try {
      const url_zernio = `https://zernio.com/api/v1/whatsapp/media/${encodeURIComponent(media_id)}?accountId=${encodeURIComponent(account_id)}`;

      let respuesta = null;
      let intentos = 0;
      while (intentos < 3) {
        intentos++;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 45000); // 45 segundos de margen
          respuesta = await fetch(url_zernio, {
            headers: {
              'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}`,
            },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (respuesta.ok) break;
          console.warn(`[Proxy Multimedia] Intento ${intentos} para ${media_id}: HTTP ${respuesta.status}`);
          // Si Meta dice explícitamente que el objeto no existe (400 / 404), no reintentar
          if (respuesta.status === 400 || respuesta.status === 404) break;
        } catch (err) {
          console.warn(`[Proxy Multimedia] Intento ${intentos} para ${media_id} falló:`, err.message);
        }
        if (intentos < 3) await new Promise((r) => setTimeout(r, 1200));
      }

      if (!respuesta || !respuesta.ok) {
        if (respuesta && (respuesta.status === 400 || respuesta.status === 404)) {
          await fs.promises.writeFile(
            rutaMeta,
            JSON.stringify({ expirado: true, error: 'Caducado en servidores de WhatsApp', guardado_en: new Date().toISOString() })
          );
          return { expirado: true, error: 'Este archivo multimedia ha caducado en los servidores de WhatsApp.' };
        }
        throw new Error(`No fue posible descargar el archivo multimedia de Zernio (HTTP ${respuesta ? respuesta.status : 'timeout'})`);
      }

      const tipo_contenido = respuesta.headers.get('content-type') || 'application/octet-stream';
      const arrayBuffer = await respuesta.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Guardar en disco local de forma atómica
      await fs.promises.writeFile(rutaArchivo, buffer);
      await fs.promises.writeFile(
        rutaMeta,
        JSON.stringify({ tipo_contenido, longitud: buffer.length, guardado_en: new Date().toISOString() })
      );

      return {
        buffer,
        tipo_contenido,
        longitud: buffer.length,
        desde_cache: false,
      };
    } finally {
      descargas_multimedia_en_curso.delete(media_id);
    }
  })();

  descargas_multimedia_en_curso.set(media_id, promesaDescarga);
  return await promesaDescarga;
}

// Proxy seguro de archivos multimedia de WhatsApp / Zernio con almacenamiento en disco
app.get(['/api/media/whatsapp/:id', '/api/v1/whatsapp/media/:id'], async (req, res) => {
  try {
    const media_id = req.params.id;
    const account_id = req.query.accountId || req.query.account_id || process.env.ZERNIO_ACCOUNT_ID || '6ab6a5ade55ed05c5f3a902b';

    const resultado = await obtener_o_descargar_medio_local(media_id, account_id);

    if (resultado.expirado) {
      return res.status(410).json({
        exito: false,
        expirado: true,
        error: 'Este archivo multimedia ha caducado en los servidores de WhatsApp.',
      });
    }

    res.setHeader('Content-Type', resultado.tipo_contenido);
    res.setHeader('Content-Length', resultado.longitud);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7 días de caché en cliente
    res.send(resultado.buffer);
  } catch (error) {
    console.error(`[Proxy Multimedia] Error al servir medio ${req.params.id}:`, error.message);
    res.status(502).json({ exito: false, error: 'Error al procesar medio de WhatsApp' });
  }
});

// Envío de mensajes desde el CRM
app.post('/api/mensajes/enviar', async (req, res) => {
  try {
    let { conversacion_id, texto, usar_plantilla, nombre_plantilla, idioma_plantilla, componentes_plantilla } = req.body;

    // Si se solicita plantilla (explícita o por reactivación), resolver plantilla aprobada
    if (usar_plantilla || nombre_plantilla) {
      let plantilla_aprobada = null;
      if (nombre_plantilla) {
        plantilla_aprobada = await base_datos.prepare(`
          SELECT * FROM plantillas 
          WHERE (nombre = ? OR etiqueta = ?) AND (estado = 'APPROVED' OR estado = 'APROBADA')
          LIMIT 1
        `).get(nombre_plantilla, nombre_plantilla);
      }

      if (!plantilla_aprobada && usar_plantilla) {
        plantilla_aprobada = await base_datos.prepare(`
          SELECT * FROM plantillas 
          WHERE estado = 'APPROVED' OR estado = 'APROBADA'
          ORDER BY (CASE WHEN nombre = 'optica_digital' THEN 1 ELSE 2 END), id ASC 
          LIMIT 1
        `).get();
      }

      if (plantilla_aprobada) {
        req.body.nombre_plantilla = plantilla_aprobada.nombre;
        req.body.idioma_plantilla = idioma_plantilla || plantilla_aprobada.idioma || 'es';

        if (!componentes_plantilla || componentes_plantilla.length === 0) {
          const componentes = [];
          if (plantilla_aprobada.encabezado_tipo === 'IMAGEN' && plantilla_aprobada.encabezado_contenido) {
            componentes.push({
              type: 'header',
              parameters: [
                {
                  type: 'image',
                  image: { link: plantilla_aprobada.encabezado_contenido },
                },
              ],
            });
          }
          req.body.componentes_plantilla = componentes;
        }

        if (!req.body.texto || req.body.texto.trim() === '') {
          req.body.texto = `[Template: ${plantilla_aprobada.nombre}]`;
        }
      }
    }

    const resultado = await enviar_mensaje(req.body);
    if (!resultado.exito) {
      return res.status(400).json(resultado);
    }
    res.json(resultado);
  } catch (error) {
    console.error('❌ Error crítico no controlado en /api/mensajes/enviar:', error);
    res.status(500).json({
      exito: false,
      error: {
        codigo: 'ERROR_SERVIDOR',
        mensaje: error.message || 'Error interno al procesar el mensaje.',
      },
    });
  }
});

// Lista de pacientes / contactos (filtrado por óptica)
app.get('/api/contactos', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const contactos = await base_datos.prepare(`
      SELECT 
        c.*,
        c.nombre_completo AS nombre,
        COALESCE(c.es_paciente, false) AS es_paciente,
        CAST((SELECT COUNT(*) FROM formulas_opticas WHERE contacto_id = c.id) AS INTEGER) AS total_formulas,
        CAST((SELECT COUNT(*) FROM citas WHERE contacto_id = c.id) AS INTEGER) AS total_citas,
        (SELECT fecha_examen FROM formulas_opticas WHERE contacto_id = c.id ORDER BY id DESC LIMIT 1) AS ultima_formula_fecha,
        (SELECT tipo_lente FROM formulas_opticas WHERE contacto_id = c.id ORDER BY id DESC LIMIT 1) AS ultimo_tipo_lente
      FROM contactos c
      WHERE c.optica_id = ?
      ORDER BY LOWER(TRIM(COALESCE(c.nombre_completo, ''))) ASC, c.actualizado_en DESC
    `).all(optica_id);
    res.json({ exito: true, contactos });
  } catch (error) {
    console.error('Error al listar contactos:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Crear nuevo paciente o contacto
app.post('/api/contactos', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const { nombre, nombre_completo, tipo_documento = 'CC', cedula, documento, telefono, correo, edad, sexo = 'masculino', es_paciente = true } = req.body;
    const nombreFinal = String(nombre_completo || nombre || '').trim();
    const doc = String(cedula || documento || '').trim();
    const sexoFinal = sexo ? String(sexo).trim().toLowerCase() : 'masculino';

    if (!nombreFinal) {
      return res.status(400).json({ exito: false, error: 'El nombre completo es obligatorio' });
    }

    // Verificar si ya existe un contacto por cédula/documento o por teléfono en la misma óptica
    let existente = null;
    if (doc) {
      existente = await base_datos.prepare(
        'SELECT * FROM contactos WHERE optica_id = ? AND TRIM(cedula) = TRIM(?)'
      ).get(optica_id, doc);
    }

    if (!existente && telefono && String(telefono).trim()) {
      existente = await base_datos.prepare(
        'SELECT * FROM contactos WHERE optica_id = ? AND TRIM(telefono) = TRIM(?)'
      ).get(optica_id, String(telefono).trim());
    }

    if (existente) {
      // Actualizar datos del contacto y promoverlo a paciente
      await base_datos.prepare(`
        UPDATE contactos 
        SET 
          nombre_completo = COALESCE(?, nombre_completo),
          tipo_documento = COALESCE(?, tipo_documento),
          cedula = COALESCE(?, cedula),
          telefono = COALESCE(?, telefono),
          correo = COALESCE(?, correo),
          edad = COALESCE(?, edad),
          sexo = COALESCE(?, sexo),
          es_paciente = ?,
          actualizado_en = datetime('now')
        WHERE id = ?
      `).run(
        nombreFinal,
        tipo_documento ? String(tipo_documento).trim().toUpperCase() : 'CC',
        doc || null,
        telefono ? String(telefono).trim() : null,
        correo ? String(correo).trim() : null,
        edad ? Number(edad) : null,
        sexoFinal,
        Boolean(es_paciente),
        existente.id
      );

      const actualizado = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(existente.id);
      return res.json({ exito: true, contacto: actualizado, actualizado: true });
    }

    // Insertar nuevo contacto como paciente
    const insercion = await base_datos.prepare(`
      INSERT INTO contactos (
        optica_id, nombre_completo, tipo_documento, cedula, telefono, correo, edad, sexo, es_paciente
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      optica_id,
      nombreFinal,
      tipo_documento ? String(tipo_documento).trim().toUpperCase() : 'CC',
      doc || null,
      telefono ? String(telefono).trim() : null,
      correo ? String(correo).trim() : null,
      edad ? Number(edad) : null,
      sexoFinal,
      Boolean(es_paciente)
    );

    const nuevoContacto = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(insercion.lastInsertRowid);
    res.json({ exito: true, contacto: nuevoContacto, creado: true });
  } catch (error) {
    console.error('Error al registrar paciente:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Actualizar información de un paciente o promover un contacto a paciente
app.put('/api/contactos/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ exito: false, error: 'ID de contacto inválido' });
    }

    const { nombre, nombre_completo, tipo_documento, cedula, documento, telefono, correo, edad, sexo, es_paciente } = req.body;
    const nombreFinal = nombre_completo !== undefined ? nombre_completo : nombre;
    const doc = cedula !== undefined ? cedula : documento;

    const actual = await base_datos.prepare('SELECT * FROM contactos WHERE id = ?').get(id);
    if (!actual) {
      return res.status(404).json({ exito: false, error: 'Contacto no encontrado' });
    }

    await base_datos.prepare(`
      UPDATE contactos 
      SET 
        nombre_completo = ?,
        tipo_documento = ?,
        cedula = ?,
        telefono = ?,
        correo = ?,
        edad = ?,
        sexo = ?,
        es_paciente = ?,
        actualizado_en = datetime('now')
      WHERE id = ?
    `).run(
      nombreFinal !== undefined ? (nombreFinal ? String(nombreFinal).trim() : null) : actual.nombre_completo,
      tipo_documento !== undefined ? (tipo_documento ? String(tipo_documento).trim().toUpperCase() : 'CC') : (actual.tipo_documento || 'CC'),
      doc !== undefined ? (doc ? String(doc).trim() : null) : actual.cedula,
      telefono !== undefined ? (telefono ? String(telefono).trim() : null) : actual.telefono,
      correo !== undefined ? (correo ? String(correo).trim() : null) : actual.correo,
      edad !== undefined ? (edad ? Number(edad) : null) : actual.edad,
      sexo !== undefined ? (sexo ? String(sexo).trim().toLowerCase() : 'masculino') : (actual.sexo || 'masculino'),
      es_paciente !== undefined ? Boolean(es_paciente) : actual.es_paciente,
      id
    );

    const actualizado = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(id);
    res.json({ exito: true, contacto: actualizado });
  } catch (error) {
    console.error(`Error al actualizar contacto ${req.params.id}:`, error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Detalle de un paciente con historial de fórmulas ópticas y citas
app.get('/api/contactos/:id', async (req, res) => {
  try {
    const contacto = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(req.params.id);
    if (!contacto) {
      return res.status(404).json({ exito: false, mensaje: 'Paciente no encontrado' });
    }

    const formulas = await base_datos.prepare(`
      SELECT 
        id,
        contacto_id,
        fecha_examen,
        od_esfera AS esfera_od,
        od_cilindro AS cilindro_od,
        od_eje AS eje_od,
        od_adicion AS adicion_od,
        od_agudeza_visual AS av_od,
        oi_esfera AS esfera_oi,
        oi_cilindro AS cilindro_oi,
        oi_eje AS eje_oi,
        oi_adicion AS adicion_oi,
        oi_agudeza_visual AS av_oi,
        distancia_pupilar,
        tipo_lente,
        observaciones,
        optometra,
        proximo_control AS proximo_control_en_meses,
        creado_en
      FROM formulas_opticas 
      WHERE contacto_id = ? 
      ORDER BY id DESC
    `).all(req.params.id);

    const citas = await base_datos.prepare('SELECT * FROM citas WHERE contacto_id = ? ORDER BY fecha_cita DESC, hora_cita DESC').all(req.params.id);

    res.json({ exito: true, contacto, formulas, citas });
  } catch (error) {
    console.error(`Error al obtener detalle del contacto ${req.params.id}:`, error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Manejador unificado para registrar fórmulas ópticas
async function guardar_formula_optica(req, res) {
  try {
    const contacto_id = req.params.id || req.body.contacto_id;
    if (!contacto_id) {
      return res.status(400).json({ exito: false, error: 'contacto_id es obligatorio' });
    }
    const optica_id = req.optica_id || 1;

    const {
      esfera_od, od_esfera,
      cilindro_od, od_cilindro,
      eje_od, od_eje,
      adicion_od, od_adicion,
      av_od, od_agudeza_visual,
      esfera_oi, oi_esfera,
      cilindro_oi, oi_cilindro,
      eje_oi, oi_eje,
      adicion_oi, oi_adicion,
      av_oi, oi_agudeza_visual,
      distancia_pupilar,
      tipo_lente,
      observaciones,
      optometra,
      proximo_control, proximo_control_en_meses,
      fecha_examen
    } = req.body;

    const insercion = await base_datos.prepare(`
      INSERT INTO formulas_opticas (
        contacto_id, optica_id,
        od_esfera, od_cilindro, od_eje, od_adicion, od_agudeza_visual,
        oi_esfera, oi_cilindro, oi_eje, oi_adicion, oi_agudeza_visual,
        distancia_pupilar, tipo_lente, observaciones, optometra,
        fecha_examen, proximo_control
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contacto_id,
      optica_id,
      esfera_od ?? od_esfera ?? '+0.00',
      cilindro_od ?? od_cilindro ?? '-0.00',
      eje_od ?? od_eje ?? '0',
      adicion_od ?? od_adicion ?? '+0.00',
      av_od ?? od_agudeza_visual ?? '20/20',
      esfera_oi ?? oi_esfera ?? '+0.00',
      cilindro_oi ?? oi_cilindro ?? '-0.00',
      eje_oi ?? oi_eje ?? '0',
      adicion_oi ?? oi_adicion ?? '+0.00',
      av_oi ?? oi_agudeza_visual ?? '20/20',
      distancia_pupilar || '62 mm',
      tipo_lente || 'Monofocal Antirreflejo',
      observaciones || null,
      optometra || 'Dr. Samir Bolívar',
      fecha_examen ? fecha_examen.split('T')[0] : new Date().toISOString().split('T')[0],
      proximo_control_en_meses ? String(proximo_control_en_meses) : (proximo_control || '12')
    );

    await base_datos.prepare("UPDATE contactos SET actualizado_en = datetime('now') WHERE id = ?").run(contacto_id);

    res.json({ exito: true, formula_id: Number(insercion.lastInsertRowid) });
  } catch (error) {
    console.error('Error al guardar fórmula óptica:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
}

app.post('/api/formulas', guardar_formula_optica);
app.post('/api/contactos/:id/formulas', guardar_formula_optica);

// Manejador unificado para agendar o registrar citas
async function guardar_cita_paciente(req, res) {
  try {
    const contacto_id = req.params.id || req.body.contacto_id;
    if (!contacto_id) {
      return res.status(400).json({ exito: false, error: 'contacto_id es obligatorio' });
    }
    const optica_id = req.optica_id || 1;
    const { fecha_cita, hora_cita, motivo, especialista, observaciones } = req.body;

    if (!fecha_cita || !hora_cita) {
      return res.status(400).json({ exito: false, error: 'La fecha y hora de la cita son obligatorias' });
    }

    // Validar si el paciente ya tiene una cita activa para esa misma fecha y hora
    const citaExistente = await base_datos.prepare(`
      SELECT id, fecha_cita, hora_cita, motivo, estado 
      FROM citas 
      WHERE contacto_id = ? 
        AND TRIM(fecha_cita) = TRIM(?) 
        AND LOWER(TRIM(hora_cita)) = LOWER(TRIM(?))
        AND (estado IS NULL OR estado NOT IN ('cancelada', 'anulada'))
    `).get(contacto_id, fecha_cita, hora_cita);

    if (citaExistente) {
      return res.status(409).json({
        exito: false,
        duplicada: true,
        error: 'Este paciente para ese día a esa hora ya tiene una cita asignada.',
      });
    }

    const insercion = await base_datos.prepare(`
      INSERT INTO citas (contacto_id, optica_id, fecha_cita, hora_cita, motivo, especialista, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      contacto_id,
      optica_id,
      fecha_cita,
      hora_cita,
      motivo || 'Examen visual y control',
      especialista && String(especialista).trim() !== '' ? String(especialista).trim() : null,
      observaciones || null
    );

    await base_datos.prepare("UPDATE contactos SET actualizado_en = datetime('now') WHERE id = ?").run(contacto_id);

    res.json({ exito: true, cita_id: Number(insercion.lastInsertRowid) });
  } catch (error) {
    console.error('Error al guardar cita:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
}

app.post('/api/citas', guardar_cita_paciente);
app.post('/api/contactos/:id/citas', guardar_cita_paciente);

// Obtener listado de citas con información de contactos
app.get('/api/citas', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const { fecha_inicio, fecha_fin, estado, especialista } = req.query;

    let consulta = `
      SELECT 
        c.id,
        c.contacto_id,
        c.optica_id,
        c.fecha_cita,
        c.hora_cita,
        c.motivo,
        c.especialista,
        c.observaciones,
        COALESCE(c.estado, 'pendiente') AS estado,
        c.creado_en,
        co.nombre_completo AS contacto_nombre,
        co.telefono AS contacto_telefono,
        co.correo AS contacto_correo
      FROM citas c
      LEFT JOIN contactos co ON co.id = c.contacto_id
      WHERE c.optica_id = ?
    `;
    const params = [optica_id];

    if (fecha_inicio && fecha_fin) {
      consulta += ` AND c.fecha_cita >= ? AND c.fecha_cita <= ?`;
      params.push(fecha_inicio, fecha_fin);
    } else if (fecha_inicio) {
      consulta += ` AND c.fecha_cita = ?`;
      params.push(fecha_inicio);
    }

    if (estado && estado !== 'todos') {
      consulta += ` AND c.estado = ?`;
      params.push(estado);
    }

    if (especialista && especialista !== 'todos') {
      consulta += ` AND c.especialista = ?`;
      params.push(especialista);
    }

    consulta += ` ORDER BY c.fecha_cita ASC, c.hora_cita ASC, c.id ASC`;

    const citas = await base_datos.prepare(consulta).all(...params);
    res.json({ exito: true, citas: citas || [] });
  } catch (error) {
    console.error('Error al obtener citas:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Reprogramar o actualizar cita (fecha, hora, doctor, estado, observaciones)
app.put('/api/citas/:id', async (req, res) => {
  try {
    const idCita = Number(req.params.id);
    if (!idCita) {
      return res.status(400).json({ exito: false, error: 'ID de cita inválido' });
    }

    const { fecha_cita, hora_cita, motivo, especialista, observaciones, estado } = req.body;

    const citaActual = await base_datos.prepare('SELECT * FROM citas WHERE id = ?').get(idCita);
    if (!citaActual) {
      return res.status(404).json({ exito: false, error: 'Cita no encontrada' });
    }

    const nuevaFecha = fecha_cita || citaActual.fecha_cita;
    const nuevaHora = hora_cita || citaActual.hora_cita;
    const nuevoEspecialista = especialista !== undefined ? especialista : citaActual.especialista;
    const nuevoMotivo = motivo !== undefined ? motivo : citaActual.motivo;
    const nuevasObservaciones = observaciones !== undefined ? observaciones : citaActual.observaciones;
    const nuevoEstado = estado || citaActual.estado || 'pendiente';

    // Validación de duplicados al reprogramar fecha u hora
    if (nuevoEstado !== 'cancelada' && (fecha_cita || hora_cita)) {
      const conflicto = await base_datos.prepare(`
        SELECT id FROM citas 
        WHERE contacto_id = ? 
          AND TRIM(fecha_cita) = TRIM(?) 
          AND LOWER(TRIM(hora_cita)) = LOWER(TRIM(?))
          AND id != ?
          AND (estado IS NULL OR estado NOT IN ('cancelada', 'anulada'))
      `).get(citaActual.contacto_id, nuevaFecha, nuevaHora, idCita);

      if (conflicto) {
        return res.status(409).json({
          exito: false,
          duplicada: true,
          error: 'Este paciente para ese día a esa hora ya tiene una cita asignada.',
        });
      }
    }

    await base_datos.prepare(`
      UPDATE citas 
      SET fecha_cita = ?, hora_cita = ?, motivo = ?, especialista = ?, observaciones = ?, estado = ?
      WHERE id = ?
    `).run(nuevaFecha, nuevaHora, nuevoMotivo, nuevoEspecialista, nuevasObservaciones, nuevoEstado, idCita);

    const citaActualizada = await base_datos.prepare(`
      SELECT 
        c.id, c.contacto_id, c.optica_id, c.fecha_cita, c.hora_cita, c.motivo, c.especialista, c.observaciones,
        COALESCE(c.estado, 'pendiente') AS estado, c.creado_en,
        co.nombre_completo AS contacto_nombre, co.telefono AS contacto_telefono, co.correo AS contacto_correo
      FROM citas c
      LEFT JOIN contactos co ON co.id = c.contacto_id
      WHERE c.id = ?
    `).get(idCita);

    res.json({ exito: true, cita: citaActualizada });
  } catch (error) {
    console.error('Error al actualizar cita:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Cancelar cita (marcar estado = cancelada)
app.delete('/api/citas/:id', async (req, res) => {
  try {
    const idCita = Number(req.params.id);
    if (!idCita) {
      return res.status(400).json({ exito: false, error: 'ID de cita inválido' });
    }
    await base_datos.prepare("UPDATE citas SET estado = 'cancelada' WHERE id = ?").run(idCita);
    res.json({ exito: true, mensaje: 'Cita cancelada con éxito' });
  } catch (error) {
    console.error('Error al cancelar cita:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// ============================================================================
// ENDPOINTS DE AUTO-SEGMENTACIÓN DE PACIENTES
// ============================================================================

// Obtener todos los segmentos visibles para la óptica activa (globales + propios) con conteo en vivo
app.get('/api/segmentos', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const resultado = await obtenerSegmentosConConteo(optica_id);
    res.json({
      exito: true,
      segmentos: resultado.segmentos,
      total_pacientes_optica: resultado.total_pacientes_optica,
      total_pacientes_calificados_unicos: resultado.total_pacientes_calificados_unicos,
    });
  } catch (error) {
    console.error('Error al obtener segmentos:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Obtener pacientes asociados a un segmento
app.get('/api/segmentos/:id/pacientes', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const { id } = req.params;
    const resultado = await obtenerPacientesDeSegmento(id, optica_id);
    res.json({ exito: true, ...resultado });
  } catch (error) {
    console.error('Error al obtener pacientes del segmento:', error);
    res.status(error.message.includes('sin permisos') ? 403 : 500).json({ exito: false, error: error.message });
  }
});

// Crear nuevo segmento personalizado para la óptica activa
app.post('/api/segmentos', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const { nombre, descripcion, icono, color, criterios } = req.body;
    const nuevoSegmento = await crearSegmentoPersonalizado({
      opticaId: optica_id,
      nombre,
      descripcion,
      icono,
      color,
      criterios,
    });
    res.status(201).json({ exito: true, segmento: nuevoSegmento });
  } catch (error) {
    console.error('Error al crear segmento:', error);
    res.status(400).json({ exito: false, error: error.message });
  }
});

// Actualizar segmento personalizado existente
app.put('/api/segmentos/:id', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const { id } = req.params;
    const { nombre, descripcion, icono, color, criterios } = req.body;
    const segmentoActualizado = await actualizarSegmentoPersonalizado({
      idSegmento: id,
      opticaId: optica_id,
      nombre,
      descripcion,
      icono,
      color,
      criterios,
    });
    res.json({ exito: true, segmento: segmentoActualizado });
  } catch (error) {
    console.error('Error al actualizar segmento:', error);
    res.status(400).json({ exito: false, error: error.message });
  }
});

// Eliminar segmento personalizado de la óptica activa
app.delete('/api/segmentos/:id', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const { id } = req.params;
    const resultado = await eliminarSegmentoPersonalizado(id, optica_id);
    res.json({ exito: true, ...resultado });
  } catch (error) {
    console.error('Error al eliminar segmento:', error);
    res.status(400).json({ exito: false, error: error.message });
  }
});

// ==================== ENDPOINTS DE PLANTILLAS Y ENVÍOS POR LOTES ====================

// Sincronizar manualmente plantillas con Zernio y Meta Cloud API
app.post('/api/plantillas/sincronizar-meta', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const resultado = await sincronizarPlantillasConZernio(optica_id);
    const plantillas = await obtenerPlantillas(optica_id);
    const cuota = await obtenerCuotaDiaria(optica_id);
    res.json({ exito: true, ...resultado, plantillas, cuota });
  } catch (error) {
    console.error('Error al sincronizar plantillas con Meta:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Obtener todas las plantillas y la cuota diaria actual
app.get('/api/plantillas', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const plantillas = await obtenerPlantillas(optica_id);
    const cuota = await obtenerCuotaDiaria(optica_id);
    res.json({ exito: true, plantillas, cuota });
  } catch (error) {
    console.error('Error al obtener plantillas:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Crear una nueva plantilla oficial o personalizada
app.post('/api/plantillas', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const nuevaPlantilla = await crearPlantilla(optica_id, req.body);
    res.json({ exito: true, plantilla: nuevaPlantilla });
  } catch (error) {
    console.error('Error al crear plantilla:', error);
    res.status(400).json({ exito: false, error: error.message });
  }
});

// Subir archivo multimedia (imagen o video) para encabezado de plantilla a Supabase Storage y respaldo local
app.post('/api/plantillas/subir-multimedia', async (req, res) => {
  try {
    const { nombre, base64, mimeType } = req.body;
    if (!base64) {
      return res.status(400).json({ exito: false, error: 'No se envió contenido multimedia' });
    }

    const idOptica = Number(req.body.optica_id) || Number(req.optica_id) || 1;
    const extension = path.extname(nombre || 'archivo.jpg') || '.jpg';
    const nombreLimpio = (nombre || 'multimedia')
      .replace(extension, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const nombreArchivo = `${nombreLimpio}_${Date.now()}${extension}`;

    const datosBase64 = base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(datosBase64, 'base64');

    // 1. Subida directa a Supabase Storage en bucket exclusivo 'plantillas-multimedia' con subcarpeta optica_<numero>
    const supabaseUrl = process.env.SUPABASE_URL || 'https://jwctsfnkyfokrgtcjtxs.supabase.co';
    const supabaseKey =
      process.env.SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3Y3RzZm5reWZva3JndGNqdHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3OTE2NjgsImV4cCI6MjEwNjM2NzY2OH0.I5jL8UKofVyZCFqt2FxxqnTCxgmRNypoB3AsESKYNNo';
    const subcarpetaOptica = `optica_${idOptica}`;
    const rutaEnBucket = `${subcarpetaOptica}/${nombreArchivo}`;
    const tipoContenido =
      mimeType || (extension === '.png' ? 'image/png' : extension === '.mp4' ? 'video/mp4' : 'image/jpeg');

    let urlPublica = '';
    try {
      const urlSubida = `${supabaseUrl}/storage/v1/object/plantillas-multimedia/${rutaEnBucket}`;
      const respuestaStorage = await fetch(urlSubida, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': tipoContenido,
          'x-upsert': 'true',
        },
        body: buffer,
      });

      if (respuestaStorage.ok) {
        urlPublica = `${supabaseUrl}/storage/v1/object/public/plantillas-multimedia/${rutaEnBucket}`;
      } else {
        const errorTxt = await respuestaStorage.text();
        console.warn('Aviso: Supabase Storage respondió con error:', respuestaStorage.status, errorTxt);
      }
    } catch (errStorage) {
      console.warn('Aviso: No se pudo conectar con Supabase Storage:', errStorage.message);
    }

    // 2. Respaldo local en cliente/public/archivos_plantillas/optica_<id>/
    const carpetaOpticaLocal = path.join(
      process.cwd(),
      'cliente/public/archivos_plantillas',
      subcarpetaOptica
    );
    if (!fs.existsSync(carpetaOpticaLocal)) {
      fs.mkdirSync(carpetaOpticaLocal, { recursive: true });
    }
    const rutaLocal = path.join(carpetaOpticaLocal, nombreArchivo);
    await fs.promises.writeFile(rutaLocal, buffer);

    // Fallback a URL local si Supabase Storage no respondió
    if (!urlPublica) {
      urlPublica = `/archivos_plantillas/${subcarpetaOptica}/${nombreArchivo}`;
    }

    res.json({ exito: true, url: urlPublica, nombre: nombreArchivo });
  } catch (error) {
    console.error('Error al subir archivo multimedia:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Obtener cuota diaria de envíos
app.get('/api/plantillas/cuota-diaria', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const cuota = await obtenerCuotaDiaria(optica_id);
    res.json({ exito: true, cuota });
  } catch (error) {
    console.error('Error al obtener cuota diaria:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Calcular audiencia y tamaño de lote para una campaña
app.post('/api/plantillas/calcular-lote', async (req, res) => {
  try {
    const optica_id = req.body.optica_id || req.optica_id || 1;
    const { plantillaId, segmentoId, telefonosDirectos, diasExclusion } = req.body;
    const resultado = await calcularAudienciaLote(optica_id, {
      plantillaId,
      segmentoId,
      telefonosDirectos,
      diasExclusion,
    });
    res.json({ exito: true, ...resultado });
  } catch (error) {
    console.error('Error al calcular lote de plantilla:', error);
    res.status(400).json({ exito: false, error: error.message });
  }
});

// Lanzar el envío de un lote de campaña
app.post('/api/plantillas/lanzar-lote', async (req, res) => {
  try {
    const optica_id = req.body.optica_id || req.optica_id || 1;
    const resultado = await lanzarLoteCampana(optica_id, req.body);
    res.json({ exito: true, ...resultado });
  } catch (error) {
    console.error('Error al lanzar lote de campaña:', error);
    res.status(400).json({ exito: false, error: error.message });
  }
});

// Obtener historial de lotes lanzados
app.get('/api/plantillas/historial-lotes', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const historial = await obtenerHistorialLotes(optica_id);
    res.json({ exito: true, historial });
  } catch (error) {
    console.error('Error al obtener historial de lotes:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Eliminar registro de un lote de campaña
app.delete('/api/plantillas/lotes/:id', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const resultado = await eliminarLoteCampana(optica_id, req.params.id);
    res.json(resultado);
  } catch (error) {
    console.error('Error al eliminar lote de campaña:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// --- Rutas de Canales y Configuración ---

// Obtener estado de los canales y datos de la óptica
app.get('/api/canales/estado', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const resultado = await obtener_canales_optica(optica_id);
    res.json(resultado);
  } catch (error) {
    console.error('Error al obtener estado de canales:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Obtener URL de autorización para popup de WhatsApp
app.get('/api/canales/conectar/whatsapp', async (req, res) => {
  try {
    const optica_id = req.optica_id || 1;
    const url_redireccion = req.query.redirect_url || `${req.protocol}://${req.get('host')}/api/canales/callback`;
    const resultado = await obtener_url_conexion_whatsapp(optica_id, url_redireccion);
    res.json(resultado);
  } catch (error) {
    console.error('Error al generar URL de conexión:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Callback de retorno del popup de Zernio
app.get('/api/canales/callback', async (req, res) => {
  try {
    // Intentar auto-vincular la cuenta que se acaba de autorizar
    await vincular_cuenta_whatsapp_activa(1);
  } catch (e) {
    console.warn('Aviso en callback vincular:', e.message);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Conexión WhatsApp Exitosa</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: #0f172a;
          color: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          text-align: center;
        }
        .tarjeta {
          background: #1e293b;
          border: 1px solid #334155;
          padding: 2.5rem;
          border-radius: 16px;
          max-width: 380px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        .icono {
          width: 54px;
          height: 54px;
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.25rem;
          font-size: 28px;
        }
        h2 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #ffffff; }
        p { font-size: 0.85rem; color: #94a3b8; margin: 0; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="tarjeta">
        <div class="icono">✓</div>
        <h2>¡WhatsApp Vinculado!</h2>
        <p>Tu cuenta ha sido procesada con éxito. Cerrando esta ventana...</p>
      </div>
      <script>
        try {
          if (window.opener) {
            window.opener.postMessage({ tipo: 'CONEXION_WHATSAPP_EXITOSA' }, '*');
          }
        } catch (e) {
          console.error(e);
        }
        setTimeout(function() {
          window.close();
        }, 1200);
      </script>
    </body>
    </html>
  `);
});

// Forzar vinculación de cuenta activa tras OAuth
app.post('/api/canales/vincular', async (req, res) => {
  try {
    const optica_id = req.body.optica_id || req.optica_id || 1;
    const resultado = await vincular_cuenta_whatsapp_activa(optica_id);
    res.json(resultado);
  } catch (error) {
    console.error('Error al vincular cuenta activa:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Reconectar canal de WhatsApp
app.post('/api/canales/reconectar', async (req, res) => {
  try {
    const optica_id = req.body.optica_id || req.optica_id || 1;
    const resultado = await reconectar_canal_whatsapp(optica_id);
    res.json(resultado);
  } catch (error) {
    console.error('Error al reconectar canal:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Desconectar o desvincular canal de WhatsApp
app.post('/api/canales/desconectar', async (req, res) => {
  try {
    const optica_id = req.body.optica_id || req.optica_id || 1;
    const cambiar_numero = Boolean(req.body.cambiar_numero || req.body.eliminar_de_zernio);
    const resultado = await desconectar_canal_whatsapp(optica_id, { cambiar_numero });
    res.json(resultado);
  } catch (error) {
    console.error('Error al desconectar canal:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Listar ópticas activas con sus parámetros institucionales y clínicos
app.get('/api/opticas', async (req, res) => {
  try {
    const opticas = await base_datos.prepare(`
      SELECT 
        id, nombre, slug, logo_url, color_primario, color_secundario, telefono, activo,
        duracion_cita_minutos, control_meses_defecto, especialista_defecto,
        registro_profesional_defecto, motivo_cita_defecto, notificacion_auto_citas_whatsapp,
        hora_inicio_atencion, hora_fin_atencion
      FROM opticas
      WHERE activo = true
      ORDER BY id ASC
    `).all();
    res.json({ exito: true, opticas });
  } catch (error) {
    console.error('Error al listar ópticas:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Actualizar configuración general de la óptica
app.put('/api/configuracion/optica', async (req, res) => {
  try {
    const optica_id = Number(req.body.optica_id) || Number(req.optica_id) || 1;
    const resultado = await actualizar_datos_optica(optica_id, req.body);
    if (!resultado.exito) {
      return res.status(400).json(resultado);
    }
    res.json(resultado);
  } catch (error) {
    console.error('Error al actualizar configuración de la óptica:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Subir nuevo logo de óptica a Supabase Storage y eliminar el previo
app.post('/api/configuracion/optica/logo', async (req, res) => {
  try {
    const optica_id = Number(req.body.optica_id) || Number(req.optica_id) || 1;
    const { imagen_base64, tipo_mime, nombre_archivo } = req.body;

    if (!imagen_base64) {
      return res.status(400).json({ exito: false, error: 'Se requiere la imagen en formato base64' });
    }

    const base64Limpio = imagen_base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Limpio, 'base64');

    const resultado = await subir_logo_storage_optica(optica_id, {
      buffer,
      tipo_mime: tipo_mime || 'image/png',
      nombre_original: nombre_archivo || 'logo.png',
    });

    res.json(resultado);
  } catch (error) {
    console.error('Error al subir nuevo logotipo:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Iniciar el servidor
app.listen(PUERTO, () => {
  console.log(`\n🚀 Servidor CRM Óptica escuchando en http://localhost:${PUERTO}`);
  console.log(`📡 Endpoint de webhook Zernio listo en: POST http://localhost:${PUERTO}/api/webhook/zernio\n`);

  // Sincronización inicial suave 2 segundos tras levantar el servidor
  setTimeout(() => {
    sincronizar_conversaciones_zernio({ sincronizar_mensajes_profundo: true, max_conversaciones_mensajes: 10 }).catch((e) => {
      console.warn('Aviso: Sincronización inicial Zernio omitida:', e.message);
    });
  }, 2000);

  // Sincronización periódica activa cada 7 segundos para capturar mensajes casi en tiempo real
  setInterval(() => {
    sincronizar_conversaciones_zernio({ sincronizar_mensajes_profundo: true, max_conversaciones_mensajes: 6 }).catch((e) => {
      console.warn('Aviso en sincronización periódica Zernio:', e.message);
    });
  }, 7 * 1000);
});
