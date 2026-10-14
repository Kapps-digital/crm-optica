import 'dotenv/config';
import pg from 'pg';

const CADENA = process.env.DATABASE_URL ||
  'postgresql://postgres.jwctsfnkyfokrgtcjtxs:samand1904220122@aws-0-us-west-2.pooler.supabase.com:5432/postgres?options=-c%20search_path%3D%22CRM_Opticas%22%2Cpublic';

const client = new pg.Client({
  connectionString: CADENA,
  ssl: { rejectUnauthorized: false },
});

async function migrar() {
  await client.connect();
  console.log('Iniciando migración de tablas para Plantillas y Campañas por Lotes...');

  // 1. Tabla de Plantillas
  await client.query(`
    CREATE TABLE IF NOT EXISTS "CRM_Opticas".plantillas (
      id SERIAL PRIMARY KEY,
      optica_id INTEGER REFERENCES "CRM_Opticas".opticas(id) ON DELETE CASCADE,
      nombre VARCHAR(100) NOT NULL,
      etiqueta VARCHAR(150) NOT NULL,
      categoria VARCHAR(50) DEFAULT 'MARKETING',
      idioma VARCHAR(10) DEFAULT 'es',
      encabezado_tipo VARCHAR(20) DEFAULT 'NINGUNO',
      encabezado_contenido TEXT,
      cuerpo TEXT NOT NULL,
      pie VARCHAR(120),
      botones_json JSONB DEFAULT '[]',
      estado VARCHAR(30) DEFAULT 'APROBADA',
      es_sistema BOOLEAN DEFAULT FALSE,
      meta_template_id VARCHAR(100),
      creado_en TIMESTAMPTZ DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 2. Tabla de Campañas / Lotes de Envío
  await client.query(`
    CREATE TABLE IF NOT EXISTS "CRM_Opticas".campanas_envios (
      id SERIAL PRIMARY KEY,
      optica_id INTEGER NOT NULL REFERENCES "CRM_Opticas".opticas(id) ON DELETE CASCADE,
      plantilla_id INTEGER NOT NULL REFERENCES "CRM_Opticas".plantillas(id) ON DELETE CASCADE,
      nombre_campana VARCHAR(150) NOT NULL,
      segmento_id INTEGER REFERENCES "CRM_Opticas".segmentos(id) ON DELETE SET NULL,
      origen_tipo VARCHAR(30) DEFAULT 'segmento',
      total_destinatarios INTEGER NOT NULL DEFAULT 0,
      total_enviados INTEGER NOT NULL DEFAULT 0,
      total_fallidos INTEGER NOT NULL DEFAULT 0,
      estado VARCHAR(30) DEFAULT 'completado',
      creado_en TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 3. Tabla de Mensajes Individuales por Lote (para deduplicación y tracking)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "CRM_Opticas".envios_mensajes_lote (
      id BIGSERIAL PRIMARY KEY,
      campana_id INTEGER NOT NULL REFERENCES "CRM_Opticas".campanas_envios(id) ON DELETE CASCADE,
      optica_id INTEGER NOT NULL,
      plantilla_id INTEGER NOT NULL,
      contacto_id INTEGER REFERENCES "CRM_Opticas".contactos(id) ON DELETE SET NULL,
      telefono VARCHAR(30) NOT NULL,
      nombre_destinatario VARCHAR(150),
      estado_entrega VARCHAR(30) DEFAULT 'enviado',
      id_mensaje_plataforma VARCHAR(100),
      error_mensaje TEXT,
      enviado_en TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_envios_optica_plantilla_contacto 
      ON "CRM_Opticas".envios_mensajes_lote (optica_id, plantilla_id, contacto_id, enviado_en);

    CREATE INDEX IF NOT EXISTS idx_envios_optica_plantilla_telefono 
      ON "CRM_Opticas".envios_mensajes_lote (optica_id, plantilla_id, telefono, enviado_en);

    CREATE INDEX IF NOT EXISTS idx_envios_optica_fecha 
      ON "CRM_Opticas".envios_mensajes_lote (optica_id, enviado_en);
  `);

  console.log('✓ Tablas e índices creados con éxito.');

  // 4. Semillas de Plantillas Oficiales del Sistema (optica_id = NULL)
  const plantillasBase = [
    {
      nombre: 'recordatorio_control_anual',
      etiqueta: 'Recordatorio de Control Anual Vencido',
      categoria: 'UTILITY',
      idioma: 'es',
      encabezado_tipo: 'TEXTO',
      encabezado_contenido: '¡Hola, {{1}}! 👓',
      cuerpo: 'Esperamos que estés muy bien. En nuestra óptica recordamos que tu última fórmula médica cumplió más de 12 meses sin revisión. Cuidar tu salud visual es nuestra prioridad. ¿Deseas agendar tu examen de control esta semana?',
      pie: 'Atención personalizada óptica',
      botones_json: JSON.stringify([
        { tipo: 'QUICK_REPLY', texto: 'Agendar cita' },
        { tipo: 'QUICK_REPLY', texto: 'Más información' }
      ]),
      estado: 'APROBADA',
      es_sistema: true,
    },
    {
      nombre: 'promocion_lentes_progresivos',
      etiqueta: 'Promoción Progresivos & Presbicia',
      categoria: 'MARKETING',
      idioma: 'es',
      encabezado_tipo: 'TEXTO',
      encabezado_contenido: 'Visión nítida a toda distancia 👓',
      cuerpo: 'Hola {{1}}, diseñamos una experiencia visual sin saltos ni límites. Este mes tenemos asesoría personalizada y beneficios especiales en lentes progresivos digitales para visión cercana y lejana. ¿Te gustaría conocer las opciones disponibles?',
      pie: 'Tecnología óptica premium',
      botones_json: JSON.stringify([
        { tipo: 'QUICK_REPLY', texto: 'Ver opciones' },
        { tipo: 'QUICK_REPLY', texto: 'Hablar con asesor' }
      ]),
      estado: 'APROBADA',
      es_sistema: true,
    },
    {
      nombre: 'descanso_filtro_azul',
      etiqueta: 'Protección Pantallas & Filtro Azul',
      categoria: 'MARKETING',
      idioma: 'es',
      encabezado_tipo: 'TEXTO',
      encabezado_contenido: 'Protege tus ojos de las pantallas 💻',
      cuerpo: 'Hola {{1}}, si pasas largas horas frente al computador o celular y sientes cansancio o pesadez visual, nuestros lentes con filtro azul y antirreflejo de última generación son tu mejor aliado. ¿Quieres cotizar tus lentes de descanso?',
      pie: 'Salud y descanso visual',
      botones_json: JSON.stringify([
        { tipo: 'QUICK_REPLY', texto: 'Cotizar lentes' },
        { tipo: 'QUICK_REPLY', texto: 'Agendar revisión' }
      ]),
      estado: 'APROBADA',
      es_sistema: true,
    },
    {
      nombre: 'reposicion_lentes_contacto',
      etiqueta: 'Reposición Lentes de Contacto',
      categoria: 'UTILITY',
      idioma: 'es',
      encabezado_tipo: 'TEXTO',
      encabezado_contenido: 'Tu confort visual diario 💧',
      cuerpo: 'Hola {{1}}, ¿es momento de renovar tus lentes de contacto o solución multipropósito? Tenemos disponibilidad inmediata de blísteres y lágrimas artificiales para tu comodidad. ¿Deseas que te enviemos tu reposición?',
      pie: 'Cuidado de lentes de contacto',
      botones_json: JSON.stringify([
        { tipo: 'QUICK_REPLY', texto: 'Pedir reposición' },
        { tipo: 'QUICK_REPLY', texto: 'Consultar asesor' }
      ]),
      estado: 'APROBADA',
      es_sistema: true,
    }
  ];

  for (const pl of plantillasBase) {
    const res = await client.query(
      `SELECT id FROM "CRM_Opticas".plantillas WHERE nombre = $1 AND es_sistema = TRUE`,
      [pl.nombre]
    );

    if (res.rows.length === 0) {
      await client.query(
        `INSERT INTO "CRM_Opticas".plantillas 
          (optica_id, nombre, etiqueta, categoria, idioma, encabezado_tipo, encabezado_contenido, cuerpo, pie, botones_json, estado, es_sistema)
         VALUES 
          (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
        [
          pl.nombre,
          pl.etiqueta,
          pl.categoria,
          pl.idioma,
          pl.encabezado_tipo,
          pl.encabezado_contenido,
          pl.cuerpo,
          pl.pie,
          pl.botones_json,
          pl.estado,
          pl.es_sistema
        ]
      );
      console.log(`+ Insertada plantilla base: ${pl.etiqueta}`);
    } else {
      console.log(`= Plantilla base ya existe: ${pl.etiqueta}`);
    }
  }

  console.log('✓ Migración completada con éxito.');
  await client.end();
}

migrar().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
