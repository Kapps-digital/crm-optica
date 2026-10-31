import pg from 'pg';

const { Pool } = pg;

const CADENA_CONEXION =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  '';

export const pool = new Pool({
  connectionString: CADENA_CONEXION,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  console.error('❌ Error imprevisto en el pool de Supabase Postgres:', err.message);
});

/**
 * Traduce consultas estándar de SQLite a sintaxis PostgreSQL compatible con Supabase:
 * 1. Convierte parámetros posicionales '?' a '$1', '$2', ...
 * 2. Transforma funciones SQLite (datetime('now'), date('now'), etc.) a nativas de Postgres.
 * 3. Adapta sentencias 'INSERT OR IGNORE' e 'INSERT OR REPLACE' a cláusulas 'ON CONFLICT'.
 * 4. Añade 'RETURNING id' en inserciones para emular 'lastInsertRowid'.
 */
export function normalizarSql(sql) {
  let contador = 0;
  let consulta = sql;

  // 1. Manejo de INSERT OR REPLACE específico de mensajes
  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+mensajes/i.test(consulta)) {
    consulta = consulta.replace(/INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(consulta)) {
      consulta = `${consulta.trim()} ON CONFLICT (id_mensaje_plataforma) DO UPDATE SET estado_entrega = EXCLUDED.estado_entrega, texto = EXCLUDED.texto, tipo_contenido = EXCLUDED.tipo_contenido`;
    }
  }

  // 2. Manejo de INSERT OR IGNORE genérico
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(consulta)) {
    consulta = consulta.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(consulta)) {
      consulta = `${consulta.trim()} ON CONFLICT DO NOTHING`;
    }
  }

  // 3. Funciones de fecha y hora
  consulta = consulta
    .replace(/datetime\('now',\s*'-2 minutes'\)/gi, "(now() - interval '2 minutes')")
    .replace(/datetime\('now'\)/gi, 'now()')
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/datetime\(([a-zA-Z0-9_\.]+)\)/gi, '$1');

  // 4. Parámetros posicionales ? -> $1, $2, ...
  consulta = consulta.replace(/\?/g, () => `$${++contador}`);

  // 5. Añadir RETURNING id en INSERT si no tiene RETURNING explícito
  if (/^\s*insert\s+into/i.test(consulta) && !/returning/i.test(consulta)) {
    // Si es eventos_webhook retorna id_evento, para las demás tablas retorna id
    if (/insert\s+into\s+eventos_webhook/i.test(consulta)) {
      consulta = `${consulta.trim()} RETURNING id_evento`;
    } else {
      consulta = `${consulta.trim()} RETURNING id`;
    }
  }

  return consulta;
}

/**
 * Adaptador de base de datos para Supabase PostgreSQL con API unificada
 */
export const base_datos = {
  pool,

  /**
   * Ejecuta consultas crudas directamente sobre el pool
   */
  async query(sql, params = []) {
    const consultaNormalizada = normalizarSql(sql);
    const parametros = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return await pool.query(consultaNormalizada, parametros);
  },

  /**
   * Ejecuta sentencias DDL (ignora sentencias PRAGMA de SQLite)
   */
  async exec(sql) {
    if (/^\s*pragma/i.test(sql)) return; // No aplicable a PostgreSQL
    return await pool.query(sql);
  },

  /**
   * Crea una sentencia preparada emulando la interfaz asíncrona de acceso a datos
   */
  prepare(sql) {
    const consultaNormalizada = normalizarSql(sql);

    return {
      consultaSql: consultaNormalizada,

      async all(...params) {
        const parametros = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = await pool.query(consultaNormalizada, parametros);
        return res.rows;
      },

      async get(...params) {
        const parametros = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = await pool.query(consultaNormalizada, parametros);
        return res.rows[0];
      },

      async run(...params) {
        const parametros = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = await pool.query(consultaNormalizada, parametros);
        const primerRegistro = res.rows[0];
        const idRetornado = primerRegistro?.id ?? primerRegistro?.id_evento ?? null;

        return {
          changes: res.rowCount || 0,
          lastInsertRowid: idRetornado,
        };
      },
    };
  },
};

