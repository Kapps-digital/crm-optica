import { pool } from '../cliente/src/backend/base_datos/conexion.mjs';

/**
 * Script para asegurar la existencia de la columna fecha_vencimiento
 * en la tabla opticas del esquema CRM_Opticas de PostgreSQL (Supabase)
 * Calculada en zona horaria America/Bogota (Colombia).
 */
async function asegurarColumnaSuscripcion() {
  try {
    console.log('--- Verificando columna fecha_vencimiento en CRM_Opticas.opticas ---');

    await pool.query(`
      ALTER TABLE "CRM_Opticas".opticas 
      ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMPTZ;
    `);

    // Inicializar ópticas que tengan fecha_vencimiento nula con 1 mes hacia adelante a las 23:59:59 hora Colombia
    // (NOW() AT TIME ZONE 'America/Bogota' + INTERVAL '1 month')
    await pool.query(`
      UPDATE "CRM_Opticas".opticas
      SET fecha_vencimiento = (
        (date_trunc('day', (NOW() AT TIME ZONE 'America/Bogota' + INTERVAL '1 month')) + TIME '23:59:59') AT TIME ZONE 'America/Bogota'
      )
      WHERE fecha_vencimiento IS NULL;
    `);

    console.log('✓ Columna fecha_vencimiento asegurada correctamente con horario Colombia.');

    const res = await pool.query(`
      SELECT 
        id, 
        nombre, 
        slug, 
        activo, 
        fecha_vencimiento,
        fecha_vencimiento AT TIME ZONE 'America/Bogota' AS fecha_colombia
      FROM "CRM_Opticas".opticas
      ORDER BY id ASC;
    `);

    console.log('Ópticas y sus fechas de vencimiento:');
    for (const o of res.rows) {
      console.log(` - [${o.id}] ${o.nombre} (${o.slug}): Vence=${o.fecha_colombia} (Activo=${o.activo})`);
    }

  } catch (error) {
    console.error('❌ Error al asegurar columna fecha_vencimiento:', error);
  } finally {
    await pool.end();
  }
}

asegurarColumnaSuscripcion();

