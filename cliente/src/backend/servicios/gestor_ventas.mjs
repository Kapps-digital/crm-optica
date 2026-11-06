import { pool } from '../base_datos/conexion.mjs';

/**
 * Formatea un número de factura con ceros a la izquierda (mínimo 4 dígitos) y prefijo opcional
 * @param {string} prefijo 
 * @param {number|string} numero 
 * @returns {string} Ej: 'FAC-0001'
 */
export function formatearNumeroFactura(prefijo = 'FAC-', numero = 1) {
  const numSeguro = Math.max(1, parseInt(String(numero), 10) || 1);
  const prefijoLimpio = String(prefijo || '').trim();
  return `${prefijoLimpio}${String(numSeguro).padStart(4, '0')}`;
}

/**
 * Obtiene la configuración de facturación para la óptica
 * @param {number} opticaId 
 */
export async function obtenerConfiguracionFacturacion(opticaId) {
  const idOpticaSeguro = Number(opticaId) || 1;

  // 1. Verificar si existen ventas registradas
  const resConteo = await pool.query(
    'SELECT COUNT(*)::int AS total FROM "CRM_Opticas".ventas WHERE optica_id = $1',
    [idOpticaSeguro]
  );
  const totalVentas = Number(resConteo.rows[0]?.total || 0);
  const tieneVentas = totalVentas > 0;

  // 2. Obtener o inicializar configuración
  let res = await pool.query(
    'SELECT prefijo, siguiente_numero, bloqueado, actualizado_en FROM "CRM_Opticas".configuracion_facturacion WHERE optica_id = $1',
    [idOpticaSeguro]
  );

  if (res.rows.length === 0) {
    await pool.query(
      `INSERT INTO "CRM_Opticas".configuracion_facturacion (optica_id, prefijo, siguiente_numero, bloqueado)
       VALUES ($1, 'FAC-', 1, FALSE)
       ON CONFLICT (optica_id) DO NOTHING`,
      [idOpticaSeguro]
    );
    res = await pool.query(
      'SELECT prefijo, siguiente_numero, bloqueado, actualizado_en FROM "CRM_Opticas".configuracion_facturacion WHERE optica_id = $1',
      [idOpticaSeguro]
    );
  }

  const fila = res.rows[0] || { prefijo: 'FAC-', siguiente_numero: 1, bloqueado: false };
  const prefijo = fila.prefijo || 'FAC-';
  const siguienteNumero = Number(fila.siguiente_numero) || 1;
  const bloqueado = tieneVentas || Boolean(fila.bloqueado);

  return {
    exito: true,
    optica_id: idOpticaSeguro,
    prefijo,
    siguiente_numero: siguienteNumero,
    proxima_factura: formatearNumeroFactura(prefijo, siguienteNumero),
    bloqueado,
    total_ventas: totalVentas,
  };
}

/**
 * Guarda o actualiza la configuración inicial de facturación (solo si no hay ventas emitidas)
 * @param {number} opticaId 
 * @param {{ prefijo?: string, siguiente_numero?: number }} datos 
 */
export async function guardarConfiguracionFacturacion(opticaId, { prefijo = 'FAC-', siguiente_numero = 1 } = {}) {
  const idOpticaSeguro = Number(opticaId) || 1;

  // Validar si ya existen ventas emitidas
  const resConteo = await pool.query(
    'SELECT COUNT(*)::int AS total FROM "CRM_Opticas".ventas WHERE optica_id = $1',
    [idOpticaSeguro]
  );
  const totalVentas = Number(resConteo.rows[0]?.total || 0);
  if (totalVentas > 0) {
    throw new Error('No es posible modificar el consecutivo inicial porque la óptica ya cuenta con facturas emitidas.');
  }

  const prefijoLimpio = String(prefijo || '').trim();
  const numSeguro = Math.max(1, parseInt(String(siguiente_numero), 10) || 1);

  await pool.query(
    `INSERT INTO "CRM_Opticas".configuracion_facturacion (optica_id, prefijo, siguiente_numero, bloqueado, actualizado_en)
     VALUES ($1, $2, $3, FALSE, NOW())
     ON CONFLICT (optica_id) DO UPDATE SET
       prefijo = EXCLUDED.prefijo,
       siguiente_numero = EXCLUDED.siguiente_numero,
       actualizado_en = NOW()`,
    [idOpticaSeguro, prefijoLimpio, numSeguro]
  );

  return {
    exito: true,
    prefijo: prefijoLimpio,
    siguiente_numero: numSeguro,
    proxima_factura: formatearNumeroFactura(prefijoLimpio, numSeguro),
  };
}

