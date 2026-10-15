import { pool, base_datos } from '../base_datos/conexion.mjs';
import { enviar_mensaje } from './gestor_mensajeria.mjs';

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
            ia_preguntas_frecuentes, ia_api_key, ia_modelo,
            hora_inicio_atencion, hora_fin_atencion, duracion_cita_minutos,
            especialista_defecto, motivo_cita_defecto
     FROM "CRM_Opticas".opticas 
     WHERE id = $1`,
    [idOpticaNumerico]
  );

  if (res.rows.length === 0) {
    return {
      ia_activa: false,
      ia_nombre: 'Asistente Óptico',
      ia_tono: 'cercano',
      ia_instrucciones: '',
      ia_preguntas_frecuentes: '',
      ia_api_key: '',
      ia_modelo: 'openrouter/free',
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
    ia_api_key: row.ia_api_key || '',
    ia_modelo: row.ia_modelo || 'openrouter/free',
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
    ia_api_key,
    ia_modelo,
  } = datos;

  const estadoActivo = Boolean(ia_activa);

  await pool.query(
    `UPDATE "CRM_Opticas".opticas
     SET ia_activa = $1,
         ia_nombre = $2,
         ia_tono = $3,
         ia_instrucciones = $4,
         ia_preguntas_frecuentes = $5,
         ia_api_key = $6,
         ia_modelo = $7
     WHERE id = $8`,
    [
      estadoActivo,
      (ia_nombre || 'Asistente Óptico').trim(),
      (ia_tono || 'cercano').trim(),
      ia_instrucciones || '',
      ia_preguntas_frecuentes || '',
      ia_api_key || '',
      ia_modelo || 'openrouter/free',
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
 * Construye el mensaje estructurado canónico de cita para WhatsApp (idéntico a la plantilla CRM)
 */
export function construirMensajeCitaWhatsApp({
  tipo = 'confirmacion', // 'confirmacion' | 'reprogramacion' | 'consulta'
  nombreOptica = 'Óptica',
  nombrePaciente = 'Paciente',
  fecha,
  hora,
  motivo,
  especialista,
}) {
  const encabezado = (nombreOptica || 'Óptica').trim();
  const fechaVisual = formatearFechaDDMMYYYY(fecha);
  const espTexto = especialista && String(especialista).trim() !== '' ? String(especialista).trim() : 'Sin especialista';
  const motivoTexto = motivo && String(motivo).trim() !== '' ? String(motivo).trim() : 'Examen de optometría';
  const pacienteTexto = (nombrePaciente || 'Paciente').trim();

  let titulo = 'Confirmación de Cita';
  let saludo = `Hola *${pacienteTexto}*, tu cita de optometría ha sido programada con éxito:`;

  if (tipo === 'reprogramacion') {
    titulo = 'Cita Reprogramada';
    saludo = `Hola *${pacienteTexto}*, tu cita de optometría ha sido reprogramada con éxito:`;
  } else if (tipo === 'consulta') {
    titulo = 'Cita Programada';
    saludo = `Hola *${pacienteTexto}*, tienes la siguiente cita programada:`;
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
      description: 'Agenda y confirma una nueva cita en el CRM una vez que el paciente ha confirmado la fecha y hora. La cita siempre queda en estado Pendiente.',
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
            description: 'Motivo de la cita (ejemplo: "Examen de optometría", "Control de lentes", etc.).',
          },
        },
        required: ['fecha', 'hora'],
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
];

/**
 * Ejecuta una herramienta llamada por el modelo de IA y retorna el resultado
 */
async function ejecutarHerramienta({ nombre, argumentos, opticaId, contactoId }) {
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

  return { error: `Herramienta desconocida: ${nombre}` };
}

/**
 * Procesa un mensaje entrante de un paciente y genera una respuesta con Gemini
 */
export async function procesarMensajeConIA({ conversacion_id, contacto_id, optica_id, texto_mensaje }) {
  if (!texto_mensaje || typeof texto_mensaje !== 'string' || texto_mensaje.trim() === '') {
    return { respondido: false, motivo: 'mensaje_vacio' };
  }

  // 1. Validar si la IA está activa globalmente y para este chat
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

  const apiKey = configOptica.ia_api_key || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn(`[Motor IA] Óptica ${optica_id} tiene la IA activa pero no hay clave OPENROUTER_API_KEY configurada.`);
    return { respondido: false, motivo: 'sin_clave_api' };
  }

  // 2. Obtener datos del paciente
  const idContacto = contacto_id || conv.contacto_id;
  const resContacto = await pool.query(
    `SELECT nombre_completo, telefono FROM "CRM_Opticas".contactos WHERE id = $1`,
    [idContacto]
  );
  const paciente = resContacto.rows[0] || {};
  const nombrePaciente = paciente.nombre_completo || 'Paciente';

  // 3. Obtener citas pendientes vigentes del paciente (solo de hoy en adelante)
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

  // 4. Obtener historial reciente del chat (últimos 6 mensajes)
  const resHistorial = await pool.query(
    `SELECT direccion, texto FROM "CRM_Opticas".mensajes 
     WHERE conversacion_id = $1 AND texto IS NOT NULL AND texto != '' AND texto != '[Unsupported message]'
     ORDER BY id DESC LIMIT 6`,
    [conversacion_id]
  );
  const historialReverso = resHistorial.rows.reverse();

  // 5. Construir System Prompt con Guardrails infranqueables
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

  const promptSistema = `Eres ${configOptica.ia_nombre}, el asistente virtual oficial de "${configOptica.nombre || 'Óptica'}".
