import { pool } from '../base_datos/conexion.mjs';

async function migrar() {
  console.log('--- Creando tabla segmentos en "CRM_Opticas" ---');

  const ddl = `
    CREATE TABLE IF NOT EXISTS "CRM_Opticas".segmentos (
      id SERIAL PRIMARY KEY,
      optica_id INTEGER REFERENCES "CRM_Opticas".opticas(id) ON DELETE CASCADE,
      nombre VARCHAR(150) NOT NULL,
      descripcion TEXT,
      icono VARCHAR(50) DEFAULT 'Target',
      color VARCHAR(30) DEFAULT '#0284c7',
      es_sistema BOOLEAN DEFAULT FALSE,
      criterios_json JSONB NOT NULL,
      creado_en TIMESTAMPTZ DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await pool.query(ddl);
  console.log('✓ Tabla segmentos verificada/creada.');

  // Semillas de segmentos predeterminados del sistema (optica_id = NULL)
  const segmentosBase = [
    {
      nombre: 'Control Anual Vencido',
      descripcion: 'Pacientes cuya última fórmula médica tiene más de 12 meses sin revisión visual.',
      icono: 'CalendarClock',
      color: '#ea580c',
      es_sistema: true,
      criterios_json: JSON.stringify({ control_vencido_meses: 12 }),
    },
    {
      nombre: 'Presbicia & Progresivos',
      descripcion: 'Pacientes a partir de 40 años o con adición formulada para visión cercana.',
      icono: 'Glasses',
      color: '#0284c7',
      es_sistema: true,
      criterios_json: JSON.stringify({ tiene_adicion: true }),
    },
    {
      nombre: 'Filtro Luz Azul & Pantallas',
      descripcion: 'Jóvenes y adultos con alta exposición digital, uso de monofocales o descanso visual.',
      icono: 'Laptop',
      color: '#8b5cf6',
      es_sistema: true,
      criterios_json: JSON.stringify({ edad_minima: 15, edad_maxima: 45, tipo_lente: 'Monofocal' }),
    },
    {
      nombre: 'Astigmatismo / Cilindro Alto',
      descripcion: 'Pacientes con astigmatismo moderado a alto (cilindro igual o mayor a 2.00 dioptrías).',
      icono: 'Eye',
      color: '#10b981',
      es_sistema: true,
      criterios_json: JSON.stringify({ cilindro_minimo: 2.0 }),
    },
    {
      nombre: 'Usuarios de Lentes de Contacto',
      descripcion: 'Pacientes adaptados a lentes de contacto para reposición de lágrimas y blísteres.',
      icono: 'Sparkles',
      color: '#06b6d4',
      es_sistema: true,
      criterios_json: JSON.stringify({ tipo_lente: 'Contacto' }),
    },
    {
      nombre: 'Pacientes Inactivos',
      descripcion: 'Pacientes registrados sin citas ni interacción en los últimos 6 meses.',
      icono: 'UserX',
      color: '#64748b',
      es_sistema: true,
      criterios_json: JSON.stringify({ dias_sin_cita: 180 }),
    },
  ];

  for (const seg of segmentosBase) {
    const res = await pool.query(
      `SELECT id FROM "CRM_Opticas".segmentos WHERE nombre = $1 AND es_sistema = TRUE`,
      [seg.nombre]
    );

    if (res.rows.length === 0) {
      await pool.query(
        `INSERT INTO "CRM_Opticas".segmentos (optica_id, nombre, descripcion, icono, color, es_sistema, criterios_json)
         VALUES (NULL, $1, $2, $3, $4, $5, $6::jsonb)`,
        [seg.nombre, seg.descripcion, seg.icono, seg.color, seg.es_sistema, seg.criterios_json]
      );
      console.log(`+ Insertado segmento base: ${seg.nombre}`);
    } else {
      console.log(`= Segmento base ya existe: ${seg.nombre}`);
    }
  }

  console.log('✓ Migración de segmentos terminada exitosamente.');
  await pool.end();
}

migrar().catch((err) => {
  console.error('Error migrando tabla segmentos:', err);
  process.exit(1);
});