/**
 * Obtiene el listado de vendedores activos de la óptica
 * @param {number} opticaId 
 * @param {boolean} incluirInactivos 
 */
export async function obtenerVendedores(opticaId, incluirInactivos = false) {
  const idOpticaSeguro = Number(opticaId) || 1;
  const condicionActivo = incluirInactivos ? '' : 'AND activo = TRUE';

  const res = await pool.query(
    `SELECT id, optica_id, nombre, activo, creado_en 
     FROM "CRM_Opticas".vendedores
     WHERE optica_id = $1 ${condicionActivo}
     ORDER BY activo DESC, nombre ASC`,
    [idOpticaSeguro]
  );

  return res.rows;
}

/**
 * Crea o reactiva un vendedor para la óptica
 * @param {number} opticaId 
 * @param {string} nombre 
 */
export async function crearVendedor(opticaId, nombre) {
  const idOpticaSeguro = Number(opticaId) || 1;
  const nombreLimpio = String(nombre || '').trim();

  if (!nombreLimpio) {
    throw new Error('El nombre del vendedor es obligatorio.');
  }

  const res = await pool.query(
    `INSERT INTO "CRM_Opticas".vendedores (optica_id, nombre, activo, creado_en, actualizado_en)
     VALUES ($1, $2, TRUE, NOW(), NOW())
     ON CONFLICT (optica_id, nombre) DO UPDATE SET
       activo = TRUE,
       actualizado_en = NOW()
     RETURNING id, optica_id, nombre, activo`,
    [idOpticaSeguro, nombreLimpio]
  );

  return res.rows[0];
}

/**
 * Activa o desactiva un vendedor (borrado lógico para preservar integridad histórica de ventas)
 * @param {number} opticaId 
 * @param {number} vendedorId 
 * @param {boolean} [activo=false]
 */
export async function desactivarVendedor(opticaId, vendedorId, activo = false) {
  const idOpticaSeguro = Number(opticaId) || 1;
  const idVendedorSeguro = Number(vendedorId);
  const estadoActivo = Boolean(activo);

  await pool.query(
    'UPDATE "CRM_Opticas".vendedores SET activo = $1, actualizado_en = NOW() WHERE id = $2 AND optica_id = $3',
    [estadoActivo, idVendedorSeguro, idOpticaSeguro]
  );

  return { exito: true };
}

export async function cambiarEstadoVendedor(opticaId, vendedorId, activo) {
  return desactivarVendedor(opticaId, vendedorId, activo);
}

/**
 * Obtiene el listado de ventas con filtros y métricas consolidadas
 * @param {number} opticaId 
 * @param {{ busqueda?: string, vendedor_id?: number, estado_pago?: string, fecha_inicio?: string, fecha_fin?: string, limite?: number, pagina?: number }} filtros 
 */