Fecha de hoy: ${fechaHoy}.
Hora actual en Colombia: ${horaActualColombia}.
Horario hábil de atención de la óptica: ${horarioAtencion}.
Duración estándar de cada consulta: ${duracionConsulta}.

REGLAS DE FORMATO Y REDACCIÓN (CRÍTICO PARA WHATSAPP):
1. NEGRITAS: Utiliza EXCLUSIVAMENTE un solo asterisco a cada lado: *texto en negrita*.
   - PROHIBIDO usar doble asterisco (**texto**). En WhatsApp el doble asterisco se rompe y muestra asteriscos literales.
   - Asegúrate de que no haya espacios pegados al asterisco: usa *palabra*, jamás * palabra *.
2. DIRECTO Y HUMANO: Tono ${configOptica.ia_tono}. Respuestas concisas y directas (máximo 2 a 3 oraciones en mensajes conversacionales ordinarios).
3. TEMPERATURA 0: No inventes precios, promociones, diagnósticos ni citas que no existan.
4. NUNCA des diagnósticos médicos ni afirmes fórmulas. Siempre invita al examen de optometría.

REGLAS PARA CITAS (CONSULTA, HORARIOS, AGENDAMIENTO Y REPROGRAMACIÓN):

1. CONSULTA DE CITAS PENDIENTES DEL PACIENTE:
   - Si el paciente pregunta qué citas tiene o si tiene alguna cita pendiente, invoca "consultar_citas_paciente".
   - MUESTRA ÚNICAMENTE citas vigentes de hoy en adelante. Las citas pasadas ya ocurrieron y NUNCA debes mencionarlas.
   - Para responder, utiliza exactamente la estructura oficial de cita (con fecha en formato DD/MM/YYYY):
🗓️ *${configOptica.nombre || 'Óptica'} - Cita Programada*
Hola *${nombrePaciente}*, tienes la siguiente cita programada:

📅 *Fecha:* DD/MM/YYYY
⏰ *Hora:* HH:MM AM/PM
🎯 *Motivo:* [Motivo]
👨‍⚕️ *Especialista:* [Especialista o 'Sin especialista']

📍 Te sugerimos presentarte 10 minutos antes. Si necesitas reprogramar, responde directamente a este chat.
   - Si no tiene citas pendientes futuras, responde amablemente indicando que no registra ninguna cita pendiente y ofrécele agendar una.

2. PREFERENCIA DE JORNADA (MAÑANA VS TARDE) AL OFRECER HORARIOS:
   - Cuando el paciente pida horarios disponibles para una fecha o exprese intención de agendar/reprogramar sin decir una hora:
     - Pregúntale amablemente si prefiere su cita en horario de la *mañana* (antes de la 1:00 PM) o de la *tarde* (a partir de la 1:00 PM hasta las 6:00 PM).
     - Si el paciente indica "mañana", invoca "consultar_horarios_disponibles" con jornada "manana" y dale las opciones de la mañana.
     - Si el paciente indica "tarde", invoca "consultar_horarios_disponibles" con jornada "tarde" y dale las opciones de la tarde.
     - En la tarde se atiende a partir de la 1:00 PM. La tarde cuenta con disponibilidad en horarios como 01:00 PM, 01:30 PM, 02:00 PM, 02:30 PM, 03:00 PM, 03:30 PM, 04:00 PM, 04:30 PM, 05:00 PM, 05:30 PM (salvo que ya estén reservados). NUNCA digas que no hay citas en la tarde o a las 4:00 PM sin haber revisado la herramienta. Si el horario está libre, confírmale de inmediato que sí hay disponibilidad.

