import { pool } from '../base_datos/conexion.mjs';

async function revisarFallos() {
  try {
    const res = await pool.query(`
      SELECT id_evento, tipo_evento, estado, payload_json, creado_en 
      FROM eventos_webhook 
      WHERE tipo_evento = 'message.failed' 
      ORDER BY creado_en DESC 
      LIMIT 3
    `);
    console.log('Eventos message.failed encontrados:', res.rows.length);
    for (const r of res.rows) {
      console.log('\n--- EVENTO:', r.id_evento, r.creado_en);
      console.log(JSON.stringify(r.payload_json, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

revisarFallos();
