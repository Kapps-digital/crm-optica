import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, base_datos } from '../base_datos/conexion.mjs';
import { enviar_mensaje } from './gestor_mensajeria.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carga la plantilla de instrucciones del Agente desde el archivo Markdown central
 */
export function cargarPlantillaInstrucciones() {
  try {
    const rutasPosibles = [
      path.join(__dirname, '..', 'configuracion', 'instrucciones_agente.md'),
      path.join(process.cwd(), 'cliente', 'src', 'backend', 'configuracion', 'instrucciones_agente.md'),
      path.join(process.cwd(), 'src', 'backend', 'configuracion', 'instrucciones_agente.md'),
    ];
    for (const r of rutasPosibles) {
      if (fs.existsSync(/*turbopackIgnore: true*/ r)) {
        return fs.readFileSync(/*turbopackIgnore: true*/ r, 'utf-8');
      }
    }
  } catch (e) {
    console.warn('[Motor IA] Aviso al cargar instrucciones_agente.md:', e.message);
  }
  return null;
}

/**
 * Mapa de directivas de tono y estilo de comunicación para el Agente de IA.
 * Proporciona instrucciones completas a la IA según la selección del CRM sin mencionar productos no garantizados.
 */
export const MAPA_DIRECTIVAS_TONO_IA = {
  cercano:
    'Cálido, empático, atento y servicial. Exprésate con amabilidad y cercanía humana, haciendo sentir al cliente bienvenido y escuchado. Brinda orientación clara y sencilla sobre el cuidado de su visión y los servicios de la óptica, resolviendo sus dudas con paciencia, calidez y naturalidad.',
  formal:
    'Formal, respetuoso y profesional. Dirígete al paciente siempre de "Usted", manteniendo un trato sobrio, educado e institucional. Explica la información de salud visual y de la óptica de manera clara y fácil de entender para cualquier persona, sin tecnicismos complejos, transmitiendo seriedad y confianza.',
  comercial:
    'Comercial, dinámico, entusiasta y orientado a la acción. Destaca la importancia y los beneficios de cuidar la visión y renovar su salud visual a tiempo. Invita proactivamente al cliente a agendar su cita y a visitar la óptica para conocer las opciones disponibles, con mensajes ágiles, motivadores y llamados a la acción claros.',
};

export function obtenerDirectivaTonoIA(tono) {
  const t = String(tono || 'cercano').trim().toLowerCase();
  return MAPA_DIRECTIVAS_TONO_IA[t] || MAPA_DIRECTIVAS_TONO_IA.cercano;
}

/**
 * Motor del Agente de Inteligencia Artificial para CRM Óptica.
 * Procesa mensajes de clientes mediante OpenAI oficial (GPT-4o mini) o Google Gemini
 * con temperatura 0.0, inyección de contexto de seguridad y Function Calling para agendar citas.
 */

const URL_OPENAI_COMPLETIONS = 'https://api.openai.com/v1/chat/completions';

/**
 * Registra el consumo de tokens de una interacción de IA en la base de datos
 */
