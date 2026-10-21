/**
 * Gestor de Canales de Atención y Conexión Zernio
 * Convención de código: Estrictamente en español
 */

import { ClienteZernio } from './cliente_zernio.mjs';
import { pool } from '../base_datos/conexion.mjs';

const cliente_zernio = new ClienteZernio();
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jwctsfnkyfokrgtcjtxs.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3Y3RzZm5reWZva3JndGNqdHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3OTE2NjgsImV4cCI6MjEwNjM2NzY2OH0.I5jL8UKofVyZCFqt2FxxqnTCxgmRNypoB3AsESKYNNo';

/**
 * Sube un nuevo logotipo a Supabase Storage y elimina el anterior si existía
 */
export async function subir_logo_storage_optica(optica_id = 1, { buffer, tipo_mime = 'image/png', nombre_original = '' } = {}) {
  try {
    const idOpticaSeguro = Number(optica_id) > 0 ? Number(optica_id) : 1;

    if (!buffer || buffer.length === 0) {
      return { exito: false, error: 'No se recibió contenido de imagen' };
    }

    // 1. Determinar extensión adecuada
    let extension = 'png';
    if (tipo_mime.includes('jpeg') || tipo_mime.includes('jpg')) extension = 'jpeg';
    else if (tipo_mime.includes('webp')) extension = 'webp';
    else if (tipo_mime.includes('svg')) extension = 'svg';

    const nombreArchivoNuevo = `logo_${Date.now()}.${extension}`;
    const rutaRelativaDestino = `optica_${idOpticaSeguro}/${nombreArchivoNuevo}`;
    const urlSubida = `${SUPABASE_URL}/storage/v1/object/logos-opticas/${rutaRelativaDestino}`;

    console.log(`Subiendo nuevo logo a Supabase Storage: ${rutaRelativaDestino}...`);
    const resSubida = await fetch(urlSubida, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apiKey: SUPABASE_ANON_KEY,
        'Content-Type': tipo_mime,
        'x-upsert': 'true',
      },
      body: buffer,
    });

    if (!resSubida.ok) {
      const errTexto = await resSubida.text();
      console.error('Error al subir a Supabase Storage:', resSubida.status, errTexto);
      return { exito: false, error: `Error al subir imagen al almacenamiento (${resSubida.status})` };
    }

    const urlPublica = `${SUPABASE_URL}/storage/v1/object/public/logos-opticas/${rutaRelativaDestino}`;

    // 2. Limpiar la carpeta de la óptica: eliminar TODOS los archivos que no sean el nuevo logo
    try {
      const resListar = await fetch(`${SUPABASE_URL}/storage/v1/object/list/logos-opticas`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apiKey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefix: `optica_${idOpticaSeguro}` }),
      });

      if (resListar.ok) {
        const archivos = await resListar.json();
        if (Array.isArray(archivos)) {
          const archivosInnecesarios = archivos
            .filter((item) => item.name && item.name !== nombreArchivoNuevo)
            .map((item) => `optica_${idOpticaSeguro}/${item.name}`);

          if (archivosInnecesarios.length > 0) {
            console.log(`Eliminando ${archivosInnecesarios.length} archivo(s) antiguo(s) en optica_${idOpticaSeguro}:`, archivosInnecesarios);
            await fetch(`${SUPABASE_URL}/storage/v1/object/logos-opticas`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                apiKey: SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ prefixes: archivosInnecesarios }),
            });
          }
        }
      }
    } catch (errLimpieza) {
      console.warn('Aviso no bloqueante al depurar archivos antiguos en Storage:', errLimpieza.message);
    }

    // 3. Actualizar la base de datos con la nueva URL pública
    await pool.query(
      `UPDATE "CRM_Opticas".opticas SET logo_url = $1 WHERE id = $2`,
      [urlPublica, idOpticaSeguro]
    );

    return {
      exito: true,
      logo_url: urlPublica,
    };
  } catch (error) {
    console.error('Error en subir_logo_storage_optica:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Elimina todos los archivos de logotipo de la carpeta de la óptica en Supabase Storage
 */
export async function eliminar_logo_storage_optica(optica_id = 1) {
  try {
    const idOpticaSeguro = Number(optica_id) > 0 ? Number(optica_id) : 1;
    const resListar = await fetch(`${SUPABASE_URL}/storage/v1/object/list/logos-opticas`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apiKey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix: `optica_${idOpticaSeguro}` }),
    });

    if (resListar.ok) {
      const archivos = await resListar.json();
      if (Array.isArray(archivos) && archivos.length > 0) {
        const archivosAEliminar = archivos
          .filter((item) => item.name)
          .map((item) => `optica_${idOpticaSeguro}/${item.name}`);

        if (archivosAEliminar.length > 0) {
          console.log(`[Storage] Eliminando ${archivosAEliminar.length} archivo(s) de logo en optica_${idOpticaSeguro}:`, archivosAEliminar);
          await fetch(`${SUPABASE_URL}/storage/v1/object/logos-opticas`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              apiKey: SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prefixes: archivosAEliminar }),
          });
        }
      }
    }

    return { exito: true };
  } catch (error) {
    console.error('Error en eliminar_logo_storage_optica:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Obtiene el estado consolidado de los canales de la óptica
 */
export async function obtener_canales_optica(optica_id = 1) {
  try {
    // 1. Consultar estado en base de datos local
    const resOptica = await pool.query(
      `SELECT 
        id, nombre, slug, logo_url, color_primario, color_secundario, telefono, 
        activo,
        duracion_cita_minutos, control_meses_defecto, especialista_defecto, 
        registro_profesional_defecto, motivo_cita_defecto, notificacion_auto_citas_whatsapp,
        dias_atencion, hora_inicio_atencion, hora_fin_atencion,
        COALESCE(ia_activa, true) AS ia_activa,
        COALESCE(ia_habilitada, true) AS ia_habilitada
       FROM "CRM_Opticas".opticas WHERE id = $1`,
      [optica_id]
    );
    const optica = resOptica.rows[0] ? {
      ...resOptica.rows[0],
      ia_activa: Boolean(resOptica.rows[0].ia_activa ?? true),
      ia_habilitada: resOptica.rows[0].ia_habilitada !== false,
    } : null;

    // 2. Consultar línea guardada en BD
    const resLinea = await pool.query(
      `SELECT numero, etiqueta, estado, id_cuenta_zernio 
       FROM "CRM_Opticas".lineas_canales 
       WHERE optica_id = $1 AND canal = 'whatsapp' 
       ORDER BY id DESC LIMIT 1`,
      [optica_id]
    );
    const lineaGuardada = resLinea.rows[0];
    const idCuenta = lineaGuardada?.id_cuenta_zernio;

    // 3. Consultar cuentas en Zernio API en tiempo real
    let cuentasZernio = [];
    try {
      const resZernio = await cliente_zernio.obtener_cuentas();
      if (resZernio.exito && Array.isArray(resZernio.datos?.accounts)) {
        cuentasZernio = resZernio.datos.accounts;
      }
    } catch (eZernio) {
      console.warn('Aviso: Consulta a Zernio API omitida o fallida:', eZernio.message);
    }

    let cuentaWhatsApp = null;

    if (idCuenta) {
      const cuentaWpZernio = cuentasZernio.find(
        (c) => (c._id === idCuenta || c.id === idCuenta) && c.platform === 'whatsapp'
      );

      const numero = cuentaWpZernio?.metadata?.displayPhoneNumber || 
                     cuentaWpZernio?.username || 
                     cuentaWpZernio?.platformUserId || 
                     lineaGuardada?.numero || '';

      const nombreMostrado = cuentaWpZernio?.displayName || 
                             cuentaWpZernio?.metadata?.verifiedName || 
                             lineaGuardada?.etiqueta || 
                             'WhatsApp Business';

      const conectado = Boolean(lineaGuardada?.estado === 'activa');

      cuentaWhatsApp = {
        id_cuenta_zernio: idCuenta,
        numero: numero,
        nombre_mostrado: nombreMostrado,
        conectado: conectado,
        tiene_cuenta_guardada: true,
        es_coexistencia: Boolean(cuentaWpZernio?.metadata?.isCoexistence),
        calidad: cuentaWpZernio?.metadata?.qualityRating || 'GREEN',
        estado_meta: cuentaWpZernio?.metadata?.metaStatus || 'CONNECTED',
        limite_mensajeria: cuentaWpZernio?.metadata?.messagingLimitTier || 'TIER_250',
        conectado_en: cuentaWpZernio?.metadata?.connectedAt || cuentaWpZernio?.createdAt,
      };
    }

    return {
      exito: true,
      optica,
      cuenta_whatsapp: cuentaWhatsApp,
      total_cuentas_zernio: cuentasZernio.length,
    };
  } catch (error) {
    console.error('Error al obtener canales de la óptica:', error);
    return {
      exito: false,
      error: error.message,
    };
  }
}

/**
 * Obtiene la URL de autorización para el popup de conexión de WhatsApp
 */
export async function obtener_url_conexion_whatsapp(optica_id = 1, url_redireccion = '') {
  try {
    const res = await cliente_zernio.obtener_url_autorizacion('whatsapp', {
      url_redireccion: url_redireccion || undefined,
      modo_onboarding: 'business_app',
    });

    if (!res.exito) {
      return {
        exito: false,
        error: res.error?.mensaje || 'No se pudo generar la URL de conexión',
      };
    }

    return {
      exito: true,
      url_autorizacion: res.datos?.authUrl,
      estado: res.datos?.state,
    };
  } catch (error) {
    console.error('Error al generar URL de conexión WhatsApp:', error);
    return {
      exito: false,
      error: error.message,
    };
  }
}

/**
 * Desconecta o desvincula la cuenta de WhatsApp
 */
export async function desconectar_canal_whatsapp(optica_id = 1, { cambiar_numero = false } = {}) {
  try {
    if (cambiar_numero) {
      // 1. Obtener ID de cuenta para eliminarla del proveedor
      const resLinea = await pool.query(
        `SELECT id_cuenta_zernio FROM "CRM_Opticas".lineas_canales WHERE optica_id = $1 AND canal = 'whatsapp' ORDER BY id DESC LIMIT 1`,
        [optica_id]
      );
      const idCuentaZernio = resLinea.rows[0]?.id_cuenta_zernio;

      if (idCuentaZernio) {
        try {
          const resZernio = await cliente_zernio.eliminar_cuenta(idCuentaZernio);
          console.log(`Resultado eliminación de cuenta ${idCuentaZernio}:`, resZernio);
        } catch (errElim) {
          console.warn(`Aviso: Error no bloqueante al eliminar cuenta:`, errElim.message);
        }
      }

      // 2. Limpiar completamente en BD (lineas_canales)
      await pool.query(
        `UPDATE "CRM_Opticas".lineas_canales SET id_cuenta_zernio = NULL, estado = 'inactiva' WHERE optica_id = $1 AND canal = 'whatsapp'`,
        [optica_id]
      );

      return {
        exito: true,
        mensaje: 'Número desvinculado con éxito. Ahora puedes conectar uno nuevo.',
      };
    }

    // Desconexión simple del canal (mantiene el número guardado)
    await pool.query(
      `UPDATE "CRM_Opticas".lineas_canales SET estado = 'inactiva' WHERE optica_id = $1 AND canal = 'whatsapp'`,
      [optica_id]
    );

    return {
      exito: true,
      mensaje: 'Canal de WhatsApp desconectado con éxito',
    };
  } catch (error) {
    console.error('Error al desconectar canal de WhatsApp:', error);
    return {
      exito: false,
      error: error.message,
    };
  }
}

/**
 * Reconecta la cuenta existente en la óptica
 */
export async function reconectar_canal_whatsapp(optica_id = 1) {
  try {
    await pool.query(
      `UPDATE "CRM_Opticas".lineas_canales SET estado = 'activa' WHERE optica_id = $1 AND canal = 'whatsapp'`,
      [optica_id]
    );

    return {
      exito: true,
      mensaje: 'Canal de WhatsApp reconectado con éxito',
    };
  } catch (error) {
    console.error('Error al reconectar canal de WhatsApp:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Vincula la cuenta activa de WhatsApp a la óptica
 */
export async function vincular_cuenta_whatsapp_activa(optica_id = 1) {
  try {
    const resZernio = await cliente_zernio.obtener_cuentas();
    if (!resZernio.exito || !Array.isArray(resZernio.datos?.accounts)) {
      return { exito: false, error: 'No se pudieron consultar cuentas activas' };
    }

    const cuentaWp = resZernio.datos.accounts.find((c) => c.platform === 'whatsapp' && c.isActive && c.enabled);
    if (!cuentaWp) {
      return { exito: false, error: 'No se encontró ninguna cuenta de WhatsApp activa' };
    }

    const idCuenta = cuentaWp._id || cuentaWp.id;
    const numero = cuentaWp.metadata?.displayPhoneNumber || cuentaWp.username || cuentaWp.platformUserId || '';

    const resUpdate = await pool.query(
      `UPDATE "CRM_Opticas".lineas_canales SET estado = 'activa', id_cuenta_zernio = $1, numero = $2 WHERE optica_id = $3 AND canal = 'whatsapp'`,
      [idCuenta, numero, optica_id]
    );

    if (resUpdate.rowCount === 0) {
      await pool.query(
        `INSERT INTO "CRM_Opticas".lineas_canales (optica_id, canal, numero, id_cuenta_zernio, etiqueta, estado, es_predeterminada)
         VALUES ($1, 'whatsapp', $2, $3, 'Línea WhatsApp Principal', 'activa', true)`,
        [optica_id, numero, idCuenta]
      );
    }

    return {
      exito: true,
      id_cuenta_zernio: idCuenta,
      numero,
    };
  } catch (error) {
    console.error('Error al vincular cuenta activa de WhatsApp:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Actualiza la información general de la óptica
 */
export async function actualizar_datos_optica(optica_id = 1, datos = {}) {
  try {
    const idOpticaSeguro = Number(optica_id) > 0 ? Number(optica_id) : 1;
    const {
      nombre,
      telefono,
      color_primario,
      color_secundario,
      logo_url,
      duracion_cita_minutos,
      control_meses_defecto,
      especialista_defecto,
      registro_profesional_defecto,
      motivo_cita_defecto,
      notificacion_auto_citas_whatsapp,
      dias_atencion,
      hora_inicio_atencion,
      hora_fin_atencion,
    } = datos;

    const campos = [];
    const valores = [];
    let indice = 1;

    if (nombre !== undefined && nombre !== null) {
      campos.push(`nombre = $${indice++}`);
      valores.push(String(nombre).trim());
    }
    if (telefono !== undefined && telefono !== null) {
      campos.push(`telefono = $${indice++}`);
      valores.push(String(telefono).trim());
    }
    if (color_primario !== undefined && color_primario !== null) {
      campos.push(`color_primario = $${indice++}`);
      valores.push(String(color_primario).trim());
    }
    if (color_secundario !== undefined && color_secundario !== null) {
      campos.push(`color_secundario = $${indice++}`);
      valores.push(String(color_secundario).trim());
    }
    if (logo_url !== undefined) {
      campos.push(`logo_url = $${indice++}`);
      valores.push(logo_url ? String(logo_url).trim() : null);
    }
    if (duracion_cita_minutos !== undefined && duracion_cita_minutos !== null) {
      campos.push(`duracion_cita_minutos = $${indice++}`);
      valores.push(Number(duracion_cita_minutos) || 30);
    }
    if (control_meses_defecto !== undefined && control_meses_defecto !== null) {
      campos.push(`control_meses_defecto = $${indice++}`);
      valores.push(Number(control_meses_defecto) || 12);
    }
    if (especialista_defecto !== undefined && especialista_defecto !== null) {
      campos.push(`especialista_defecto = $${indice++}`);
      valores.push(String(especialista_defecto).trim());
    }
    if (registro_profesional_defecto !== undefined && registro_profesional_defecto !== null) {
      campos.push(`registro_profesional_defecto = $${indice++}`);
      valores.push(String(registro_profesional_defecto).trim());
    }
    if (motivo_cita_defecto !== undefined && motivo_cita_defecto !== null) {
      campos.push(`motivo_cita_defecto = $${indice++}`);
      valores.push(String(motivo_cita_defecto).trim());
    }
    if (notificacion_auto_citas_whatsapp !== undefined && notificacion_auto_citas_whatsapp !== null) {
      campos.push(`notificacion_auto_citas_whatsapp = $${indice++}`);
      valores.push(Boolean(notificacion_auto_citas_whatsapp));
    }
    if (dias_atencion !== undefined && dias_atencion !== null) {
      campos.push(`dias_atencion = $${indice++}`);
      valores.push(String(dias_atencion).trim());
    }
    if (hora_inicio_atencion !== undefined && hora_inicio_atencion !== null) {
      campos.push(`hora_inicio_atencion = $${indice++}`);
      valores.push(String(hora_inicio_atencion).trim());
    }
    if (hora_fin_atencion !== undefined && hora_fin_atencion !== null) {
      campos.push(`hora_fin_atencion = $${indice++}`);
      valores.push(String(hora_fin_atencion).trim());
    }

    if (campos.length === 0) {
      const resActual = await pool.query(`SELECT * FROM "CRM_Opticas".opticas WHERE id = $1`, [idOpticaSeguro]);
      return { exito: true, optica: resActual.rows[0], mensaje: 'Sin cambios requeridos' };
    }

    valores.push(idOpticaSeguro);
    const consulta = `
      UPDATE "CRM_Opticas".opticas 
      SET ${campos.join(', ')} 
      WHERE id = $${indice} 
      RETURNING *
    `;

    const resultado = await pool.query(consulta, valores);

    if (!resultado.rows || resultado.rows.length === 0) {
      return {
        exito: false,
        error: `No se encontró la óptica con ID ${idOpticaSeguro}`,
      };
    }

    return {
      exito: true,
      optica: resultado.rows[0],
    };
  } catch (error) {
    console.error('Error al actualizar datos de la óptica:', error);
    return {
      exito: false,
      error: error.message,
    };
  }
}
