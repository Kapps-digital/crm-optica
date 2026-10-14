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
