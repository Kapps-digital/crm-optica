import { pool } from '../base_datos/conexion.mjs';

/**
 * Expresión segura para extraer la fecha de examen como tipo DATE en Postgres
 */
const EXPR_FECHA_EXAMEN = `(
  CASE 
    WHEN f.fecha_examen ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN f.fecha_examen::date
    ELSE NULL
  END
)`;

/**
 * Expresión segura para calcular la fecha del próximo control visual
 */
const EXPR_PROXIMO_CONTROL = `(
  CASE 
    WHEN f.proximo_control ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN f.proximo_control::date
    WHEN f.proximo_control ~ '^[0-9]+$' AND f.fecha_examen ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      THEN (f.fecha_examen::date + (f.proximo_control::int * interval '1 month'))
    WHEN f.fecha_examen ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      THEN (f.fecha_examen::date + interval '12 months')
    ELSE NULL
  END
)`;

/**
 * Construye la cláusula WHERE y parámetros SQL según los criterios del segmento
 */
function construirCondicionCriterios(criterios, indiceInicio = 2) {
  const condiciones = [];
  const parametros = [];
  let contador = indiceInicio;

  // 1. Control Vencido (meses)
  if (criterios.control_vencido_meses) {
    const meses = Number(criterios.control_vencido_meses) || 12;
    condiciones.push(`(
      (${EXPR_PROXIMO_CONTROL} IS NOT NULL AND ${EXPR_PROXIMO_CONTROL} < CURRENT_DATE)
      OR (${EXPR_FECHA_EXAMEN} IS NOT NULL AND ${EXPR_FECHA_EXAMEN} <= (CURRENT_DATE - interval '${meses} months'))
      OR (f.id IS NULL AND c.creado_en <= (CURRENT_DATE - interval '${meses} months'))
    )`);
  }

  // 2. Rango de Edad
  if (criterios.edad_minima !== undefined && criterios.edad_minima !== null && criterios.edad_minima !== '') {
    condiciones.push(`(c.edad >= $${contador})`);
    parametros.push(Number(criterios.edad_minima));
    contador++;
  }
  if (criterios.edad_maxima !== undefined && criterios.edad_maxima !== null && criterios.edad_maxima !== '') {
    condiciones.push(`(c.edad <= $${contador})`);
    parametros.push(Number(criterios.edad_maxima));
    contador++;
  }

  // 3. Tiene Adición (Presbicia)
  if (criterios.tiene_adicion) {
    condiciones.push(`(
      (f.od_adicion IS NOT NULL AND TRIM(f.od_adicion) != '' AND TRIM(f.od_adicion) != '0' AND TRIM(f.od_adicion) != '+0.00')
      OR (f.oi_adicion IS NOT NULL AND TRIM(f.oi_adicion) != '' AND TRIM(f.oi_adicion) != '0' AND TRIM(f.oi_adicion) != '+0.00')
      OR (COALESCE(c.edad, 0) >= 40)
    )`);
  }

  // 4. Tipo de Lente
  if (criterios.tipo_lente) {
    if (String(criterios.tipo_lente).toLowerCase() === 'blue') {
      condiciones.push(`(
        f.tipo_lente ILIKE '%blue%' 
        OR f.tipo_lente ILIKE '%azul%' 
        OR f.observaciones ILIKE '%blue%' 
        OR f.observaciones ILIKE '%azul%'
      )`);
    } else {
      condiciones.push(`(f.tipo_lente ILIKE $${contador} OR f.observaciones ILIKE $${contador})`);
      parametros.push(`%${criterios.tipo_lente}%`);
      contador++;
    }
  }

  // 5. Cilindro Mínimo (Astigmatismo)
  if (criterios.cilindro_minimo) {
    const minCil = Number(criterios.cilindro_minimo) || 2.0;
    condiciones.push(`(
      ABS(COALESCE(NULLIF(regexp_replace(f.od_cilindro, '[^0-9.-]', '', 'g'), '')::numeric, 0)) >= ${minCil}
      OR ABS(COALESCE(NULLIF(regexp_replace(f.oi_cilindro, '[^0-9.-]', '', 'g'), '')::numeric, 0)) >= ${minCil}
    )`);
  }

  // 6. Días sin cita / inactividad (Pacientes antiguos sin citas ni fórmulas recientes)
  if (criterios.dias_sin_cita) {
    const dias = Number(criterios.dias_sin_cita) || 180;
    condiciones.push(`(
      c.creado_en <= (CURRENT_DATE - interval '${dias} days')
      AND NOT EXISTS (
        SELECT 1 FROM "CRM_Opticas".citas ci
        WHERE ci.contacto_id = c.id
          AND ci.fecha_cita IS NOT NULL
          AND ci.fecha_cita ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND ci.fecha_cita::date >= (CURRENT_DATE - interval '${dias} days')
          AND (ci.estado IS NULL OR ci.estado NOT IN ('cancelada', 'anulada'))
      )
      AND (
        f.id IS NULL 
        OR (${EXPR_FECHA_EXAMEN} IS NOT NULL AND ${EXPR_FECHA_EXAMEN} < (CURRENT_DATE - interval '${dias} days'))
        OR (${EXPR_FECHA_EXAMEN} IS NULL AND f.creado_en < (CURRENT_DATE - interval '${dias} days'))
      )
    )`);
  }

  // 7. Criterio por Sexo (masculino / femenino) para auto-segmentaciones
  if (criterios.sexo && String(criterios.sexo).trim()) {
    condiciones.push(`(LOWER(COALESCE(c.sexo, '')) = LOWER($${contador}))`);
    parametros.push(String(criterios.sexo).trim());
    contador++;
  }

  const clausulaExtra = condiciones.length > 0 ? `AND ${condiciones.join(' AND ')}` : '';
  return { clausulaExtra, parametros };
}

