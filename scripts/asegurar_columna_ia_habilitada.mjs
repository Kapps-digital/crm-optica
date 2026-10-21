import { pool } from '../cliente/src/backend/base_datos/conexion.mjs';

/**
 * Script para asegurar la existencia de la columna ia_habilitada
 * en la tabla opticas del esquema CRM_Opticas de PostgreSQL (Supabase)
 */
async function asegurarColumnaIaHabilitada() {
  try {
    console.log('--- Verificando y agregando columna ia_habilitada en CRM_Opticas.opticas ---');

    await pool.query(`
      ALTER TABLE "CRM_Opticas".opticas 
      ADD COLUMN IF NOT EXISTS ia_habilitada BOOLEAN DEFAULT true;

      UPDATE "CRM_Opticas".opticas 
      SET ia_habilitada = true 
      WHERE ia_habilitada IS NULL;
    `);

    console.log('✓ Columna ia_habilitada asegurada correctamente con valor por defecto true.');

    const res = await pool.query(`
      SELECT id, nombre, slug, activo, ia_activa, ia_habilitada
      FROM "CRM_Opticas".opticas
      ORDER BY id ASC;
    `);

    console.log('Ópticas registradas y estado de ia_habilitada:');
    for (const o of res.rows) {
      console.log(` - [${o.id}] ${o.nombre} (${o.slug}): Activo=${o.activo}, IA_Activa=${o.ia_activa}, IA_Habilitada=${o.ia_habilitada}`);
    }

  } catch (error) {
    console.error('❌ Error al asegurar columna ia_habilitada:', error);
  } finally {
    await pool.end();
  }
}

asegurarColumnaIaHabilitada();