export async function obtenerVentas(opticaId, filtros = {}) {
  const idOpticaSeguro = Number(opticaId) || 1;
  const {
    busqueda = '',
    vendedor_id = null,
    estado_pago = '',
    fecha_inicio = null,
    fecha_fin = null,
    limite = 100,
    pagina = 1,
  } = filtros;

  const condiciones = ['v.optica_id = $1'];
  const valores = [idOpticaSeguro];
  let indice = 2;

  if (busqueda && busqueda.trim()) {
    const termino = `%${busqueda.trim()}%`;
    condiciones.push(`(
      v.numero_factura ILIKE $${indice} OR
      v.nombre_cliente ILIKE $${indice} OR
      v.celular_cliente ILIKE $${indice} OR
      v.producto ILIKE $${indice} OR
      vend.nombre ILIKE $${indice}
    )`);
    valores.push(termino);
    indice++;
  }

  if (vendedor_id && Number(vendedor_id) > 0) {
    condiciones.push(`v.vendedor_id = $${indice}`);
    valores.push(Number(vendedor_id));
    indice++;
  }

  if (estado_pago && estado_pago.trim()) {
    condiciones.push(`v.estado_pago = $${indice}`);
    valores.push(estado_pago.trim());
    indice++;
  }

  if (fecha_inicio) {
    condiciones.push(`v.fecha >= $${indice}::date`);
    valores.push(fecha_inicio);
    indice++;
  }

  if (fecha_fin) {
    condiciones.push(`v.fecha <= ($${indice}::date + INTERVAL '1 day')`);
    valores.push(fecha_fin);
    indice++;
  }

  const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  // 1. Métricas consolidadas (KPIs)
  const queryMetricas = `
    SELECT 
      COUNT(*)::int AS total_facturas,
      COALESCE(SUM(v.valor_producto), 0)::numeric(14,2) AS suma_ventas,
      COALESCE(SUM(v.total_abonos), 0)::numeric(14,2) AS suma_recaudado,
      COALESCE(SUM(v.saldo_pendiente), 0)::numeric(14,2) AS suma_saldo_pendiente
    FROM "CRM_Opticas".ventas v
    LEFT JOIN "CRM_Opticas".vendedores vend ON vend.id = v.vendedor_id
    ${clausulaWhere}
  `;
  const resMetricas = await pool.query(queryMetricas, valores);
  const metricas = resMetricas.rows[0] || {
    total_facturas: 0,
    suma_ventas: 0,
    suma_recaudado: 0,
    suma_saldo_pendiente: 0,
  };

  // 2. Consulta de filas con paginación
  const limitNum = Math.min(500, Math.max(1, Number(limite) || 100));
  const offsetNum = Math.max(0, (Number(pagina) - 1) * limitNum);

  const queryVentas = `
    SELECT 
      v.id,
      v.optica_id,
      v.numero_factura,
      v.fecha,
      v.vendedor_id,
      vend.nombre AS nombre_vendedor,
      v.nombre_cliente,
      v.celular_cliente,
      v.producto,
      v.valor_producto::float AS valor_producto,
      v.abono_inicial::float AS abono_inicial,
      v.abono_2::float AS abono_2,
      v.abono_3::float AS abono_3,
      v.total_abonos::float AS total_abonos,
      v.saldo_pendiente::float AS saldo_pendiente,
      v.estado_pago,
      v.notas,
      v.creado_en,
      v.actualizado_en
    FROM "CRM_Opticas".ventas v
    LEFT JOIN "CRM_Opticas".vendedores vend ON vend.id = v.vendedor_id
    ${clausulaWhere}
    ORDER BY v.fecha DESC, v.id DESC
    LIMIT ${limitNum} OFFSET ${offsetNum}
  `;

  const resVentas = await pool.query(queryVentas, valores);

  return {
    exito: true,
    ventas: resVentas.rows,
    metricas: {
      total_facturas: Number(metricas.total_facturas),
      total_ventas: Number(metricas.suma_ventas),
      total_recaudado: Number(metricas.suma_recaudado),
      total_saldo_pendiente: Number(metricas.suma_saldo_pendiente),
    },
    pagina: Number(pagina),
    limite: limitNum,
  };
}

