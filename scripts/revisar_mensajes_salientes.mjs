import { pool } from '../base_datos/conexion.mjs';

async function revisar() {
  try {
    const convs = await pool.query(`
      SELECT c.id, c.contacto_id, c.canal, c.id_cuenta_zernio, c.id_conversacion_zernio, 
             c.ultimo_mensaje_entrante_en, c.actualizado_en,
             ct.nombre_completo, ct.telefono, ct.business_scoped_user_id
      FROM conversaciones c
      LEFT JOIN contactos ct ON ct.id = c.contacto_id
      ORDER BY c.actualizado_en DESC 
      LIMIT 5
    `);
    console.log('Conversaciones recientes:');
    console.table(convs.rows);

    const msgs = await pool.query(`
      SELECT id, conversacion_id, id_mensaje_plataforma, id_mensaje_zernio, direccion, 
             SUBSTRING(texto, 1, 40) as texto_corto, estado_entrega, creado_en 
      FROM mensajes 
      ORDER BY id DESC 
      LIMIT 8
    `);
    console.log('\nMensajes recientes:');
    console.table(msgs.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

revisar();