3. REGLA ESTRICTA DE REPROGRAMACIÓN (PROHIBIDO AUTO-ASIGNAR HORA A CIEGAS):
   - Si el paciente pide reprogramar una cita para un día determinado (ej: "podríamos reprogramar la cita para el 22 de octubre"):
     - ¡PROHIBIDO EJECUTAR "reprogramar_cita" EN ESE MOMENTO!
     - No sabes a qué hora la desea el paciente.
     - Lo que debes hacer:
       1º Consultar disponibilidad para esa fecha con "consultar_horarios_disponibles".
       2º Preguntar al paciente si prefiere el horario de la mañana o de la tarde.
       3º Ofrecerle los horarios disponibles de la jornada que elija.
       4º ÚNICAMENTE cuando el paciente confirme la hora exacta (ej: "a las 4:00 PM" o "a las 10:30 AM"), procedes a ejecutar "reprogramar_cita".
     - Al reprogramar, la cita existente se mueve directamente sin duplicar y queda en estado Pendiente. Si la cita tenía especialista, se actualizará al especialista predeterminado si existe, o quedará como "Sin especialista".

4. HORARIOS PARA EL DÍA DE HOY (PROHIBIDO OFRECER HORAS PASADAS O INMEDIATAS):
   - Hora actual en Colombia: ${horaActualColombia}.
   - Si el paciente busca una cita para el día de HOY o pide el día más próximo con disponibilidad:
     - NUNCA ofrezcas horas que ya pasaron ni la hora actual (si son las ${horaActualColombia}, no puedes ofrecer citas de horas pasadas ni inmediatas).
     - Solo puedes ofrecer horarios con al menos 25 a 30 minutos de anticipación para que el paciente alcance a llegar a la óptica.
     - Si para hoy ya no quedan horarios en la mañana, indícaselo y ofrécele los horarios de la tarde (o el día de mañana si la óptica ya cerró).

5. CONFIRMACIÓN OFICIAL:
   - Cada vez que ejecutes "agendar_cita" o "reprogramar_cita", responde al cliente utilizando exactamente el "mensaje_confirmacion_oficial" retornado por la herramienta, sin omitir ni alterar ningún dato.

TRANSFERENCIA A ASESOR HUMANO:
- Si el paciente pide hablar con un asesor o una persona, o si hace una consulta médica no documentada, responde amablemente que lo comunicas con un asesor humano de inmediato (ejemplo: "Con mucho gusto, ya le transfiero tu caso a uno de nuestros asesores para atenderte personalmente").

INFORMACIÓN DEL PACIENTE ACTUAL:
- Nombre: ${nombrePaciente}
- Citas pendientes vigentes registradas:
${citasTexto}

DIRECTRICES ESPECÍFICAS DE LA ÓPTICA:
${configOptica.ia_instrucciones || 'Atender amablemente a los pacientes y ayudarles a consultar, agendar o reprogramar sus citas.'}

BASE DE CONOCIMIENTO Y PREGUNTAS FRECUENTES (FAQ):
${configOptica.ia_preguntas_frecuentes || 'Horario de atención: ' + horarioAtencion + '.'}
`;

  // 6. Ensamblar contenido de conversación en formato OpenAI
  const messages = [
    { role: 'system', content: promptSistema },
  ];

  for (const m of historialReverso) {
    messages.push({
      role: m.direccion === 'saliente' ? 'assistant' : 'user',
      content: m.texto,
    });
  }

  // Asegurar que el mensaje actual esté presente al final
  if (messages.length === 1 || messages[messages.length - 1].role !== 'user') {
    messages.push({
      role: 'user',
      content: texto_mensaje,
    });
  }

  const modeloOpenRouter = configOptica.ia_modelo || 'openrouter/free';

  try {
    let llamadasRestantes = 3;
    let respuestaFinalTexto = '';
    let ultimoMensajeConfirmacionOficial = null;

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
          max_tokens: 600,
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

      // Si el modelo pide ejecutar herramientas (Tool Calling)
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
          });

          // Si la herramienta retornó un mensaje oficial de cita estructurado, retenerlo
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

      // Respuesta de texto final
      if (mensajeRespuesta.content) {
        respuestaFinalTexto = mensajeRespuesta.content.trim();
        break;
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
    });

    // 8. Si la respuesta contiene indicación de transferencia a asesor humano, pausar IA en este chat
    const textoMinus = textoParaWhatsApp.toLowerCase();
    if (
      textoMinus.includes('asesor') ||
      textoMinus.includes('comunico con') ||
      textoMinus.includes('transfiero') ||
      textoMinus.includes('equipo humano')
    ) {
      await pool.query(
        `UPDATE "CRM_Opticas".conversaciones 
         SET ia_pausada_por_humano = TRUE, actualizado_en = NOW() 
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
