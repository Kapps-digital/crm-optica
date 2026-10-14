import { pool } from '../base_datos/conexion.mjs';

async function revisarConv9() {
  try {
    const msgs = await pool.query(`
      SELECT id, direccion, SUBSTRING(texto, 1, 40) as texto, estado_entrega, creado_en 
      FROM mensajes 
      WHERE conversacion_id = 9 
      ORDER BY creado_en DESC 
      LIMIT 10
    `);
    console.table(msgs.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

revisarConv9();