/**
 * Registra una nueva venta asignando de forma atómica el número de factura
 * @param {number} opticaId 
 * @param {object} datos 
 */
export async function crearVenta(opticaId, datos = {}) {
  const idOpticaSeguro = Number(opticaId) || 1;
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    // 1. Obtener y bloquear la configuración de facturación para asignar el siguiente consecutivo atómico
    let resConfig = await cliente.query(
      'SELECT prefijo, siguiente_numero FROM "CRM_Opticas".configuracion_facturacion WHERE optica_id = $1 FOR UPDATE',
      [idOpticaSeguro]
    );

    if (resConfig.rows.length === 0) {
      await cliente.query(
        `INSERT INTO "CRM_Opticas".configuracion_facturacion (optica_id, prefijo, siguiente_numero, bloqueado)
         VALUES ($1, 'FAC-', 1, TRUE)`,
        [idOpticaSeguro]
      );
      resConfig = await cliente.query(
        'SELECT prefijo, siguiente_numero FROM "CRM_Opticas".configuracion_facturacion WHERE optica_id = $1 FOR UPDATE',
        [idOpticaSeguro]
      );
    }

    const { prefijo, siguiente_numero } = resConfig.rows[0];
    const numeroConsecutivo = Number(siguiente_numero) || 1;
    const numeroFacturaFinal = formatearNumeroFactura(prefijo, numeroConsecutivo);

    // 2. Validar datos requeridos
    const vendedorId = Number(datos.vendedor_id);
    if (!vendedorId || isNaN(vendedorId)) {
      throw new Error('Debes seleccionar un vendedor válido.');
    }

    const nombreCliente = String(datos.nombre_cliente || '').trim();
    if (!nombreCliente) {
      throw new Error('El nombre del cliente es obligatorio.');
    }

    const celularCliente = String(datos.celular_cliente || '').trim() || null;
    const producto = String(datos.producto || '').trim();
    if (!producto) {
      throw new Error('El producto vendido es obligatorio.');
    }

    const valorProducto = Math.max(0, Number(datos.valor_producto) || 0);
    const abonoInicial = Math.max(0, Number(datos.abono_inicial) || 0);
    const abono2 = Math.max(0, Number(datos.abono_2) || 0);
    const abono3 = Math.max(0, Number(datos.abono_3) || 0);
    const notas = datos.notas ? String(datos.notas).trim() : null;

    const totalAbonosCalculado = abonoInicial + abono2 + abono3;
    const saldoPendienteCalculado = valorProducto - totalAbonosCalculado;

    let estadoPago = 'pendiente';
    if (saldoPendienteCalculado <= 0 && valorProducto > 0) {
      estadoPago = 'pagado';
    } else if (totalAbonosCalculado > 0) {
      estadoPago = 'parcial';
    }

    const fechaFinal = datos.fecha ? new Date(datos.fecha) : new Date();

    // 3. Insertar venta
    const resInsert = await cliente.query(
      `INSERT INTO "CRM_Opticas".ventas (
         optica_id, numero_factura, fecha, vendedor_id, nombre_cliente,
         celular_cliente, producto, valor_producto, abono_inicial,
         abono_2, abono_3, estado_pago, notas, creado_en, actualizado_en
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       RETURNING *`,
      [
        idOpticaSeguro,
        numeroFacturaFinal,
        fechaFinal,
        vendedorId,
        nombreCliente,
        celularCliente,
        producto,
        valorProducto,
        abonoInicial,
        abono2,
        abono3,
        estadoPago,
        notas,
      ]
    );

    // 4. Incrementar consecutivo y congelar configuración inicial
    await cliente.query(
      `UPDATE "CRM_Opticas".configuracion_facturacion 
       SET siguiente_numero = siguiente_numero + 1, bloqueado = TRUE, actualizado_en = NOW()
       WHERE optica_id = $1`,
      [idOpticaSeguro]
    );

    await cliente.query('COMMIT');

    // 5. Retornar venta enriquecida con nombre del vendedor
    const ventaCreada = resInsert.rows[0];
    const resVendedor = await pool.query('SELECT nombre FROM "CRM_Opticas".vendedores WHERE id = $1', [vendedorId]);
    ventaCreada.nombre_vendedor = resVendedor.rows[0]?.nombre || 'Vendedor';

    return {
      exito: true,
      venta: ventaCreada,
      mensaje: `Factura ${numeroFacturaFinal} registrada exitosamente.`,
    };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Actualiza los abonos o datos de una venta existente
 * @param {number} opticaId 
 * @param {number} ventaId 
 * @param {object} datos 
 */
export async function actualizarAbonosVenta(opticaId, ventaId, datos = {}) {
  const idOpticaSeguro = Number(opticaId) || 1;
  const idVentaSeguro = Number(ventaId);

  // Consultar venta actual
  const resExistente = await pool.query(
    'SELECT * FROM "CRM_Opticas".ventas WHERE id = $1 AND optica_id = $2',
    [idVentaSeguro, idOpticaSeguro]
  );

  if (resExistente.rows.length === 0) {
    throw new Error('Venta no encontrada.');
  }

  const vActual = resExistente.rows[0];
  const valorProducto = datos.valor_producto !== undefined ? Math.max(0, Number(datos.valor_producto)) : Number(vActual.valor_producto);
  const abonoInicial = datos.abono_inicial !== undefined ? Math.max(0, Number(datos.abono_inicial)) : Number(vActual.abono_inicial);
  const abono2 = datos.abono_2 !== undefined ? Math.max(0, Number(datos.abono_2)) : Number(vActual.abono_2 || 0);
  const abono3 = datos.abono_3 !== undefined ? Math.max(0, Number(datos.abono_3)) : Number(vActual.abono_3 || 0);
  const notas = datos.notas !== undefined ? (datos.notas ? String(datos.notas).trim() : null) : vActual.notas;

  const totalAbonos = abonoInicial + abono2 + abono3;
  const saldoPendiente = valorProducto - totalAbonos;

  let estadoPago = 'pendiente';
  if (saldoPendiente <= 0 && valorProducto > 0) {
    estadoPago = 'pagado';
  } else if (totalAbonos > 0) {
    estadoPago = 'parcial';
  }

  const resUpdate = await pool.query(
    `UPDATE "CRM_Opticas".ventas
     SET valor_producto = $1,
         abono_inicial = $2,
         abono_2 = $3,
         abono_3 = $4,
         estado_pago = $5,
         notas = $6,
         actualizado_en = NOW()
     WHERE id = $7 AND optica_id = $8
     RETURNING *`,
    [
      valorProducto,
      abonoInicial,
      abono2,
      abono3,
      estadoPago,
      notas,
      idVentaSeguro,
      idOpticaSeguro,
    ]
  );

  const ventaActualizada = resUpdate.rows[0];
  const resVend = await pool.query('SELECT nombre FROM "CRM_Opticas".vendedores WHERE id = $1', [ventaActualizada.vendedor_id]);
  ventaActualizada.nombre_vendedor = resVend.rows[0]?.nombre || 'Vendedor';

  return {
    exito: true,
    venta: ventaActualizada,
    mensaje: 'Venta y abonos actualizados correctamente.',
  };
}

/**
 * Elimina una venta
 * @param {number} opticaId 
 * @param {number} ventaId 
 */
export async function eliminarVenta(opticaId, ventaId) {
  const idOpticaSeguro = Number(opticaId) || 1;
  const idVentaSeguro = Number(ventaId);

  await pool.query(
    'DELETE FROM "CRM_Opticas".ventas WHERE id = $1 AND optica_id = $2',
    [idVentaSeguro, idOpticaSeguro]
  );

  return { exito: true, mensaje: 'Venta eliminada.' };
}