/**
 * Consulta de base para unir pacientes de la óptica con su última fórmula
 */
const SQL_BASE_DESDE = `
  FROM "CRM_Opticas".contactos c
  LEFT JOIN LATERAL (
    SELECT id, od_esfera, od_cilindro, od_eje, od_adicion, oi_esfera, oi_cilindro, oi_eje, oi_adicion,
           tipo_lente, observaciones, optometra, fecha_examen, proximo_control, creado_en
    FROM "CRM_Opticas".formulas_opticas fo
    WHERE fo.contacto_id = c.id
    ORDER BY fo.fecha_examen DESC NULLS LAST, fo.id DESC
    LIMIT 1
  ) f ON TRUE
  WHERE c.optica_id = $1
    AND c.es_paciente IS TRUE
`;

/**
 * Obtener todos los segmentos visibles para la óptica con conteo en vivo de pacientes
 */
export async function obtenerSegmentosConConteo(opticaId) {
  const idOpticaNumerico = Number(opticaId) || 1;

  // Segmentos globales (optica_id IS NULL) + personalizados de esta óptica
  // Si la óptica personalizó un segmento predeterminado (segmento_origen_id), se excluye el global para esta óptica
  const resSegmentos = await pool.query(
    `SELECT id, optica_id, nombre, descripcion, icono, color, es_sistema, criterios_json, segmento_origen_id, creado_en, actualizado_en
     FROM "CRM_Opticas".segmentos
     WHERE (
       optica_id = $1
       OR (
         optica_id IS NULL 
         AND id NOT IN (
           SELECT segmento_origen_id 
           FROM "CRM_Opticas".segmentos 
           WHERE optica_id = $1 AND segmento_origen_id IS NOT NULL
         )
       )
     )
     ORDER BY es_sistema DESC, id ASC`,
    [idOpticaNumerico]
  );

  const segmentos = resSegmentos.rows;
  const setPacientesUnicos = new Set();

  // Calcular en tiempo real el total de pacientes para cada segmento y acumular IDs únicos
  const segmentosConConteo = await Promise.all(
    segmentos.map(async (seg) => {
      try {
        const criterios = typeof seg.criterios_json === 'string' ? JSON.parse(seg.criterios_json) : (seg.criterios_json || {});
        const { clausulaExtra, parametros } = construirCondicionCriterios(criterios, 2);

        const sqlConteo = `SELECT c.id ${SQL_BASE_DESDE} ${clausulaExtra}`;
        const resConteo = await pool.query(sqlConteo, [idOpticaNumerico, ...parametros]);
        const ids = resConteo.rows.map((r) => r.id);
        ids.forEach((id) => setPacientesUnicos.add(id));

        return {
          ...seg,
          criterios,
          total_pacientes: ids.length,
        };
      } catch (err) {
        console.error(`Error calculando conteo de segmento ${seg.id} (${seg.nombre}):`, err.message);
        return {
          ...seg,
          criterios: seg.criterios_json || {},
          total_pacientes: 0,
        };
      }
    })
  );

  // Total de pacientes reales registrados en esta óptica
  const resTotalPacientes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM "CRM_Opticas".contactos WHERE optica_id = $1 AND es_paciente IS TRUE`,
    [idOpticaNumerico]
  );
  const totalPacientesOptica = resTotalPacientes.rows[0]?.total || 0;

  return {
    segmentos: segmentosConConteo,
    total_pacientes_optica: totalPacientesOptica,
    total_pacientes_calificados_unicos: setPacientesUnicos.size,
  };
}

/**
 * Obtener listado de pacientes que pertenecen a un segmento específico
 */
export async function obtenerPacientesDeSegmento(idSegmento, opticaId) {
  const idOpticaNumerico = Number(opticaId) || 1;
  const idSeg = Number(idSegmento);

  const resSeg = await pool.query(
    `SELECT * FROM "CRM_Opticas".segmentos WHERE id = $1 AND (optica_id IS NULL OR optica_id = $2)`,
    [idSeg, idOpticaNumerico]
  );

  if (resSeg.rows.length === 0) {
    throw new Error('Segmento no encontrado o sin permisos');
  }

  const segmento = resSeg.rows[0];
  const criterios = typeof segmento.criterios_json === 'string' ? JSON.parse(segmento.criterios_json) : (segmento.criterios_json || {});
  const { clausulaExtra, parametros } = construirCondicionCriterios(criterios, 2);

  const sqlPacientes = `
    SELECT 
      c.id, c.nombre_completo, c.cedula, c.telefono, c.correo, c.edad, c.sexo, c.es_paciente, c.creado_en,
      f.id AS formula_id, f.fecha_examen, f.proximo_control, f.tipo_lente,
      f.od_esfera, f.od_cilindro, f.od_adicion, f.oi_esfera, f.oi_cilindro, f.oi_adicion,
      ${EXPR_PROXIMO_CONTROL} AS fecha_control_calculada,
      (
        SELECT MAX(ci.fecha_cita) FROM "CRM_Opticas".citas ci WHERE ci.contacto_id = c.id
      ) AS ultima_cita
    ${SQL_BASE_DESDE}
    ${clausulaExtra}
    ORDER BY c.nombre_completo ASC
    LIMIT 200
  `;

  const resPacientes = await pool.query(sqlPacientes, [idOpticaNumerico, ...parametros]);

  return {
    segmento: {
      ...segmento,
      criterios,
      total_pacientes: resPacientes.rows.length,
    },
    pacientes: resPacientes.rows,
  };
}

/**
 * Crear un nuevo segmento personalizado para la óptica activa
 */
export async function crearSegmentoPersonalizado({ opticaId, nombre, descripcion, icono, color, criterios }) {
  const idOpticaNumerico = Number(opticaId) || 1;

  if (!nombre || !nombre.trim()) {
    throw new Error('El nombre del segmento es obligatorio');
  }

  const criteriosJson = JSON.stringify(criterios || {});
  const iconoFinal = icono || 'Target';
  const colorFinal = color || '#0284c7';

  const res = await pool.query(
    `INSERT INTO "CRM_Opticas".segmentos (optica_id, nombre, descripcion, icono, color, es_sistema, criterios_json)
     VALUES ($1, $2, $3, $4, $5, FALSE, $6::jsonb)
     RETURNING id, optica_id, nombre, descripcion, icono, color, es_sistema, criterios_json, creado_en`,
    [idOpticaNumerico, nombre.trim(), descripcion ? descripcion.trim() : '', iconoFinal, colorFinal, criteriosJson]
  );

  const nuevo = res.rows[0];
  return {
    ...nuevo,
    criterios: typeof nuevo.criterios_json === 'string' ? JSON.parse(nuevo.criterios_json) : nuevo.criterios_json,
    total_pacientes: 0,
  };
}

/**
 * Eliminar segmento personalizado (solo si pertenece a la óptica y no es de sistema)
 */
export async function eliminarSegmentoPersonalizado(idSegmento, opticaId) {
  const idOpticaNumerico = Number(opticaId) || 1;
  const idSeg = Number(idSegmento);

  const res = await pool.query(
    `DELETE FROM "CRM_Opticas".segmentos 
     WHERE id = $1 AND optica_id = $2 AND es_sistema = FALSE
     RETURNING id`,
    [idSeg, idOpticaNumerico]
  );

  if (res.rows.length === 0) {
    throw new Error('No se puede eliminar el segmento: no existe, pertenece a otra óptica o es predeterminado del sistema');
  }

  return { exito: true, id: idSeg };
}

/**
 * Actualizar o personalizar un segmento existente
 * Si es predeterminado del sistema (es_sistema = TRUE), se guarda como un nuevo segmento personalizado para esta óptica
 * Si ya es personalizado de esta óptica (es_sistema = FALSE), se actualizan sus valores en sitio
 */
export async function actualizarSegmentoPersonalizado({ idSegmento, opticaId, nombre, descripcion, icono, color, criterios }) {
  const idOpticaNumerico = Number(opticaId) || 1;
  const idSeg = Number(idSegmento);

  if (!nombre || !nombre.trim()) {
    throw new Error('El nombre del segmento es obligatorio');
  }

  const criteriosJson = JSON.stringify(criterios || {});
  const iconoFinal = icono || 'Target';
  const colorFinal = color || '#0284c7';

  // Verificar estado del segmento origen
  const resVerif = await pool.query(
    `SELECT id, optica_id, es_sistema FROM "CRM_Opticas".segmentos WHERE id = $1`,
    [idSeg]
  );

  if (resVerif.rows.length === 0) {
    throw new Error('El segmento especificado no existe');
  }

  const segActual = resVerif.rows[0];

  // Caso 1: Es un segmento estándar del sistema -> Clonar como personalizado propio de esta óptica
  if (segActual.es_sistema || segActual.optica_id === null) {
    const resClon = await pool.query(
      `INSERT INTO "CRM_Opticas".segmentos (optica_id, nombre, descripcion, icono, color, es_sistema, criterios_json, segmento_origen_id)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6::jsonb, $7)
       RETURNING id, optica_id, nombre, descripcion, icono, color, es_sistema, criterios_json, segmento_origen_id, creado_en, actualizado_en`,
      [idOpticaNumerico, nombre.trim(), descripcion ? descripcion.trim() : '', iconoFinal, colorFinal, criteriosJson, idSeg]
    );

    const nuevoPersonalizado = resClon.rows[0];
    return {
      ...nuevoPersonalizado,
      criterios: typeof nuevoPersonalizado.criterios_json === 'string' ? JSON.parse(nuevoPersonalizado.criterios_json) : nuevoPersonalizado.criterios_json,
    };
  }

  // Caso 2: Es un segmento personalizado -> Actualizar en sitio (solo si pertenece a esta óptica)
  if (segActual.optica_id !== idOpticaNumerico) {
    throw new Error('No tiene permisos para modificar este segmento personalizado');
  }

  const resUpdate = await pool.query(
    `UPDATE "CRM_Opticas".segmentos 
     SET nombre = $1, descripcion = $2, icono = $3, color = $4, criterios_json = $5::jsonb, actualizado_en = NOW()
     WHERE id = $6 AND optica_id = $7 AND es_sistema = FALSE
     RETURNING id, optica_id, nombre, descripcion, icono, color, es_sistema, criterios_json, segmento_origen_id, actualizado_en`,
    [nombre.trim(), descripcion ? descripcion.trim() : '', iconoFinal, colorFinal, criteriosJson, idSeg, idOpticaNumerico]
  );

  const actualizado = resUpdate.rows[0];
  return {
    ...actualizado,
    criterios: typeof actualizado.criterios_json === 'string' ? JSON.parse(actualizado.criterios_json) : actualizado.criterios_json,
  };
}
