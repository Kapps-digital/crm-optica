import { pool } from '../base_datos/conexion.mjs';
import { ClienteZernio } from '../servicios/cliente_zernio.mjs';

async function revisarPlantillas() {
  try {
    const pDb = await pool.query("SELECT id, nombre, categoria, idioma, estado, encabezado_tipo FROM plantillas");
    console.log('Plantillas en Base de Datos:');
    console.table(pDb.rows);

    const c = new ClienteZernio();
    const pZernio = await c.solicitar('/whatsapp/templates?accountId=6ab6a5ade55ed05c5f3a902b');
    console.log('\nPlantillas en Zernio:');
    console.log(JSON.stringify(pZernio.datos, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

revisarPlantillas();