/**
 * Verifica la conexión activa y disponibilidad de tablas en Supabase
 */
export async function inicializar_base_datos() {
  try {
    // Asegurar tabla de auditoría de consumo de tokens IA
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "CRM_Opticas".consumo_ia (
        id BIGSERIAL PRIMARY KEY,
        optica_id BIGINT NOT NULL REFERENCES "CRM_Opticas".opticas(id) ON DELETE CASCADE,
        conversacion_id BIGINT REFERENCES "CRM_Opticas".conversaciones(id) ON DELETE SET NULL,
        mensaje_id BIGINT REFERENCES "CRM_Opticas".mensajes(id) ON DELETE SET NULL,
        modelo VARCHAR(100) NOT NULL,
        tokens_entrada INTEGER NOT NULL DEFAULT 0,
        tokens_salida INTEGER NOT NULL DEFAULT 0,
        tokens_totales INTEGER NOT NULL DEFAULT 0,
        tipo_evento VARCHAR(50) NOT NULL DEFAULT 'chat_whatsapp',
        creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_consumo_ia_optica ON "CRM_Opticas".consumo_ia (optica_id, creado_en);
      CREATE INDEX IF NOT EXISTS idx_consumo_ia_tipo ON "CRM_Opticas".consumo_ia (tipo_evento);

      -- Tabla de tokens y codigos temporales OTP para autogestión de olvido de contraseña
      CREATE TABLE IF NOT EXISTS "CRM_Opticas".recuperacion_contrasena (
        id BIGSERIAL PRIMARY KEY,
        usuario_id BIGINT NOT NULL REFERENCES "CRM_Opticas".usuarios(id) ON DELETE CASCADE,
        correo VARCHAR(255) NOT NULL,
        codigo VARCHAR(10) NOT NULL,
        expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
        usado BOOLEAN DEFAULT FALSE,
        creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_recuperacion_correo_cod ON "CRM_Opticas".recuperacion_contrasena (correo, codigo, usado);

      -- Soporte de archivos y documentos enriquecidos en mensajes (Word, Excel, PPT, PDF, etc.)
      ALTER TABLE "CRM_Opticas".mensajes ADD COLUMN IF NOT EXISTS nombre_archivo VARCHAR(255);
      ALTER TABLE "CRM_Opticas".mensajes ADD COLUMN IF NOT EXISTS mime_tipo VARCHAR(150);

      -- Soporte de tipologías/clasificación personalizada de pacientes por óptica
      CREATE TABLE IF NOT EXISTS "CRM_Opticas".tipologias_pacientes (
        id SERIAL PRIMARY KEY,
        optica_id INTEGER NOT NULL REFERENCES "CRM_Opticas".opticas(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        color VARCHAR(50) DEFAULT '#0284c7',
        activo BOOLEAN DEFAULT true,
        creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tipologias_optica ON "CRM_Opticas".tipologias_pacientes (optica_id, activo);
      ALTER TABLE "CRM_Opticas".contactos ADD COLUMN IF NOT EXISTS tipologia_id INTEGER REFERENCES "CRM_Opticas".tipologias_pacientes(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_contactos_tipologia ON "CRM_Opticas".contactos (tipologia_id);

      -- Soporte de Notificaciones Push Web para celulares y navegadores
      CREATE TABLE IF NOT EXISTS "CRM_Opticas".suscripciones_push (
        id BIGSERIAL PRIMARY KEY,
        usuario_id BIGINT REFERENCES "CRM_Opticas".usuarios(id) ON DELETE CASCADE,
        optica_id BIGINT NOT NULL REFERENCES "CRM_Opticas".opticas(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_suscripciones_push_optica ON "CRM_Opticas".suscripciones_push (optica_id);
    `);

    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'CRM_Opticas'
      ORDER BY table_name;
    `);
    const nombres = res.rows.map((r) => r.table_name).join(', ');
    console.log(`🔌 Conexión activa a Supabase Postgres [CRM_Opticas]. Tablas disponibles: ${nombres}`);
  } catch (error) {
    console.error('❌ Error al inicializar conexión con Supabase Postgres:', error.message);
  }
}

// Inicializar verificación de conexión al importar
inicializar_base_datos();

