import { pool } from '../cliente/src/backend/base_datos/conexion.mjs';

/**
 * Script para crear y asegurar la existencia de la tabla consumo_ia
 * en el esquema CRM_Opticas de PostgreSQL (Supabase)
 */
async function asegurarTablaConsumoIA() {
  try {
    console.log('--- Verificando y Creando Tabla consumo_ia en CRM_Opticas ---');

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
    `);

    console.log('✓ Tabla consumo_ia e índices verificados/creados correctamente en CRM_Opticas.');

    const resCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'CRM_Opticas' AND table_name = 'consumo_ia'
      ORDER BY ordinal_position;
    `);

    console.log('Columnas de la tabla:');
    for (const c of resCols.rows) {
      console.log(` - ${c.column_name}: ${c.data_type} (Default: ${c.column_default})`);
    }

  } catch (error) {
    console.error('❌ Error al asegurar la tabla consumo_ia:', error);
  } finally {
    await pool.end();
  }
}

asegurarTablaConsumoIA();
