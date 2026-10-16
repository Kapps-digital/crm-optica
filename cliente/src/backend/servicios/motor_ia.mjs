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
 * Motor del Agente de Inteligencia Artificial para CRM Óptica.
 * Procesa mensajes de clientes mediante OpenRouter (DeepSeek, Llama, Gemini, etc.)
 * con temperatura 0.0, inyección de contexto de seguridad y Function Calling para agendar citas.
 */

const URL_OPENROUTER_COMPLETIONS = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Obtiene la configuración de IA de una óptica
 */
export async function obtenerConfiguracionIA(opticaId) {
  const idOpticaNumerico = Number(opticaId) || 1;
  const res = await pool.query(
    `SELECT id, nombre, ia_activa, ia_nombre, ia_tono, ia_instrucciones, 
            ia_preguntas_frecuentes,
            hora_inicio_atencion, hora_fin_atencion, duracion_cita_minutos,
            especialista_defecto, motivo_cita_defecto
     FROM "CRM_Opticas".opticas 
     WHERE id = $1`,
    [idOpticaNumerico]
  );

  const modeloEnv = (process.env.IA_MODELO || 'gemini-3.5-flash').trim();
  const apiKeyEnv = (process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || '').trim();

  if (res.rows.length === 0) {
    return {
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
    ia_activa: Boolean(row.ia_activa),
    ia_nombre: row.ia_nombre || 'Asistente Óptico',
    ia_tono: row.ia_tono || 'cercano',
    ia_instrucciones: row.ia_instrucciones || '',
    ia_preguntas_frecuentes: row.ia_preguntas_frecuentes || '',
    ia_api_key: apiKeyEnv,
    ia_modelo: modeloEnv,
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
  } = datos;

  const estadoActivo = Boolean(ia_activa);

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
 * Declaraciones de herramientas (Function Calling) en formato OpenAI / OpenRouter
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
      description: 'Agenda y confirma una nueva cita en el CRM una vez que el paciente ha confirmado la fecha, la hora Y el motivo de la consulta. ¡ATENCIÓN!: NUNCA ejecutes esta herramienta sin haber preguntado y confirmado previamente el motivo de la cita con el paciente ofreciéndole las opciones disponibles de la clínica.',
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
      description: 'Transfiere de inmediato el chat a un asesor humano cuando el paciente lo solicite expresamente ("quiero hablar con un asesor", "pásame con una persona") o cuando se presente una duda médica o situación que la IA no pueda responder. Marca el chat con alerta urgente en el CRM.',
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
    const { fecha, hora, motivo } = argumentos;
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

    const resContacto = await pool.query(`SELECT nombre_completo FROM "CRM_Opticas".contactos WHERE id = $1`, [contactoId]);
    const nombrePaciente = resContacto.rows[0]?.nombre_completo || 'Paciente';

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
 * Detecta si una clave o modelo corresponde a Google Gemini oficial o a OpenRouter
 */
export function detectarProveedorIA(apiKey, modelo) {
  const clave = String(apiKey || '').trim();
  const mod = String(modelo || '').trim().toLowerCase();

  // 1. Si la clave es explícitamente de Google AI Studio (AQ... o AIza...)
  if (clave.startsWith('AQ.') || clave.startsWith('AIza')) {
    return 'gemini';
  }
  // 2. Si la clave es explícitamente de OpenRouter (sk-or-v1-...)
  if (clave.startsWith('sk-or-')) {
    return 'openrouter';
  }
  // 3. Si el modelo es explícitamente de Gemini
  if (mod.includes('gemini') && !mod.includes('openrouter')) {
    return 'gemini';
  }
  // 4. Si el modelo apunta a proveedores de OpenRouter
  if (
    mod.includes('openrouter') ||
    mod.includes('deepseek') ||
    mod.includes('llama') ||
    mod.includes('gpt-') ||
    mod.includes('claude')
  ) {
    return 'openrouter';
  }
  // 5. Fallback según variables de entorno disponibles
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  return 'gemini';
}

/**
 * Mantiene compatibilidad con llamadas existentes
 */
export function esProveedorGemini(apiKey, modelo) {
  return detectarProveedorIA(apiKey, modelo) === 'gemini';
}

/**
 * Normaliza nombres de modelo para Google Gemini Oficial.
 * Si el modelo no es de Gemini (ej. 'openrouter/free'), retorna automáticamente
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
  };
}

/**
 * Procesa un mensaje entrante de un paciente y genera una respuesta con Gemini o OpenRouter
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

  // 3. Validar si la IA está activa globalmente y para este chat
  const configOptica = await obtenerConfiguracionIA(optica_id);
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

  let apiKey = (process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || '').trim();
  const modeloConfigurado = (process.env.IA_MODELO || 'gemini-3.5-flash').trim();
  const proveedorDeseado = detectarProveedorIA(apiKey, modeloConfigurado);

  if (!apiKey) {
    console.warn(`[Motor IA] Óptica ${optica_id} tiene la IA activa pero no hay clave GEMINI_API_KEY en variables de entorno.`);
    return { respondido: false, motivo: 'sin_clave_api' };
  }

  // Nombre comercial oficial dinámico de la óptica (sin nombres genéricos)
  const nombreOpticaReal = (configOptica.nombre || 'Tu Visión Óptica').trim();

  // 4. Obtener datos del paciente
  const idContacto = contacto_id || conv.contacto_id;
  const resContacto = await pool.query(
    `SELECT nombre_completo, telefono FROM "CRM_Opticas".contactos WHERE id = $1`,
    [idContacto]
  );
  const paciente = resContacto.rows[0] || {};
  const nombreRealPersona = extraerNombrePersonaValido(paciente.nombre_completo);

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

  const horarioAtencion = `${configOptica.hora_inicio_atencion || '08:00 AM'} a ${configOptica.hora_fin_atencion || '06:00 PM'}`;
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
      .replace(/\{\{horario_atencion\}\}/g, horarioAtencion)
      .replace(/\{\{duracion_consulta\}\}/g, duracionConsulta)
      .replace(/\{\{ia_tono\}\}/g, configOptica.ia_tono || 'amable y profesional')
      .replace(/\{\{nombre_paciente\}\}/g, nombreRealPersona || 'No identificado')
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

REGLAS DE FORMATO Y REDACCIÓN (CRÍTICO PARA WHATSAPP):
1. IDENTIDAD INSTITUCIONAL: El nombre oficial y exclusivo de esta óptica es "${nombreOpticaReal}". Utiliza siempre este nombre oficial en tus saludos o menciones. NUNCA uses nombres genéricos como "la óptica" ni inventes nombres de otras empresas.
2. NEGRITAS: Utiliza EXCLUSIVAMENTE un solo asterisco a cada lado: *texto en negrita*.
3. CERO MEMORIA: NUNCA copies horarios de mensajes viejos del chat. Cada vez que pregunten horarios o disponibilidad, llama a "consultar_horarios_disponibles".
4. JORNADAS: Pregunta si prefieren en la mañana (antes de 1:00 PM) o tarde (1:00 PM a 6:00 PM).
5. HOY: Prohibido ofrecer horas pasadas.
6. REPROGRAMACIÓN: Prohibido auto-asignar hora sin confirmación explícita del paciente.
`;
  }

  const esConsultaDisponibilidad = /horario|disponib|citas?|cu[aá]ndo|agenda|de nuevo|libres?/i.test(textoFinalParaIA);
  const esGemini = esProveedorGemini(apiKey, configOptica.ia_modelo);
  const modeloGeminiNormalizado = normalizarModeloGemini(configOptica.ia_modelo);

  try {
    let respuestaFinalTexto = '';
    let ultimoMensajeConfirmacionOficial = null;

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
    } else {
      // 6. Ensamblar contenido de conversación en formato OpenAI / OpenRouter
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

      const modeloOpenRouter = configOptica.ia_modelo || 'openrouter/free';
      let llamadasRestantes = 3;

      while (llamadasRestantes > 0) {
        llamadasRestantes--;

        const respApi = await fetch(URL_OPENROUTER_COMPLETIONS, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://crmoptica.com',
            'X-Title': 'CRM Optica',
          },
          body: JSON.stringify({
            model: modeloOpenRouter,
            messages,
            tools: HERRAMIENTAS_OPENAI,
            tool_choice: 'auto',
            temperature: 0.0,
            max_tokens: 1500,
          }),
        });

        if (!respApi.ok) {
          const errorText = await respApi.text();
          console.error(`[Motor IA] Error de OpenRouter API (${respApi.status}):`, errorText);
          return { respondido: false, error: `Error OpenRouter ${respApi.status}` };
        }

        const datosJson = await respApi.json();
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

    // 8. Si la respuesta contiene indicación de transferencia a asesor humano, marcar como urgente y pausar IA
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
    };
  } catch (error) {
    console.error('[Motor IA] Excepción al procesar con IA:', error);
    return { respondido: false, error: error.message };
  }
}