export async function registrarConsumoIA({
  optica_id,
  conversacion_id = null,
  mensaje_id = null,
  modelo,
  tokens_entrada = 0,
  tokens_salida = 0,
  tokens_totales = 0,
  tipo_evento = 'chat_whatsapp',
}) {
  try {
    const entrada = Math.max(0, Number(tokens_entrada) || 0);
    let salida = Math.max(0, Number(tokens_salida) || 0);
    let totales = Number(tokens_totales) || 0;

    // Si la API reporta totales mayores que entrada + salida (ej: tokens de razonamiento/thinking de Gemini 2.0 Flash),
    // atribuimos la diferencia a salida para que la suma siempre sea matemáticamente exacta (entrada + salida = totales)
    if (totales > (entrada + salida)) {
      salida = totales - entrada;
    } else if (totales === 0 || totales < (entrada + salida)) {
      totales = entrada + salida;
    }

    await pool.query(
      `INSERT INTO "CRM_Opticas".consumo_ia 
        (optica_id, conversacion_id, mensaje_id, modelo, tokens_entrada, tokens_salida, tokens_totales, tipo_evento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        Number(optica_id) || 1,
        conversacion_id ? Number(conversacion_id) : null,
        mensaje_id ? Number(mensaje_id) : null,
        modelo || 'desconocido',
        entrada,
        salida,
        totales,
        tipo_evento || 'chat_whatsapp',
      ]
    );
  } catch (err) {
    console.error('[Consumo IA] Error al registrar consumo en BD:', err.message);
  }
}

/**
 * Obtiene métricas agregadas, tendencia diaria e historial de consumo de tokens
 * con soporte para filtrado por óptica, rango de fechas y tipo de evento
 */
export async function obtenerMetricasConsumoIA(argumentoOpciones = {}) {
  try {
    const opciones =
      typeof argumentoOpciones === 'object' && argumentoOpciones !== null
        ? argumentoOpciones
        : { optica_id: argumentoOpciones };

    const { optica_id = null, desde = null, hasta = null, tipo_evento = null, modelo = null } = opciones;

    const condiciones = [];
    const parametros = [];
    let contador = 0;

    if (optica_id && optica_id !== 'todas') {
      contador++;
      condiciones.push(`c.optica_id = $${contador}`);
      parametros.push(Number(optica_id));
    }

    if (desde) {
      contador++;
      condiciones.push(`c.creado_en >= $${contador}::timestamp`);
      parametros.push(desde);
    }

    if (hasta) {
      contador++;
      condiciones.push(`c.creado_en <= ($${contador}::timestamp + interval '1 day' - interval '1 second')`);
      parametros.push(hasta);
    }

    if (tipo_evento && tipo_evento !== 'todos') {
      contador++;
      condiciones.push(`c.tipo_evento = $${contador}`);
      parametros.push(tipo_evento);
    }

    if (modelo && modelo !== 'todos') {
      contador++;
      condiciones.push(`c.modelo = $${contador}`);
      parametros.push(modelo);
    }

    const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const sqlResumen = `
      SELECT 
        COUNT(*)::int AS total_mensajes_respondidos,
        COUNT(DISTINCT c.conversacion_id)::int AS total_conversaciones,
        COALESCE(SUM(c.tokens_entrada), 0)::bigint AS total_tokens_entrada,
        COALESCE(SUM(c.tokens_salida), 0)::bigint AS total_tokens_salida,
        COALESCE(SUM(c.tokens_totales), 0)::bigint AS total_tokens_acumulados,
        COALESCE(ROUND(AVG(c.tokens_entrada), 1), 0)::numeric AS promedio_tokens_entrada,
        COALESCE(ROUND(AVG(c.tokens_salida), 1), 0)::numeric AS promedio_tokens_salida,
        COALESCE(ROUND(AVG(c.tokens_totales), 1), 0)::numeric AS promedio_tokens_totales
      FROM "CRM_Opticas".consumo_ia c
      ${clausulaWhere}
    `;

    const resTotales = await pool.query(sqlResumen, parametros);

    const sqlTendencia = `
      SELECT 
        TO_CHAR(c.creado_en, 'YYYY-MM-DD') AS fecha,
        COUNT(*)::int AS total_mensajes,
        COALESCE(SUM(c.tokens_entrada), 0)::bigint AS tokens_entrada,
        COALESCE(SUM(c.tokens_salida), 0)::bigint AS tokens_salida,
        COALESCE(SUM(c.tokens_totales), 0)::bigint AS tokens_totales
      FROM "CRM_Opticas".consumo_ia c
      ${clausulaWhere}
      GROUP BY TO_CHAR(c.creado_en, 'YYYY-MM-DD')
      ORDER BY fecha ASC
      LIMIT 60
    `;

    const resTendencia = await pool.query(sqlTendencia, parametros);

    const sqlHistorial = `
      SELECT 
        c.id, c.optica_id, o.nombre AS nombre_optica,
        c.conversacion_id, c.mensaje_id, c.modelo,
        c.tokens_entrada, c.tokens_salida, c.tokens_totales,
        c.tipo_evento, c.creado_en
      FROM "CRM_Opticas".consumo_ia c
      LEFT JOIN "CRM_Opticas".opticas o ON o.id = c.optica_id
      ${clausulaWhere}
      ORDER BY c.creado_en DESC
      LIMIT 50
    `;

    const resHistorial = await pool.query(sqlHistorial, parametros);

    // Obtener catálogo de modelos registrados en el historial de consumo
    const resModelos = await pool.query(`
      SELECT DISTINCT modelo 
      FROM "CRM_Opticas".consumo_ia 
      WHERE modelo IS NOT NULL AND modelo != '' 
      ORDER BY modelo ASC
    `);
    const modelosDisponibles = resModelos.rows.map((r) => r.modelo);

    // Obtener catálogo de tipos de evento / orígenes registrados en el historial de consumo
    const resTiposEvento = await pool.query(`
      SELECT DISTINCT tipo_evento 
      FROM "CRM_Opticas".consumo_ia 
      WHERE tipo_evento IS NOT NULL AND tipo_evento != '' 
      ORDER BY tipo_evento ASC
    `);
    const tiposEventoDisponibles = resTiposEvento.rows.map((r) => r.tipo_evento);

    return {
      resumen: resTotales.rows[0] || {
        total_mensajes_respondidos: 0,
        total_conversaciones: 0,
        total_tokens_entrada: 0,
        total_tokens_salida: 0,
        total_tokens_acumulados: 0,
        promedio_tokens_entrada: 0,
        promedio_tokens_salida: 0,
        promedio_tokens_totales: 0,
      },
      tendencia_diaria: resTendencia.rows || [],
      historial: resHistorial.rows || [],
      modelos_disponibles: modelosDisponibles,
      tipos_evento_disponibles: tiposEventoDisponibles,
    };
  } catch (error) {
    console.error('[Consumo IA] Error al obtener métricas de consumo:', error.message);
    return {
      resumen: {
        total_mensajes_respondidos: 0,
        total_conversaciones: 0,
        total_tokens_entrada: 0,
        total_tokens_salida: 0,
        total_tokens_acumulados: 0,
        promedio_tokens_entrada: 0,
        promedio_tokens_salida: 0,
        promedio_tokens_totales: 0,
      },
      tendencia_diaria: [],
      historial: [],
    };
  }
}

/**
 * Obtiene la configuración de IA de una óptica
 */
export async function obtenerConfiguracionIA(opticaId) {
  const idOpticaNumerico = Number(opticaId) || 1;
  const res = await pool.query(
    `SELECT id, nombre, ia_activa, COALESCE(ia_habilitada, true) AS ia_habilitada, ia_nombre, ia_tono, ia_instrucciones, 
            ia_preguntas_frecuentes, ia_modelo,
            dias_atencion, hora_inicio_atencion, hora_fin_atencion, duracion_cita_minutos,
            especialista_defecto, motivo_cita_defecto
     FROM "CRM_Opticas".opticas 
     WHERE id = $1`,
    [idOpticaNumerico]
  );

  const modeloEnv = (process.env.IA_MODELO || 'gpt-4o-mini').trim();
  const apiKeyEnv = (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '').trim();

  if (res.rows.length === 0) {
    return {
      ia_habilitada: false,
      ia_activa: false,
      ia_nombre: 'Asistente Óptico',
      ia_tono: 'cercano',
      ia_instrucciones: '',
      ia_preguntas_frecuentes: '',
      ia_api_key: apiKeyEnv,
      ia_modelo: modeloEnv,
    };
  }

  const row = res.rows[0];
  return {
    ...row,
    ia_habilitada: row.ia_habilitada !== false,
    ia_activa: Boolean(row.ia_activa),
    ia_nombre: row.ia_nombre || 'Asistente Óptico',
    ia_tono: row.ia_tono || 'cercano',
    ia_instrucciones: row.ia_instrucciones || '',
    ia_preguntas_frecuentes: row.ia_preguntas_frecuentes || '',
    ia_api_key: apiKeyEnv,
    ia_modelo: row.ia_modelo || modeloEnv,
  };
}

/**
 * Guarda la configuración de IA de una óptica
 */
export async function guardarConfiguracionIA(opticaId, datos) {
  const idOpticaNumerico = Number(opticaId) || 1;
  const {
    ia_activa,
    ia_nombre,
    ia_tono,
    ia_instrucciones,
    ia_preguntas_frecuentes,
    ia_modelo,
  } = datos;

  const estadoActivo = Boolean(ia_activa);
  const modeloFinal = (ia_modelo || process.env.IA_MODELO || 'gpt-4o-mini').trim();

  // 1. Actualizar configuración específica de la óptica (nombre, tono, instrucciones, FAQ)
  await pool.query(
    `UPDATE "CRM_Opticas".opticas
     SET ia_activa = $1,
         ia_nombre = $2,
         ia_tono = $3,
         ia_instrucciones = $4,
         ia_preguntas_frecuentes = $5
     WHERE id = $6`,
    [
      estadoActivo,
      (ia_nombre || 'Asistente Óptico').trim(),
      (ia_tono || 'cercano').trim(),
      ia_instrucciones || '',
      ia_preguntas_frecuentes || '',
      idOpticaNumerico,
    ]
  );

  // 2. El modelo de IA es una directiva GLOBAL: se actualiza en TODAS las ópticas del sistema
  if (ia_modelo) {
    await pool.query(
      `UPDATE "CRM_Opticas".opticas
       SET ia_modelo = $1`,
      [modeloFinal]
    );
  }

  // Sincronización masiva con todas las conversaciones de esta óptica:
  // Si se activa globalmente, se activa en todos los chats y se despausa.
  // Si se desactiva globalmente, se desactiva en todos los chats de inmediato.
  await pool.query(
    `UPDATE "CRM_Opticas".conversaciones
     SET ia_activa = $1,
         ia_pausada_por_humano = $2,
         actualizado_en = NOW()
     WHERE optica_id = $3`,
    [estadoActivo, !estadoActivo, idOpticaNumerico]
  );

  return { exito: true, ia_activa: estadoActivo };
}

/**
 * Alterna el estado del agente IA en una conversación específica
 */
export async function alternarEstadoIAChat(conversacionId, activo) {
  const idConv = Number(conversacionId);
  const estadoActivo = Boolean(activo);
  await pool.query(
    `UPDATE "CRM_Opticas".conversaciones
     SET ia_activa = $1,
         ia_pausada_por_humano = $2,
         actualizado_en = NOW()
     WHERE id = $3`,
    [estadoActivo, !estadoActivo, idConv]
  );
  return { exito: true, ia_activa: estadoActivo };
}

/**
 * Obtiene los motivos de citas configurados para la óptica (dinámicos desde BD o catálogo oficial)
 */
export async function obtenerMotivosDisponiblesOpticaBD(opticaId) {
  try {
    const res = await pool.query(
      `SELECT motivos_citas_json, motivo_cita_defecto FROM "CRM_Opticas".opticas WHERE id = $1`,
      [opticaId]
    );
    const fila = res.rows[0];
    let lista = null;
    if (fila?.motivos_citas_json) {
      try {
        const p = typeof fila.motivos_citas_json === 'string'
          ? JSON.parse(fila.motivos_citas_json)
          : fila.motivos_citas_json;
        if (Array.isArray(p) && p.length > 0) lista = p;
      } catch {}
    }
    if (!lista || lista.length === 0) {
      lista = [
        'Examen Visual y Control Anual',
        'Primera Vez - Examen Computarizado',
        'Adaptación de Lentes de Contacto',
        'Control de Miopía y Astigmatismo',
        'Revisión de Montura y Graduación',
        'Molestia Ocular / Urgencia Visual',
      ];
    }
    return lista;
  } catch (e) {
    console.warn('[Motor IA] Aviso al obtener motivos de citas:', e.message);
    return [
      'Examen Visual y Control Anual',
      'Primera Vez - Examen Computarizado',
      'Adaptación de Lentes de Contacto',
      'Control de Miopía y Astigmatismo',
      'Revisión de Montura y Graduación',
      'Molestia Ocular / Urgencia Visual',
    ];
  }
}

/**
 * Genera ranuras de horario disponibles para una fecha específica respetando jornada y horario hábil
 */
export async function obtenerHorariosDisponibles(opticaId, fechaStr, jornada = 'todas') {
  const resOptica = await pool.query(
    `SELECT hora_inicio_atencion, hora_fin_atencion, duracion_cita_minutos 
     FROM "CRM_Opticas".opticas WHERE id = $1`,
    [opticaId]
  );

  const duracionMin = resOptica.rows[0]?.duracion_cita_minutos || 30;
  const horaInicioStr = resOptica.rows[0]?.hora_inicio_atencion || '08:00 AM';
  const horaFinStr = resOptica.rows[0]?.hora_fin_atencion || '06:00 PM';

  // Convertir string hora (ej "08:00 AM" o "18:00") a minutos desde medianoche
  const convertirAMinutos = (hStr) => {
    const match = hStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!match) return 8 * 60;
    let horas = parseInt(match[1], 10);
    const minutos = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && horas < 12) horas += 12;
    if (ampm === 'AM' && horas === 12) horas = 0;
    return horas * 60 + minutos;
  };

  const minInicio = convertirAMinutos(horaInicioStr);
  const minFin = convertirAMinutos(horaFinStr);

  // Obtener citas ocupadas ese día
  const resCitas = await pool.query(
    `SELECT hora_cita FROM "CRM_Opticas".citas 
     WHERE optica_id = $1 AND fecha_cita = $2 AND estado != 'cancelada'`,
    [opticaId, fechaStr]
  );

  const horasOcupadas = new Set(
    resCitas.rows.map((r) => (r.hora_cita || '').trim().toLowerCase())
  );

  const formatearMinutos = (totalMin) => {
    let h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // Si la fecha consultada es HOY en Colombia, descartar horas pasadas o inmediatas
  const hoyStr = obtenerFechaHoyColombia();
  let limiteMinutosHoy = -1;
  if (fechaStr === hoyStr) {
    const ahora = new Date();
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(ahora);
    const hActual = parseInt(partes.find((p) => p.type === 'hour')?.value || '0', 10);
    const mActual = parseInt(partes.find((p) => p.type === 'minute')?.value || '0', 10);
    // Margen mínimo de 25 minutos: si son las 10:03, límite es 10:28 (mínimo ofrecible 10:30)
    limiteMinutosHoy = hActual * 60 + mActual + 25;
  }

  // Divisoria canónica: Mañana (antes de 01:00 PM / 780 min), Tarde (01:00 PM / 780 min en adelante)
  const MINUTOS_CORTE_TARDE = 13 * 60;

  const horariosManana = [];
  const horariosTarde = [];

  for (let m = minInicio; m < minFin; m += duracionMin) {
    // Si la fecha es hoy y la hora ya pasó o el paciente no alcanza a llegar, descartar
    if (limiteMinutosHoy > 0 && m < limiteMinutosHoy) {
      continue;
    }

    const texto12 = formatearMinutos(m);
    const horaNorm = texto12.toLowerCase();
    if (!horasOcupadas.has(horaNorm)) {
      if (m < MINUTOS_CORTE_TARDE) {
        horariosManana.push(texto12);
      } else {
        horariosTarde.push(texto12);
      }
    }
  }

  let seleccion = [];
  const jNorm = String(jornada || 'todas').toLowerCase();
  if (jNorm === 'manana' || jNorm === 'mañana') {
    seleccion = horariosManana;
  } else if (jNorm === 'tarde') {
    seleccion = horariosTarde;
  } else {
    seleccion = [...horariosManana, ...horariosTarde];
  }

  return {
    fecha: fechaStr,
    es_hoy: fechaStr === hoyStr,
    jornada_solicitada: jornada,
    horarios_manana: horariosManana,
    horarios_tarde: horariosTarde,
    horarios_disponibles: seleccion,
    total_disponibles: seleccion.length,
    hay_manana: horariosManana.length > 0,
    hay_tarde: horariosTarde.length > 0,
  };
}

/**
 * Convierte cualquier fecha YYYY-MM-DD a formato DD/MM/YYYY
 */
export function formatearFechaDDMMYYYY(fechaStr) {
  if (!fechaStr) return '';
  const str = String(fechaStr).trim();
  if (str.includes('-')) {
    const partes = str.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
  }
  return str;
}

/**
 * Obtiene la fecha actual en zona horaria de Colombia en formato YYYY-MM-DD
 */
export function obtenerFechaHoyColombia() {
  const d = new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/**
 * Sanitiza texto Markdown eliminando dobles asteriscos para que WhatsApp
 * muestre negritas limpias sin asteriscos sueltos (*palabra*, nunca **palabra**)
 */
export function sanitizarMarkdownParaWhatsApp(texto) {
  if (!texto || typeof texto !== 'string') return '';
  // Convertir dobles asteriscos **palabra** a *palabra*
  let res = texto.replace(/\*\*([^\n*]+?)\*\*/g, '*$1*');
  // Reemplazar dobles asteriscos residuales por uno solo
  res = res.replace(/\*\*/g, '*');
  return res;
}

/**
 * Determina si una cadena representa un nombre real de persona.
 * Si es un número telefónico, handle de usuario ('@...', 'user_...'), "Contacto +...", etc., retorna null.
 */
export function extraerNombrePersonaValido(nombre) {
  if (!nombre || typeof nombre !== 'string') return null;
  const limpio = nombre.trim();
  if (!limpio) return null;

  // 1. Descartar patrones de sistema o canal
  if (/^contacto\s*\+?\d+/i.test(limpio)) return null;
  if (/^paciente(\s*sin\s*nombre)?$/i.test(limpio)) return null;
  if (/^sin\s*nombre$/i.test(limpio)) return null;
  if (/^usuario$/i.test(limpio)) return null;

  // 2. Descartar handles o identificadores de usuario técnicos
  if (/^@|^user_|^wa_|^co\.\d+/i.test(limpio)) return null;

  // 3. Descartar si son puros dígitos o símbolos telefónicos
  const soloLetras = limpio.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, '');
  if (soloLetras.length < 2) return null;

  // 4. Descartar si contiene secuencias telefónicas largas (>= 7 dígitos)
  const soloDigitos = limpio.replace(/\D/g, '');
  if (soloDigitos.length >= 7) return null;

  return limpio;
}

/**
 * Construye el mensaje estructurado canónico de cita para WhatsApp (idéntico a la plantilla CRM)
 */
export function construirMensajeCitaWhatsApp({
  tipo = 'confirmacion', // 'confirmacion' | 'reprogramacion' | 'consulta'
  nombreOptica = 'Óptica',
  nombrePaciente = '',
  fecha,
  hora,
  motivo,
  especialista,
}) {
  const encabezado = (nombreOptica || 'Óptica').trim();
  const fechaVisual = formatearFechaDDMMYYYY(fecha);
  const espTexto = especialista && String(especialista).trim() !== '' ? String(especialista).trim() : 'Sin especialista';
  const motivoTexto = motivo && String(motivo).trim() !== '' ? String(motivo).trim() : 'Examen de optometría';
  const nombreValido = extraerNombrePersonaValido(nombrePaciente);

  let titulo = 'Confirmación de Cita';
  let saludo = nombreValido
    ? `Hola *${nombreValido}*, tu cita de optometría ha sido programada con éxito:`
    : `Hola, tu cita de optometría ha sido programada con éxito:`;

  if (tipo === 'reprogramacion') {
    titulo = 'Cita Reprogramada';
    saludo = nombreValido
      ? `Hola *${nombreValido}*, tu cita de optometría ha sido reprogramada con éxito:`
      : `Hola, tu cita de optometría ha sido reprogramada con éxito:`;
  } else if (tipo === 'consulta') {
    titulo = 'Cita Programada';
    saludo = nombreValido
      ? `Hola *${nombreValido}*, tienes la siguiente cita programada:`
      : `Hola, tienes la siguiente cita programada:`;
  }

  return [
    `🗓️ *${encabezado} - ${titulo}*`,
    saludo,
    ``,
    `📅 *Fecha:* ${fechaVisual}`,
    `⏰ *Hora:* ${hora}`,
    `🎯 *Motivo:* ${motivoTexto}`,
    `👨‍⚕️ *Especialista:* ${espTexto}`,
    ``,
    `📍 Te sugerimos presentarte 10 minutos antes. Si necesitas reprogramar, responde directamente a este chat.`,
  ].join('\n');
}

/**
 * Declaraciones de herramientas (Function Calling) en formato OpenAI
 */
const HERRAMIENTAS_OPENAI = [
  {
    type: 'function',
    function: {
      name: 'consultar_citas_paciente',
      description: 'Consulta únicamente las citas pendientes vigentes (de hoy en adelante) del paciente. Las citas pasadas ya no son relevantes y no deben mostrarse.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_horarios_disponibles',
      description: 'Consulta los horarios disponibles para agendar una cita en una fecha determinada.',
      parameters: {
        type: 'object',
        properties: {
          fecha: {
            type: 'string',
            description: 'Fecha deseada en formato YYYY-MM-DD (ejemplo: "2026-10-16").',
          },
        },
        required: ['fecha'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agendar_cita',
      description: 'Agenda y confirma una nueva cita en el CRM una vez que el cliente ha confirmado la fecha, la hora, el motivo de la consulta Y su nombre y apellido (en caso de no estar registrado como paciente). ¡ATENCIÓN!: NUNCA ejecutes esta herramienta sin haber confirmado previamente el motivo de la cita con el cliente, ni sin haberle pedido su nombre y apellido si el cliente no está registrado como paciente.',
      parameters: {
        type: 'object',
        properties: {
          fecha: {
            type: 'string',
            description: 'Fecha confirmada en formato YYYY-MM-DD.',
          },
          hora: {
            type: 'string',
            description: 'Hora confirmada (ejemplo: "10:30 AM" o "11:00 AM").',
          },
          motivo: {
            type: 'string',
            description: 'Motivo de la cita elegido o confirmado por el paciente (ejemplo: "Examen Visual y Control Anual", "Primera Vez - Examen Computarizado", "Adaptación de Lentes de Contacto", etc.). OBLIGATORIO.',
          },
          nombre_apellido: {
            type: 'string',
            description: 'Nombre y apellido completo del cliente proporcionados durante la conversación si el cliente no estaba previamente registrado como paciente en el sistema (ejemplo: "Carlos Mendoza").',
          },
        },
        required: ['fecha', 'hora', 'motivo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reprogramar_cita',
      description: 'Mueve o reprograma la cita pendiente existente de un paciente hacia una nueva fecha y hora CONFIRMADA por el paciente. ¡ATENCIÓN!: NUNCA ejecutes esta herramienta si el paciente solo mencionó el día sin confirmar la hora exacta. Primero pregúntale si prefiere jornada de mañana o tarde y espera su confirmación.',
      parameters: {
        type: 'object',
        properties: {
          cita_id: {
            type: 'number',
            description: 'ID de la cita a reprogramar (opcional, si se omite se reprograma la cita pendiente futura más próxima).',
          },
          nueva_fecha: {
            type: 'string',
            description: 'Nueva fecha acordada en formato YYYY-MM-DD.',
          },
          nueva_hora: {
            type: 'string',
            description: 'Nueva hora acordada y confirmada explícitamente por el paciente (ejemplo: "10:30 AM", "04:00 PM"). OBLIGATORIO.',
          },
          motivo: {
            type: 'string',
            description: 'Motivo de la cita (opcional, si se omite conserva el motivo anterior).',
          },
        },
        required: ['nueva_fecha', 'nueva_hora'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transferir_a_asesor',
      description: 'Transfiere de inmediato el chat a un asesor humano cuando: 1) El cliente solicite cotizaciones, precios de consultas/exámenes/lentes/monturas, stock, qué debe llevar o especificaciones técnicas de exámenes o productos que NO estén explícitamente definidos en las instrucciones o preguntas frecuentes (FAQ) de la óptica; 2) El cliente realice una pregunta cuya información no esté en la base de datos o el sistema y la IA no pueda responder con certeza; 3) El paciente solicite expresamente hablar con un asesor o persona humana ("quiero hablar con un asesor", "pásame con alguien"); 4) Se presente una duda médica especializada o reclamo complejo. Marca el chat con alerta urgente en el CRM.',
      parameters: {
        type: 'object',
        properties: {
          motivo: {
            type: 'string',
            description: 'Motivo de la transferencia a asesor humano.',
          },
        },
        required: ['motivo'],
      },
    },
  },
];

/**
 * Ejecuta una herramienta llamada por el modelo de IA y retorna el resultado
 */
async function ejecutarHerramienta({ nombre, argumentos, opticaId, contactoId, conversacionId }) {
  if (nombre === 'consultar_citas_paciente') {
    const hoyStr = obtenerFechaHoyColombia();
    const res = await pool.query(
      `SELECT id, fecha_cita, hora_cita, motivo, especialista, estado 
       FROM "CRM_Opticas".citas 
       WHERE contacto_id = $1 AND optica_id = $2 
         AND estado NOT IN ('cancelada', 'completada')
         AND fecha_cita >= $3
       ORDER BY fecha_cita ASC, hora_cita ASC LIMIT 5`,
      [contactoId, opticaId, hoyStr]
    );

    if (res.rows.length === 0) {
      return { 
        tiene_citas: false, 
        mensaje: 'El paciente no tiene ninguna cita pendiente programada de hoy en adelante.' 
      };
    }

    const resOptica = await pool.query(`SELECT nombre FROM "CRM_Opticas".opticas WHERE id = $1`, [opticaId]);
    const nombreOptica = resOptica.rows[0]?.nombre || 'Óptica';

    const resContacto = await pool.query(`SELECT nombre_completo FROM "CRM_Opticas".contactos WHERE id = $1`, [contactoId]);
    const nombrePaciente = resContacto.rows[0]?.nombre_completo || 'Paciente';

    const citasFormateadas = res.rows.map((c) => ({
      id: c.id,
      fecha_iso: c.fecha_cita,
      fecha: formatearFechaDDMMYYYY(c.fecha_cita),
      hora: c.hora_cita,
      motivo: c.motivo || 'Examen de optometría',
      especialista: c.especialista || 'Sin especialista',
      estado: c.estado,
    }));

    const primeraCita = citasFormateadas[0];
    const mensajePreformateado = construirMensajeCitaWhatsApp({
      tipo: 'consulta',
      nombreOptica,
      nombrePaciente,
      fecha: primeraCita.fecha,
      hora: primeraCita.hora,
      motivo: primeraCita.motivo,
      especialista: primeraCita.especialista,
    });

    return {
      tiene_citas: true,
      citas: citasFormateadas,
      mensaje_whatsapp_preformateado: mensajePreformateado,
    };
  }

  if (nombre === 'consultar_horarios_disponibles') {
    const { fecha, jornada } = argumentos;
    const resultado = await obtenerHorariosDisponibles(opticaId, fecha, jornada);
    return resultado;
  }

  if (nombre === 'agendar_cita') {
    const { fecha, hora, motivo, nombre_apellido } = argumentos;
    const hoyStr = obtenerFechaHoyColombia();

    // Validar motivo obligatorio confirmado por el paciente
    if (!motivo || typeof motivo !== 'string' || motivo.trim() === '') {
      return {
        exito: false,
        error: 'No se puede agendar la cita porque no has confirmado el motivo con el paciente. Pregúntale amablemente cuál es el motivo de su visita ofreciéndole las opciones de la clínica antes de agendar.',
      };
    }

    // Validar que si es para hoy no sea una hora que ya pasó
    if (fecha === hoyStr && hora) {
      const ahora = new Date();
      const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Bogota',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }).formatToParts(ahora);
      const hAct = parseInt(partes.find((p) => p.type === 'hour')?.value || '0', 10);
      const mAct = parseInt(partes.find((p) => p.type === 'minute')?.value || '0', 10);
      const minActuales = hAct * 60 + mAct;

      const match = hora.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (match) {
        let horas = parseInt(match[1], 10);
        const minutos = parseInt(match[2], 10);
        const ampm = match[3]?.toUpperCase();
        if (ampm === 'PM' && horas < 12) horas += 12;
        if (ampm === 'AM' && horas === 12) horas = 0;
        const minHora = horas * 60 + minutos;
        if (minHora < minActuales + 20) {
          return {
            exito: false,
            error: `La hora ${hora} ya pasó o no permite tiempo de llegada para el día de hoy. Por favor ofrece una hora disponible posterior.`,
          };
        }
      }
    }

    // Verificar si ya existe cita a esa misma hora
    const resOcupado = await pool.query(
      `SELECT id FROM "CRM_Opticas".citas 
       WHERE optica_id = $1 AND fecha_cita = $2 AND LOWER(TRIM(hora_cita)) = LOWER(TRIM($3)) AND estado != 'cancelada'`,
      [opticaId, fecha, hora]
    );

    if (resOcupado.rows.length > 0) {
      return {
        exito: false,
        error: 'Ese horario ya ha sido reservado por otro paciente. Por favor ofrece otro horario.',
      };
    }

    // Obtener especialista predeterminado de la configuración de la óptica
    const resOptica = await pool.query(
      `SELECT nombre, especialista_defecto, motivo_cita_defecto FROM "CRM_Opticas".opticas WHERE id = $1`,
      [opticaId]
    );
    const espDefectoConfig = (resOptica.rows[0]?.especialista_defecto || '').trim();
    const espFinal = espDefectoConfig !== '' ? espDefectoConfig : null;
    const motivoFinal = motivo || resOptica.rows[0]?.motivo_cita_defecto || 'Primera Vez - Examen Computarizado';
    const nombreOptica = resOptica.rows[0]?.nombre || 'Óptica';

    const resContacto = await pool.query(`SELECT nombre_completo, es_paciente FROM "CRM_Opticas".contactos WHERE id = $1`, [contactoId]);
    let nombrePaciente = resContacto.rows[0]?.nombre_completo || 'Paciente';

    // Si el cliente suministró su nombre y apellido, actualizar su ficha en contactos
    if (nombre_apellido && typeof nombre_apellido === 'string' && nombre_apellido.trim() !== '') {
      const nombreLimpio = extraerNombrePersonaValido(nombre_apellido) || nombre_apellido.trim();
      if (nombreLimpio) {
        await pool.query(
          `UPDATE "CRM_Opticas".contactos 
           SET nombre_completo = $1, es_paciente = TRUE 
           WHERE id = $2 AND (nombre_completo IS NULL OR nombre_completo = '' OR es_paciente IS NOT TRUE OR nombre_completo ILIKE 'Contacto %' OR nombre_completo ILIKE 'Paciente%')`,
          [nombreLimpio, contactoId]
        );
        nombrePaciente = nombreLimpio;
      }
    }

    const resInsert = await pool.query(
      `INSERT INTO "CRM_Opticas".citas 
        (contacto_id, optica_id, fecha_cita, hora_cita, motivo, especialista, estado, observaciones, creado_en)
       VALUES 
        ($1, $2, $3, $4, $5, $6, 'pendiente', 'Agendada automáticamente por el Asistente Virtual de IA vía WhatsApp', NOW())
       RETURNING id`,
      [contactoId, opticaId, fecha, hora, motivoFinal, espFinal]
    );

    const mensajeOficial = construirMensajeCitaWhatsApp({
      tipo: 'confirmacion',
      nombreOptica,
      nombrePaciente,
      fecha,
      hora,
      motivo: motivoFinal,
      especialista: espFinal,
    });

    return {
      exito: true,
      accion: 'cita_agendada',
      cita_id: resInsert.rows[0].id,
      fecha,
      hora,
      motivo: motivoFinal,
      especialista: espFinal || 'Sin especialista',
      estado: 'pendiente',
      mensaje_confirmacion_oficial: mensajeOficial,
    };
  }

  if (nombre === 'reprogramar_cita') {
    const { cita_id, nueva_fecha, nueva_hora, motivo } = argumentos;
    const hoyStr = obtenerFechaHoyColombia();

    // Validar hora obligatoria y confirmada
    if (!nueva_hora || typeof nueva_hora !== 'string' || nueva_hora.trim() === '') {
      return {
        exito: false,
        error: 'No se puede reprogramar la cita porque el paciente no ha confirmado la hora exacta. Pregúntale si prefiere en la mañana o en la tarde y ofrécele los horarios disponibles.',
      };
    }

    // Validar que si es hoy no sea una hora que ya pasó
    if (nueva_fecha === hoyStr) {
      const ahora = new Date();
      const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Bogota',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }).formatToParts(ahora);
      const hAct = parseInt(partes.find((p) => p.type === 'hour')?.value || '0', 10);
      const mAct = parseInt(partes.find((p) => p.type === 'minute')?.value || '0', 10);
      const minActuales = hAct * 60 + mAct;

      const match = nueva_hora.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (match) {
        let horas = parseInt(match[1], 10);
        const minutos = parseInt(match[2], 10);
        const ampm = match[3]?.toUpperCase();
        if (ampm === 'PM' && horas < 12) horas += 12;
        if (ampm === 'AM' && horas === 12) horas = 0;
        const minHora = horas * 60 + minutos;
        if (minHora < minActuales + 20) {
          return {
            exito: false,
            error: `La hora ${nueva_hora} ya pasó o no permite tiempo de llegada para el día de hoy. Por favor ofrece una hora disponible posterior.`,
          };
        }
      }
    }

    // 1. Localizar la cita que se va a mover
    let citaExistente = null;
    if (cita_id) {
      const resCita = await pool.query(
        `SELECT id, fecha_cita, hora_cita, motivo, especialista, estado
         FROM "CRM_Opticas".citas
         WHERE id = $1 AND contacto_id = $2 AND optica_id = $3`,
        [cita_id, contactoId, opticaId]
      );
      if (resCita.rows.length > 0) {
        citaExistente = resCita.rows[0];
      }
    }

    if (!citaExistente) {
      // Buscar la cita pendiente futura más próxima
      const resCitaProx = await pool.query(
        `SELECT id, fecha_cita, hora_cita, motivo, especialista, estado
         FROM "CRM_Opticas".citas
         WHERE contacto_id = $1 AND optica_id = $2
           AND estado NOT IN ('cancelada', 'completada')
           AND fecha_cita >= $3
         ORDER BY fecha_cita ASC, hora_cita ASC LIMIT 1`,
        [contactoId, opticaId, hoyStr]
      );
      if (resCitaProx.rows.length > 0) {
        citaExistente = resCitaProx.rows[0];
      }
    }

    if (!citaExistente) {
      return {
        exito: false,
        error: 'No se encontró ninguna cita pendiente para reprogramar. Ofrece al paciente agendar una nueva cita.',
      };
    }

    // 2. Verificar que el nuevo horario no esté ocupado por otra cita
    const resOcupado = await pool.query(
      `SELECT id FROM "CRM_Opticas".citas 
       WHERE optica_id = $1 AND fecha_cita = $2 
         AND LOWER(TRIM(hora_cita)) = LOWER(TRIM($3)) 
         AND estado != 'cancelada'
         AND id != $4`,
      [opticaId, nueva_fecha, nueva_hora, citaExistente.id]
    );

    if (resOcupado.rows.length > 0) {
      return {
        exito: false,
        error: 'Ese horario ya está ocupado por otra cita en esa fecha. Por favor ofrece otro horario disponible al paciente.',
      };
    }

    // 3. Determinar especialista:
    // Si la óptica tiene Especialista Principal configurado en parámetros clínicos, se usa ese.
    // De lo contrario se deja en blanco (null / Sin especialista).
    const resOptica = await pool.query(
      `SELECT nombre, especialista_defecto, motivo_cita_defecto FROM "CRM_Opticas".opticas WHERE id = $1`,
      [opticaId]
    );
    const espDefectoConfig = (resOptica.rows[0]?.especialista_defecto || '').trim();
    const espFinal = espDefectoConfig !== '' ? espDefectoConfig : null;
    const motivoFinal = motivo || citaExistente.motivo || resOptica.rows[0]?.motivo_cita_defecto || 'Primera Vez - Examen Computarizado';
    const nombreOptica = resOptica.rows[0]?.nombre || 'Óptica';

    const resContacto = await pool.query(`SELECT nombre_completo FROM "CRM_Opticas".contactos WHERE id = $1`, [contactoId]);
    const nombrePaciente = resContacto.rows[0]?.nombre_completo || 'Paciente';

    // 4. Mover la cita existente (UPDATE directo sin duplicar)
    await pool.query(
      `UPDATE "CRM_Opticas".citas
       SET fecha_cita = $1,
           hora_cita = $2,
           especialista = $3,
           motivo = $4,
           estado = 'pendiente',
           observaciones = 'Reprogramada automáticamente por el Asistente Virtual de IA vía WhatsApp'
       WHERE id = $5`,
      [nueva_fecha, nueva_hora, espFinal, motivoFinal, citaExistente.id]
    );

    // 5. Construir mensaje oficial estructurado de reprogramación
    const mensajeOficial = construirMensajeCitaWhatsApp({
      tipo: 'reprogramacion',
      nombreOptica,
      nombrePaciente,
      fecha: nueva_fecha,
      hora: nueva_hora,
      motivo: motivoFinal,
      especialista: espFinal,
    });

    return {
      exito: true,
      accion: 'cita_reprogramada',
      cita_id: citaExistente.id,
      fecha_anterior: citaExistente.fecha_cita,
      nueva_fecha,
      nueva_hora,
      motivo: motivoFinal,
      especialista: espFinal || 'Sin especialista',
      estado: 'pendiente',
      mensaje_confirmacion_oficial: mensajeOficial,
    };
  }

  if (nombre === 'transferir_a_asesor') {
    const { motivo: motivoTransferencia } = argumentos || {};
    if (conversacionId) {
      await pool.query(
        `UPDATE "CRM_Opticas".conversaciones 
         SET requiere_asesor_humano = TRUE,
             ia_pausada_por_humano = TRUE,
             actualizado_en = NOW()
         WHERE id = $1`,
        [conversacionId]
      );
    }
    return {
      exito: true,
      accion: 'transferido_a_humano',
      motivo: motivoTransferencia || 'Solicitud de atención humana',
      mensaje: 'El caso ha sido marcado con alerta urgente y transferido a un asesor humano en el CRM.',
    };
  }

  return { error: `Herramienta desconocida: ${nombre}` };
}

/**
 * Detecta si una clave o modelo corresponde a Google Gemini oficial o a OpenAI oficial
 */
export function detectarProveedorIA(apiKey, modelo) {
  const clave = String(apiKey || '').trim();
  const mod = String(modelo || '').trim().toLowerCase();

  // 1. Si la clave o modelo es explícitamente de Google AI Studio / Gemini
  if (clave.startsWith('AQ.') || clave.startsWith('AIza') || mod.includes('gemini')) {
    return 'gemini';
  }

  // 2. Si la clave es de OpenAI oficial (sk-proj-... o sk-...)
  if (clave.startsWith('sk-proj-') || clave.startsWith('sk-')) {
    return 'openai';
  }

  // 3. Si el modelo es de OpenAI oficial directo (gpt-4o, gpt-4o-mini, etc.)
  if (mod.startsWith('gpt-') || mod.startsWith('o1') || mod.startsWith('o3')) {
    return 'openai';
  }

  // 4. Fallback según variables de entorno disponibles
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return 'openai';
}

/**
 * Mantiene compatibilidad con llamadas existentes
 */
export function esProveedorGemini(apiKey, modelo) {
  return detectarProveedorIA(apiKey, modelo) === 'gemini';
}

/**
 * Normaliza nombres de modelo para Google Gemini Oficial.
 * Si el modelo no es de Gemini o está vacío, retorna automáticamente
 * el modelo oficial activo 'gemini-2.5-flash'.
 */
export function normalizarModeloGemini(modelo) {
  const m = String(modelo || '').trim().toLowerCase();
  if (
    m === 'gemini-3.5-flash' ||
    m === 'gemini-3.1-flash-lite' ||
    m === 'gemini-flash-latest' ||
    m === 'gemini-2.5-flash' ||
    m === 'gemini-2.0-flash' ||
    m === 'gemini-1.5-flash'
  ) {
    return m;
  }
  if (m.startsWith('models/')) {
    const sinPrefijo = m.replace(/^models\//, '');
    if (sinPrefijo.includes('gemini')) return sinPrefijo;
  }
  if (m && m.includes('gemini') && !m.includes('/')) {
    return m;
  }
  return 'gemini-3.5-flash';
}

/**
 * Convierte un esquema de parámetros OpenAI a esquema de Google Gemini
 */
export function convertirSchemaAGemini(schema) {
  if (!schema) return { type: 'OBJECT', properties: {} };
  const res = {
    type: (schema.type || 'object').toUpperCase(),
    description: schema.description,
  };
  if (schema.properties) {
    res.properties = {};
    for (const [clave, prop] of Object.entries(schema.properties)) {
      res.properties[clave] = {
        type: (prop.type || 'string').toUpperCase(),
        description: prop.description,
      };
      if (prop.items) {
        res.properties[clave].items = {
          type: (prop.items.type || 'string').toUpperCase(),
        };
      }
    }
  }
  if (Array.isArray(schema.required) && schema.required.length > 0) {
    res.required = schema.required;
  }
  return res;
}

/**
 * Ejecuta la conversación y el ciclo de herramientas con la API oficial de Google Gemini
 */
async function ejecutarLlamadaGemini({
  apiKey,
  modelo,
  promptSistema,
  historialReverso,
  textoMensaje,
  esConsultaDisponibilidad,
  opticaId,
  contactoId,
  conversacionId,
}) {
  const herramientasGemini = [
    {
      functionDeclarations: HERRAMIENTAS_OPENAI.map((h) => ({
        name: h.function.name,
        description: h.function.description,
        parameters: convertirSchemaAGemini(h.function.parameters),
      })),
    },
  ];

  // Construir historial en formato de Gemini (roles: 'user' y 'model')
  const contents = [];
  for (const m of historialReverso) {
    contents.push({
      role: m.direccion === 'saliente' ? 'model' : 'user',
      parts: [{ text: m.texto }],
    });
  }

  // Refuerzo anti-memoria si el paciente consulta disponibilidad
  if (esConsultaDisponibilidad) {
    contents.push({
      role: 'user',
      parts: [{
        text: `[ALERTA DE SISTEMA: El paciente está consultando disponibilidad de horarios en este momento. DEBES llamar obligatoriamente a la herramienta "consultar_horarios_disponibles" para obtener los turnos reales vigentes de la clínica.]`,
      }],
    });
  }

  // Asegurar que el mensaje actual del usuario esté al final
  if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
    contents.push({
      role: 'user',
      parts: [{ text: textoMensaje }],
    });
  }

  // Regla estricta de Gemini API: el primer mensaje de contents debe tener rol 'user'
  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }
  if (contents.length === 0) {
    contents.push({
      role: 'user',
      parts: [{ text: textoMensaje }],
    });
  }

  // Lista de modelos ordenados con fallback automático ante errores 429, 503 o 404
  const modelosAProbar = [
    'gemini-flash-latest',
    'gemini-1.5-flash',
    normalizarModeloGemini(modelo),
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  let modeloElegido = modelosAProbar[0];
  let llamadasRestantes = 4;
  let respuestaFinalTexto = '';
  let ultimoMensajeConfirmacionOficial = null;

  let totalTokensEntrada = 0;
  let totalTokensSalida = 0;
  let totalTokens = 0;

  while (llamadasRestantes > 0) {
    llamadasRestantes--;

    let datosJson = null;
    let exitoPeticion = false;

    for (const mod of modelosAProbar) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: promptSistema }],
            },
            tools: herramientasGemini,
            generationConfig: {
              temperature: 0.0,
              maxOutputTokens: 1500,
            },
          }),
        });

        if (res.ok) {
          datosJson = await res.json();
          modeloElegido = mod;
          exitoPeticion = true;

          if (datosJson?.usageMetadata) {
            totalTokensEntrada += Number(datosJson.usageMetadata.promptTokenCount || 0);
            totalTokensSalida += Number(datosJson.usageMetadata.candidatesTokenCount || 0);
            totalTokens += Number(datosJson.usageMetadata.totalTokenCount || 0);
          }
          break;
        } else {
          const errTxt = await res.text();
          console.warn(`[Motor IA - Gemini] Modelo ${mod} devolvió ${res.status}:`, errTxt.slice(0, 150));
        }
      } catch (err) {
        console.warn(`[Motor IA - Gemini] Excepción al llamar a ${mod}:`, err.message);
      }
    }

    if (!exitoPeticion || !datosJson) {
      return {
        exito: false,
        error: 'No se obtuvo respuesta de los modelos oficiales de Google Gemini.',
      };
    }

    const candidato = datosJson.candidates?.[0];
    const contenidoCandidato = candidato?.content;
    if (!contenidoCandidato) {
      break;
    }

    const partesFunctionCall = contenidoCandidato.parts?.filter((p) => p.functionCall) || [];

    if (partesFunctionCall.length > 0) {
      contents.push(contenidoCandidato);

      for (const parteCall of partesFunctionCall) {
        const fnCall = parteCall.functionCall;
        const fnName = fnCall.name;
        const fnArgs = fnCall.args || {};

        console.log(`[Motor IA - Gemini (${modeloElegido})] Ejecutando herramienta ${fnName}:`, fnArgs);

        const resultadoHerramienta = await ejecutarHerramienta({
          nombre: fnName,
          argumentos: fnArgs,
          opticaId,
          contactoId,
          conversacionId,
        });

        if (resultadoHerramienta?.mensaje_confirmacion_oficial) {
          ultimoMensajeConfirmacionOficial = resultadoHerramienta.mensaje_confirmacion_oficial;
        }

        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: fnName,
                response: resultadoHerramienta,
              },
            },
          ],
        });
      }

      continue;
    }

    const partesTexto = contenidoCandidato.parts?.map((p) => p.text || '').join('').trim();
    if (partesTexto) {
      respuestaFinalTexto = partesTexto;
      break;
    }
  }

  return {
    exito: true,
    respuestaTexto: respuestaFinalTexto,
    ultimoMensajeConfirmacionOficial,
    modeloUsado: modeloElegido,
    consumoTokens: {
      tokens_entrada: totalTokensEntrada,
      tokens_salida: totalTokensSalida,
      tokens_totales: totalTokens > 0 ? totalTokens : (totalTokensEntrada + totalTokensSalida),
    },
  };
}

/**
 * Procesa un mensaje entrante de un paciente y genera una respuesta con OpenAI o Gemini
 */
export async function procesarMensajeConIA({ conversacion_id, mensaje_id, contacto_id, optica_id, texto_mensaje }) {
  if (!texto_mensaje || typeof texto_mensaje !== 'string' || texto_mensaje.trim() === '') {
    return { respondido: false, motivo: 'mensaje_vacio' };
  }

  // 1. Debounce de ráfagas de mensajes:
  // Si el paciente envía varios mensajes cortos seguidos (ej: "quisiera", "saber", "que citas tengo pendiente"),
  // esperamos 3.5 segundos para que termine de escribir. Si entra otro mensaje posterior, este hilo aborta.
  if (mensaje_id) {
    await new Promise((resolve) => setTimeout(resolve, 3500));

    try {
      const resUltimoMsg = await pool.query(
        `SELECT id FROM "CRM_Opticas".mensajes 
         WHERE conversacion_id = $1 AND direccion = 'entrante' 
         ORDER BY id DESC LIMIT 1`,
        [conversacion_id]
      );
      const idMasReciente = resUltimoMsg.rows[0]?.id;
      if (idMasReciente && Number(idMasReciente) > Number(mensaje_id)) {
        console.log(`[Motor IA] Mensaje ${mensaje_id} superado por mensaje más reciente ${idMasReciente} en conversación ${conversacion_id}. Omitiendo respuesta para consolidar ráfaga.`);
        return { respondido: false, motivo: 'rafaga_superada' };
      }
    } catch (e) {
      console.warn('[Motor IA] Aviso al verificar último mensaje:', e.message);
    }
  }

  // 2. Consolidar todos los mensajes entrantes de la ráfaga desde la última respuesta saliente
  let textoFinalParaIA = texto_mensaje;
  try {
    const resUltimoSaliente = await pool.query(
      `SELECT id FROM "CRM_Opticas".mensajes 
       WHERE conversacion_id = $1 AND direccion = 'saliente' 
       ORDER BY id DESC LIMIT 1`,
      [conversacion_id]
    );
    const idUltimoSaliente = resUltimoSaliente.rows[0]?.id || 0;

    const resRafaga = await pool.query(
      `SELECT texto FROM "CRM_Opticas".mensajes 
       WHERE conversacion_id = $1 AND direccion = 'entrante' AND id > $2 
         AND texto IS NOT NULL AND texto != '' AND texto != '[Unsupported message]'
       ORDER BY id ASC`,
      [conversacion_id, idUltimoSaliente]
    );

    if (resRafaga.rows.length > 0) {
      const fragmentos = resRafaga.rows.map((r) => r.texto.trim()).filter(Boolean);
      if (fragmentos.length > 1) {
        textoFinalParaIA = fragmentos.join(' ');
        console.log(`[Motor IA] Ráfaga consolidada (${fragmentos.length} mensajes): "${textoFinalParaIA}"`);
      }
    }
  } catch (e) {
    console.warn('[Motor IA] Aviso al consolidar ráfaga:', e.message);
  }

  // 3. Validar si la IA está contratada/habilitada y activa globalmente y para este chat
  const configOptica = await obtenerConfiguracionIA(optica_id);
  if (configOptica.ia_habilitada === false) {
    return { respondido: false, motivo: 'ia_no_habilitada_optica' };
  }
  if (!configOptica.ia_activa) {
    return { respondido: false, motivo: 'ia_inactiva_optica' };
  }

  const resConv = await pool.query(
    `SELECT id, ia_activa, ia_pausada_por_humano, contacto_id FROM "CRM_Opticas".conversaciones WHERE id = $1`,
    [conversacion_id]
  );
  if (resConv.rows.length === 0) {
    return { respondido: false, motivo: 'conversacion_no_encontrada' };
  }

  const conv = resConv.rows[0];
  if (conv.ia_activa === false || conv.ia_pausada_por_humano === true) {
    return { respondido: false, motivo: 'ia_pausada_en_chat' };
  }

  const modeloConfigurado = (configOptica.ia_modelo || process.env.IA_MODELO || 'gpt-4o-mini').trim();
  let apiKey = '';
  if (modeloConfigurado.startsWith('gpt-') || modeloConfigurado.startsWith('o1') || modeloConfigurado.startsWith('o3')) {
    apiKey = (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
  } else if (modeloConfigurado.includes('gemini')) {
    apiKey = (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
  } else {
    apiKey = (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
  }
  const proveedorDeseado = detectarProveedorIA(apiKey, modeloConfigurado);

  if (!apiKey) {
    console.warn(`[Motor IA] Óptica ${optica_id} tiene la IA activa pero no hay clave de API configurada (OPENAI_API_KEY / GEMINI_API_KEY) en variables de entorno.`);
    return { respondido: false, motivo: 'sin_clave_api' };
  }

  // Nombre comercial oficial dinámico de la óptica (sin nombres genéricos)
  const nombreOpticaReal = (configOptica.nombre || 'Tu Visión Óptica').trim();

  // 4. Obtener datos del paciente
  const idContacto = contacto_id || conv.contacto_id;
  const resContacto = await pool.query(
    `SELECT nombre_completo, telefono, es_paciente FROM "CRM_Opticas".contactos WHERE id = $1`,
    [idContacto]
  );
  const paciente = resContacto.rows[0] || {};
  const nombreRealPersona = extraerNombrePersonaValido(paciente.nombre_completo);
  const esPacienteRegistrado = Boolean(paciente.es_paciente && nombreRealPersona);

  let estadoPacienteRegistrado = '';
  if (esPacienteRegistrado) {
    estadoPacienteRegistrado = `SÍ, ES PACIENTE REGISTRADO (Nombre: *${nombreRealPersona}*). Ya se encuentra en el sistema; NO le pidas nombre ni apellido para agendar la cita; confirma y aparta la cita directamente con este nombre registrado.`;
  } else {
    estadoPacienteRegistrado = `NO ESTÁ REGISTRADO COMO PACIENTE (o no tiene nombre y apellido en el sistema). Para agendar una cita es OBLIGATORIO solicitarle amablemente su Nombre y Apellido completo antes de confirmar y llamar a la herramienta "agendar_cita".`;
  }

  // Regla estricta de trato según requerimiento del negocio:
  // Si tiene un nombre real de persona en WhatsApp/CRM, usar su nombre.
  // Si no tiene nombre real (o es un número telefónico/usuario técnico), omitir por completo el número y el usuario.
  let instruccionTratoNombre = '';
  if (nombreRealPersona) {
    instruccionTratoNombre = `El paciente se llama *${nombreRealPersona}*. Dirígete a él cordialmente por su nombre cuando lo saludes, te despidas o confirmes citas.`;
  } else {
    instruccionTratoNombre = `No se tiene registrado un nombre de persona real para este contacto. REGLA ESTRICTA DE IDENTIDAD: Está TERMINANTEMENTE PROHIBIDO dirigirte al cliente por su número de teléfono (ej: "Contacto +57...", "+57313..."), por su usuario o handle de WhatsApp o inventar nombres. OMITIR POR COMPLETO el nombre o número y salúdalo o despídete con amabilidad directa (ejemplos: "¡Hola! Bienvenido a ${nombreOpticaReal}...", "¡Con muchísimo gusto! En ${nombreOpticaReal} quedamos muy atentos ante cualquier otra consulta...").`;
  }

  // 5. Obtener citas pendientes vigentes del paciente (solo de hoy en adelante)
  const hoyStr = obtenerFechaHoyColombia();
  const resCitas = await pool.query(
    `SELECT fecha_cita, hora_cita, motivo, especialista, estado 
     FROM "CRM_Opticas".citas 
     WHERE contacto_id = $1 AND optica_id = $2 
       AND estado NOT IN ('cancelada', 'completada')
       AND fecha_cita >= $3
     ORDER BY fecha_cita ASC, hora_cita ASC LIMIT 5`,
    [idContacto, optica_id, hoyStr]
  );
  const citasTexto = resCitas.rows.length > 0
    ? resCitas.rows.map((c) => `- ${formatearFechaDDMMYYYY(c.fecha_cita)} a las ${c.hora_cita} (${c.motivo || 'Examen visual'}, Especialista: ${c.especialista || 'Sin especialista'}, Estado: ${c.estado})`).join('\n')
    : 'No registra citas pendientes programadas de hoy en adelante.';

  // 6. Obtener historial reciente del chat (últimos 6 mensajes)
  const resHistorial = await pool.query(
    `SELECT direccion, texto FROM "CRM_Opticas".mensajes 
     WHERE conversacion_id = $1 AND texto IS NOT NULL AND texto != '' AND texto != '[Unsupported message]'
     ORDER BY id DESC LIMIT 6`,
    [conversacion_id]
  );
  const historialReverso = resHistorial.rows.reverse();

  // 7. Construir System Prompt desde archivo Markdown central o plantilla
  const fechaHoy = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Bogota',
  });
  const horaActualColombia = new Date().toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const diasAtencion = configOptica.dias_atencion || 'Lunes a Domingo';
  const horaInicioAtencion = configOptica.hora_inicio_atencion || '08:00 AM';
  const horaFinAtencion = configOptica.hora_fin_atencion || configOptica.hora_final_atencion || '06:00 PM';
  const horarioAtencion = `${diasAtencion}, de ${horaInicioAtencion} a ${horaFinAtencion}`;
  const duracionConsulta = `${configOptica.duracion_cita_minutos || 30} minutos`;

  let promptSistemaFinal = '';
  const plantillaMd = cargarPlantillaInstrucciones();
  const motivosDisponibles = await obtenerMotivosDisponiblesOpticaBD(optica_id);
  const motivosTexto = motivosDisponibles.map((m, idx) => `${idx + 1}. *${m}*`).join('\n');

  if (plantillaMd) {
    promptSistemaFinal = plantillaMd
      .replace(/\{\{ia_nombre\}\}/g, configOptica.ia_nombre || 'Asistente')
      .replace(/\{\{nombre_optica\}\}/g, nombreOpticaReal)
      .replace(/\{\{fecha_hoy\}\}/g, fechaHoy)
      .replace(/\{\{hora_actual_colombia\}\}/g, horaActualColombia)
      .replace(/\{\{dias_atencion\}\}/g, diasAtencion)
      .replace(/\{\{hora_inicio_atencion\}\}/g, horaInicioAtencion)
      .replace(/\{\{hora_fin_atencion\}\}/g, horaFinAtencion)
      .replace(/\{\{horario_atencion\}\}/g, horarioAtencion)
      .replace(/\{\{duracion_consulta\}\}/g, duracionConsulta)
      .replace(/\{\{ia_tono\}\}/g, obtenerDirectivaTonoIA(configOptica.ia_tono))
      .replace(/\{\{nombre_paciente\}\}/g, nombreRealPersona || 'No identificado')
      .replace(/\{\{estado_paciente_registrado\}\}/g, estadoPacienteRegistrado)
      .replace(/\{\{instruccion_trato_nombre\}\}/g, instruccionTratoNombre)
      .replace(/\{\{motivos_cita_disponibles\}\}/g, motivosTexto)
      .replace(/\{\{citas_vigentes_texto\}\}/g, citasTexto)
      .replace(/\{\{ia_instrucciones\}\}/g, configOptica.ia_instrucciones || 'Atender con calidez.')
      .replace(/\{\{ia_preguntas_frecuentes\}\}/g, configOptica.ia_preguntas_frecuentes || 'Horario: ' + horarioAtencion);

    if (!nombreRealPersona) {
      promptSistemaFinal = promptSistemaFinal
        .replace(/Hola \*\{\{nombre_paciente\}\}\*,/g, 'Hola,')
        .replace(/Hola \*No identificado\*,/g, 'Hola,')
        .replace(/¡Hola, No identificado!/g, '¡Hola!')
        .replace(/¡Con muchísimo gusto, No identificado!/g, '¡Con muchísimo gusto!')
        .replace(/¡Con mucho gusto, No identificado!/g, '¡Con mucho gusto!');
    }
  } else {
    promptSistemaFinal = `Eres ${configOptica.ia_nombre}, el asistente virtual oficial de "${nombreOpticaReal}".
Fecha de hoy: ${fechaHoy}.
Hora actual en Colombia: ${horaActualColombia}.
Horario hábil de atención de la óptica: ${horarioAtencion}.
Duración estándar de cada consulta: ${duracionConsulta}.
Estado del paciente en el sistema: ${estadoPacienteRegistrado}.

REGLAS DE FORMATO Y REDACCIÓN (CRÍTICO PARA WHATSAPP):
1. IDENTIDAD INSTITUCIONAL: El nombre oficial y exclusivo de esta óptica es "${nombreOpticaReal}". Utiliza siempre este nombre oficial en tus saludos o menciones. NUNCA uses nombres genéricos como "la óptica" ni inventes nombres de otras empresas.
2. NEGRITAS: Utiliza EXCLUSIVAMENTE un solo asterisco a cada lado: *texto en negrita*.
3. AGENDAR CITA: Si el cliente NO es paciente registrado, debes pedirle obligatoriamente su Nombre y Apellido completo antes de agendar. Si ya es paciente registrado, NO se lo pidas y usa su nombre registrado. Confirma siempre motivo, fecha y hora antes de llamar a "agendar_cita".
4. COTIZACIONES, PRECIOS, EXÁMENES Y DUDAS SIN INFORMACIÓN: Si preguntan por cotizaciones, precios de consulta/exámenes/lentes/monturas, qué debe llevar para el examen, especificaciones técnicas de exámenes o productos, o cualquier pregunta que no tenga información en la base de datos o en FAQ, debes llamar obligatoriamente a "transferir_a_asesor".
5. CERO MEMORIA: NUNCA copies horarios de mensajes viejos del chat. Cada vez que pregunten horarios o disponibilidad, llama a "consultar_horarios_disponibles".
6. JORNADAS: Pregunta si prefieren en la mañana (antes de 1:00 PM) o tarde (1:00 PM a 6:00 PM).
7. HOY: Prohibido ofrecer horas pasadas.
8. REPROGRAMACIÓN: Prohibido auto-asignar hora sin confirmación explícita del paciente.
`;
  }

  const esConsultaDisponibilidad = /horario|disponib|citas?|cu[aá]ndo|agenda|de nuevo|libres?/i.test(textoFinalParaIA);
  const esGemini = esProveedorGemini(apiKey, modeloConfigurado);
  const modeloGeminiNormalizado = normalizarModeloGemini(modeloConfigurado);

  try {
    let respuestaFinalTexto = '';
    let ultimoMensajeConfirmacionOficial = null;
    let consumoTokensFinal = { tokens_entrada: 0, tokens_salida: 0, tokens_totales: 0 };
    let modeloFinalUtilizado = '';

    if (esGemini) {
      console.log(`[Motor IA] Procesando con Google Gemini Oficial (modelo: ${modeloGeminiNormalizado})`);
      const resGemini = await ejecutarLlamadaGemini({
        apiKey,
        modelo: modeloGeminiNormalizado,
        promptSistema: promptSistemaFinal,
        historialReverso,
        textoMensaje: textoFinalParaIA,
        esConsultaDisponibilidad,
        opticaId: optica_id,
        contactoId: idContacto,
        conversacionId: conversacion_id,
      });

      if (!resGemini.exito) {
        return { respondido: false, error: resGemini.error };
      }

      respuestaFinalTexto = resGemini.respuestaTexto || '';
      ultimoMensajeConfirmacionOficial = resGemini.ultimoMensajeConfirmacionOficial;
      modeloFinalUtilizado = resGemini.modeloUsado || modeloGeminiNormalizado;
      if (resGemini.consumoTokens) {
        consumoTokensFinal = resGemini.consumoTokens;
      }
    } else {
      // 6. Ensamblar contenido de conversación en formato OpenAI
      const messages = [
        { role: 'system', content: promptSistemaFinal },
      ];

      for (const m of historialReverso) {
        messages.push({
          role: m.direccion === 'saliente' ? 'assistant' : 'user',
          content: m.texto,
        });
      }

      if (esConsultaDisponibilidad) {
        messages.push({
          role: 'system',
          content: `ALERTA CRÍTICA: El paciente consulta disponibilidad u horarios en este momento. NUNCA respondas con listas de mensajes antiguos del chat ni digas "ya te mostré los horarios". DEBES invocar OBLIGATORIAMENTE la herramienta "consultar_horarios_disponibles" para obtener los horarios vigentes actualizados.`,
        });
      }

      if (messages.length === 1 || messages[messages.length - 1].role !== 'user') {
        messages.push({
          role: 'user',
          content: textoFinalParaIA,
        });
      }

      const modeloAInvocar = modeloConfigurado || 'gpt-4o-mini';
      modeloFinalUtilizado = modeloAInvocar;
      let llamadasRestantes = 3;

      while (llamadasRestantes > 0) {
        llamadasRestantes--;

        const cuerpoOpenAI = {
          model: modeloAInvocar,
          messages,
          tools: HERRAMIENTAS_OPENAI,
          tool_choice: 'auto',
          temperature: 0.0,
          max_completion_tokens: 1500,
        };

        if (modeloAInvocar.includes('luna') || modeloAInvocar.startsWith('o1') || modeloAInvocar.startsWith('o3')) {
          cuerpoOpenAI.reasoning_effort = 'none';
        }

        const respApi = await fetch(URL_OPENAI_COMPLETIONS, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(cuerpoOpenAI),
        });

        if (!respApi.ok) {
          const errorText = await respApi.text();
          console.error(`[Motor IA] Error de OpenAI API (${respApi.status}):`, errorText);
          return { respondido: false, error: `Error OpenAI ${respApi.status}` };
        }

        const datosJson = await respApi.json();
        if (datosJson?.usage) {
          consumoTokensFinal.tokens_entrada += Number(datosJson.usage.prompt_tokens || 0);
          consumoTokensFinal.tokens_salida += Number(datosJson.usage.completion_tokens || 0);
          consumoTokensFinal.tokens_totales += Number(datosJson.usage.total_tokens || 0);
        }

        const choice = datosJson.choices?.[0];
        const mensajeRespuesta = choice?.message;

        if (!mensajeRespuesta) {
          break;
        }

        if (mensajeRespuesta.tool_calls && mensajeRespuesta.tool_calls.length > 0) {
          messages.push(mensajeRespuesta);

          for (const call of mensajeRespuesta.tool_calls) {
            const fnName = call.function.name;
            let fnArgs = {};
            try {
              fnArgs = typeof call.function.arguments === 'string'
                ? JSON.parse(call.function.arguments)
                : (call.function.arguments || {});
            } catch (e) {
              console.error(`[Motor IA] Error al parsear argumentos de ${fnName}:`, e);
            }

            console.log(`[Motor IA] Ejecutando herramienta ${fnName} con args:`, fnArgs);

            const resultadoHerramienta = await ejecutarHerramienta({
              nombre: fnName,
              argumentos: fnArgs,
              opticaId: optica_id,
              contactoId: idContacto,
              conversacionId: conversacion_id,
            });

            if (resultadoHerramienta?.mensaje_confirmacion_oficial) {
              ultimoMensajeConfirmacionOficial = resultadoHerramienta.mensaje_confirmacion_oficial;
            }

            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(resultadoHerramienta),
            });
          }

          continue;
        }

        if (mensajeRespuesta.content) {
          respuestaFinalTexto = mensajeRespuesta.content.trim();
          break;
        }
      }
    }

    // Si se agendó o reprogramó con éxito, asegurar el envío del mensaje oficial canónico
    if (ultimoMensajeConfirmacionOficial) {
      respuestaFinalTexto = ultimoMensajeConfirmacionOficial;
    }

    if (!respuestaFinalTexto) {
      return { respondido: false, motivo: 'sin_texto_generado' };
    }

    // Sanitizar Markdown para WhatsApp (*negrita*, nunca **negrita**)
    const textoParaWhatsApp = sanitizarMarkdownParaWhatsApp(respuestaFinalTexto);

    // 7. Enviar respuesta por WhatsApp vía Zernio
    const resEnvio = await enviar_mensaje({
      conversacion_id,
      texto: textoParaWhatsApp,
      enviado_por_ia: true,
    });

    // 8. Registrar consumo de tokens en la base de datos de auditoría
    await registrarConsumoIA({
      optica_id,
      conversacion_id,
      mensaje_id,
      modelo: modeloFinalUtilizado,
      tokens_entrada: consumoTokensFinal.tokens_entrada,
      tokens_salida: consumoTokensFinal.tokens_salida,
      tokens_totales: consumoTokensFinal.tokens_totales,
      tipo_evento: 'chat_whatsapp',
    });

    // 9. Si la respuesta contiene indicación de transferencia a asesor humano, marcar como urgente y pausar IA
    const textoMinus = textoParaWhatsApp.toLowerCase();
    if (
      textoMinus.includes('asesor') ||
      textoMinus.includes('comunico con') ||
      textoMinus.includes('transfiero') ||
      textoMinus.includes('equipo humano') ||
      textoMinus.includes('humano')
    ) {
      await pool.query(
        `UPDATE "CRM_Opticas".conversaciones 
         SET requiere_asesor_humano = TRUE,
             ia_pausada_por_humano = TRUE,
             actualizado_en = NOW() 
         WHERE id = $1`,
        [conversacion_id]
      );
    }

    return {
      respondido: true,
      texto: textoParaWhatsApp,
      exito_envio: resEnvio.exito,
      consumo: consumoTokensFinal,
    };
  } catch (error) {
    console.error('[Motor IA] Excepción al procesar con IA:', error);
    return { respondido: false, error: error.message };
  }
}
