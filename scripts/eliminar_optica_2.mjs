import { base_datos, pool } from '../cliente/src/backend/base_datos/conexion.mjs';

async function eliminarOptica2() {
  console.log('Iniciando eliminación completa de Óptica ID = 2 ("Óptica Lumina")...');

  const clientePg = await pool.connect();
  try {
    await clientePg.query('BEGIN');

    // 1. Obtener IDs de conversaciones de la óptica 2
    const resConv = await clientePg.query('SELECT id FROM "CRM_Opticas".conversaciones WHERE optica_id = 2');
    const convIds = resConv.rows.map(r => r.id);
    console.log(`Conversaciones encontradas: ${convIds.length}`);

    // 2. Eliminar mensajes asociados a esas conversaciones
    if (convIds.length > 0) {
      const resMsg = await clientePg.query(
        'DELETE FROM "CRM_Opticas".mensajes WHERE conversacion_id = ANY($1)',
        [convIds]
      );
      console.log(`✓ Mensajes eliminados: ${resMsg.rowCount}`);
    }

    // 3. Eliminar conversaciones
    const delConv = await clientePg.query('DELETE FROM "CRM_Opticas".conversaciones WHERE optica_id = 2');
    console.log(`✓ Conversaciones eliminadas: ${delConv.rowCount}`);

    // 4. Eliminar fórmulas ópticas (si hubiera)
    const delForm = await clientePg.query('DELETE FROM "CRM_Opticas".formulas_opticas WHERE optica_id = 2');
    console.log(`✓ Fórmulas ópticas eliminadas: ${delForm.rowCount}`);

    // 5. Eliminar citas (si hubiera)
    const delCitas = await clientePg.query('DELETE FROM "CRM_Opticas".citas WHERE optica_id = 2');
    console.log(`✓ Citas eliminadas: ${delCitas.rowCount}`);

    // 6. Eliminar contactos (pacientes)
    const delCont = await clientePg.query('DELETE FROM "CRM_Opticas".contactos WHERE optica_id = 2');
    console.log(`✓ Contactos eliminados: ${delCont.rowCount}`);

    // 7. Eliminar plantillas
    const delPlant = await clientePg.query('DELETE FROM "CRM_Opticas".plantillas WHERE optica_id = 2');
    console.log(`✓ Plantillas eliminadas: ${delPlant.rowCount}`);

    // 8. Eliminar lineas_canales
    const delLin = await clientePg.query('DELETE FROM "CRM_Opticas".lineas_canales WHERE optica_id = 2');
    console.log(`✓ Líneas/Canales eliminados: ${delLin.rowCount}`);

    // 9. Eliminar campañas y segmentos si los hubiera
    try {
      const delCamp = await clientePg.query('DELETE FROM "CRM_Opticas".campanas WHERE optica_id = 2');
      console.log(`✓ Campañas eliminadas: ${delCamp.rowCount}`);
    } catch {}
    try {
      const delSeg = await clientePg.query('DELETE FROM "CRM_Opticas".segmentos WHERE optica_id = 2');
      console.log(`✓ Segmentos eliminados: ${delSeg.rowCount}`);
    } catch {}

    // 10. Eliminar consumo_ia
    const delCons = await clientePg.query('DELETE FROM "CRM_Opticas".consumo_ia WHERE optica_id = 2');
    console.log(`✓ Consumo IA eliminado: ${delCons.rowCount}`);

    // 11. Eliminar recuperación de contraseña de usuarios de la óptica 2
    try {
      await clientePg.query(`
        DELETE FROM "CRM_Opticas".recuperacion_contrasena 
        WHERE usuario_id IN (SELECT id FROM "CRM_Opticas".usuarios WHERE optica_id = 2)
      `);
      console.log('✓ Tokens de recuperación eliminados');
    } catch {}

    // 12. Eliminar usuarios de la óptica 2
    const delUsr = await clientePg.query('DELETE FROM "CRM_Opticas".usuarios WHERE optica_id = 2');
    console.log(`✓ Usuarios de óptica 2 eliminados: ${delUsr.rowCount}`);

    // 13. Eliminar la óptica 2
    const delOpt = await clientePg.query('DELETE FROM "CRM_Opticas".opticas WHERE id = 2');
    console.log(`✓ Registro de óptica 2 eliminado: ${delOpt.rowCount}`);

    // 14. Reiniciar la secuencia de ID de opticas para que el próximo sea 2
    await clientePg.query(`SELECT setval('"CRM_Opticas".opticas_id_seq', 1, true)`);
    console.log('✓ Secuencia opticas_id_seq reiniciada en 1 (próximo valor: 2)');

    await clientePg.query('COMMIT');
    console.log('\n✅ Transacción completada con éxito. Base de datos limpia y secuencia lista.');
  } catch (error) {
    await clientePg.query('ROLLBACK');
    console.error('❌ Error durante la eliminación, rollback efectuado:', error);
  } finally {
    clientePg.release();
    await pool.end();
  }
}

eliminarOptica2().catch(console.error);

