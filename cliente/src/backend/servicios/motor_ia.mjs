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
      ia_modelo: 'deepseek/deepseek-chat',
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
    ia_modelo: row.ia_modelo || 'deepseek/deepseek-chat',
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
      Boolean(ia_activa),
      (ia_nombre || 'Asistente Óptico').trim(),
      (ia_tono || 'cercano').trim(),
      ia_instrucciones || '',
      ia_preguntas_frecuentes || '',
      ia_api_key || '',
      ia_modelo || 'deepseek/deepseek-chat',
      idOpticaNumerico,
    ]
  );

  return { exito: true };
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
 * Genera ranuras de horario disponibles para una fecha específica
 */
async function obtenerHorariosDisponibles(opticaId, fechaStr) {
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

  const horariosLibres = [];
  for (let m = minInicio; m < minFin; m += duracionMin) {
    const texto12 = formatearMinutos(m);
    const horaNorm = texto12.toLowerCase();
    if (!horasOcupadas.has(horaNorm)) {
      horariosLibres.push(texto12);
    }
  }

  return horariosLibres.slice(0, 10); // Limitar a un conjunto manejable
}

/**
 * Declaraciones de herramientas (Function Calling) en formato OpenAI / OpenRouter
 */
const HERRAMIENTAS_OPENAI = [
  {
    type: 'function',
    function: {
      name: 'consultar_citas_paciente',
      description: 'Consulta las citas programadas o vigentes de este paciente.',
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
      description: 'Agenda y confirma una cita en el CRM una vez que el paciente ha confirmado expresamente la fecha, hora y motivo.',
      parameters: {
        type: 'object',
        properties: {
          fecha: {
            type: 'string',
            description: 'Fecha confirmada en formato YYYY-MM-DD.',
          },
          hora: {
            type: 'string',
            description: 'Hora confirmada (ejemplo: "10:30 AM" o "15:00").',
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
];

/**
 * Ejecuta una herramienta llamada por Gemini y retorna el resultado
 */
async function ejecutarHerramienta({ nombre, argumentos, opticaId, contactoId }) {
  if (nombre === 'consultar_citas_paciente') {
    const res = await pool.query(
      `SELECT id, fecha_cita, hora_cita, motivo, especialista, estado 
       FROM "CRM_Opticas".citas 
       WHERE contacto_id = $1 AND optica_id = $2 AND estado != 'cancelada'
       ORDER BY fecha_cita ASC, hora_cita ASC LIMIT 5`,
      [contactoId, opticaId]
    );

    if (res.rows.length === 0) {
      return { tiene_citas: false, mensaje: 'El paciente no tiene ninguna cita programada actualmente.' };
    }

    return {
      tiene_citas: true,
      citas: res.rows.map((c) => ({
        id: c.id,
        fecha: c.fecha_cita,
        hora: c.hora_cita,
        motivo: c.motivo || 'Examen visual',
        especialista: c.especialista || 'Optómetra',
        estado: c.estado,
      })),
    };
  }

  if (nombre === 'consultar_horarios_disponibles') {
    const fecha = argumentos.fecha;
    const horarios = await obtenerHorariosDisponibles(opticaId, fecha);
    return {
      fecha,
      horarios_disponibles: horarios,
      hay_disponibilidad: horarios.length > 0,
    };
  }

  if (nombre === 'agendar_cita') {
    const { fecha, hora, motivo } = argumentos;

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

    // Obtener especialista por defecto
    const resOptica = await pool.query(
      `SELECT especialista_defecto, motivo_cita_defecto FROM "CRM_Opticas".opticas WHERE id = $1`,
      [opticaId]
    );
    const espDefecto = resOptica.rows[0]?.especialista_defecto || 'Optómetra de turno';
    const motivoFinal = motivo || resOptica.rows[0]?.motivo_cita_defecto || 'Examen de optometría';

    const resInsert = await pool.query(
      `INSERT INTO "CRM_Opticas".citas 
        (contacto_id, optica_id, fecha_cita, hora_cita, motivo, especialista, estado, observaciones, creado_en)
       VALUES 
        ($1, $2, $3, $4, $5, $6, 'programada', 'Agendada automáticamente por el Asistente Virtual de IA', NOW())
       RETURNING id`,
      [contactoId, opticaId, fecha, hora, motivoFinal, espDefecto]
    );

    return {
      exito: true,
      mensaje: 'Cita agendada exitosamente en el sistema de la óptica.',
      cita_id: resInsert.rows[0].id,
      fecha,
      hora,
      motivo: motivoFinal,
      especialista: espDefecto,
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

  const apiKey = configOptica.ia_api_key || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn(`[Motor IA] Óptica ${optica_id} tiene la IA activa pero no hay clave GEMINI_API_KEY configurada.`);
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

  // 3. Obtener citas activas del paciente
  const resCitas = await pool.query(
    `SELECT fecha_cita, hora_cita, motivo, especialista, estado 
     FROM "CRM_Opticas".citas 
     WHERE contacto_id = $1 AND optica_id = $2 AND estado != 'cancelada'
     ORDER BY fecha_cita ASC, hora_cita ASC LIMIT 2`,
    [idContacto, optica_id]
  );
  const citasTexto = resCitas.rows.length > 0
    ? resCitas.rows.map((c) => `- ${c.fecha_cita} a las ${c.hora_cita} (${c.motivo || 'Examen visual'}, con ${c.especialista || 'Optómetra'})`).join('\n')
    : 'No registra citas activas programadas actualmente.';

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
  });

  const promptSistema = `Eres ${configOptica.ia_nombre}, el asistente virtual oficial de "${configOptica.nombre || 'Óptica'}".
Fecha de hoy: ${fechaHoy}.

REGLAS DE SEGURIDAD Y BLINDAJE INFRANQUEABLES:
1. TEMPERATURA 0: No inventes precios, promociones, diagnósticos ni citas que no existan.
2. NUNCA des diagnósticos médicos ni afirmes qué graduación necesita el paciente. Siempre invita a agendar un examen visual con el optómetra profesional.
3. TONO DE VOZ: ${configOptica.ia_tono}. Sé conciso, empático y humano. Respuestas directas al grano (máximo 2 a 3 oraciones por mensaje).
4. AGENDAMIENTO DE CITAS:
   - Si el paciente desea cita, pregúntale qué día prefiere.
   - Usa la herramienta "consultar_horarios_disponibles" con la fecha indicada para ofrecerle horarios reales.
   - Cuando el paciente elija un horario específico, invoca la herramienta "agendar_cita" para registrarla formalmente.
5. TRANSFERENCIA HUMANA:
   - Si el paciente pide hablar con un asesor o una persona, o si hace una consulta médica/específica que no está en la base de conocimiento, responde amablemente que lo comunicas con un asesor humano de inmediato (ejemplo: "Con mucho gusto, ya le transfiero tu caso a uno de nuestros asesores para atenderte personalmente").
   - NUNCA inventes respuestas para preguntas no documentadas.

INFORMACIÓN DEL PACIENTE ACTUAL:
- Nombre: ${nombrePaciente}
- Citas registradas en el sistema:
${citasTexto}

DIRECTRICES ESPECÍFICAS DE LA ÓPTICA:
${configOptica.ia_instrucciones || 'Atender amablemente a los pacientes y ayudarles a consultar o agendar sus citas.'}

BASE DE CONOCIMIENTO Y PREGUNTAS FRECUENTES (FAQ):
${configOptica.ia_preguntas_frecuentes || 'Horario de atención: ' + (configOptica.hora_inicio_atencion || '8:00 AM') + ' a ' + (configOptica.hora_fin_atencion || '6:00 PM') + '.'}
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

  const modeloOpenRouter = configOptica.ia_modelo || 'deepseek/deepseek-chat';

  try {
    let llamadasRestantes = 3;
    let respuestaFinalTexto = '';

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
        // Añadir el mensaje del modelo con sus tool_calls
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

          // Añadir el mensaje de resultado de la herramienta
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

    if (!respuestaFinalTexto) {
      return { respondido: false, motivo: 'sin_texto_generado' };
    }

    // 7. Enviar respuesta por WhatsApp vía Zernio
    const resEnvio = await enviar_mensaje({
      conversacion_id,
      texto: respuestaFinalTexto,
    });

    // 8. Si la respuesta contiene indicación de transferencia a asesor humano, pausar IA en este chat
    const textoMinus = respuestaFinalTexto.toLowerCase();
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
      texto: respuestaFinalTexto,
      exito_envio: resEnvio.exito,
    };
  } catch (error) {
    console.error('[Motor IA] Excepción al procesar con IA:', error);
    return { respondido: false, error: error.message };
  }
}
