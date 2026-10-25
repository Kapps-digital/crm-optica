import { pool } from '../base_datos/conexion.mjs';
import { obtenerPacientesDeSegmento } from './gestor_segmentacion.mjs';
import { ClienteZernio } from './cliente_zernio.mjs';

// Caché en memoria para evitar saturar la API de Zernio en consultas rápidas
let ultimaSincronizacionZernio = 0;
let cacheCuentaWp = null;
let cacheTimestampCuenta = 0;

/**
 * Obtiene la cuenta activa de WhatsApp desde Zernio
 */
export async function obtenerCuentaWhatsAppZernio() {
  const ahora = Date.now();
  if (cacheCuentaWp && (ahora - cacheTimestampCuenta < 60000)) {
    return cacheCuentaWp;
  }

  try {
    const cliente = new ClienteZernio();
    const res = await cliente.solicitar('/accounts');
    if (res.exito && res.datos?.accounts) {
      const cuenta = res.datos.accounts.find(
        (a) => a.platform === 'whatsapp' && (a.isActive || a.enabled)
      );
      if (cuenta) {
        cacheCuentaWp = cuenta;
        cacheTimestampCuenta = ahora;
        return cuenta;
      }
    }
  } catch (error) {
    console.warn('Advertencia al consultar cuenta WhatsApp en Zernio:', error.message);
  }

  return cacheCuentaWp;
}

/**
 * Obtiene el límite numérico diario según el messagingLimitTier de Meta
 */
export function calcularLimitePorTier(tier) {
  switch (tier) {
    case 'TIER_50':
      return 50;
    case 'TIER_250':
      return 250;
    case 'TIER_1K':
      return 1000;
    case 'TIER_10K':
      return 10000;
    case 'TIER_100K':
      return 100000;
    case 'TIER_UNLIMITED':
      return 1000000;
    default:
      return 250; // Nivel por defecto inicial de cuentas WhatsApp Cloud API
  }
}

/**
 * Sincroniza las plantillas oficiales y estados desde Meta (vía Zernio) hacia PostgreSQL
 */
export async function sincronizarPlantillasConZernio(opticaId) {
  const idOpticaNumerico = Number(opticaId) || 1;
  const cuentaWp = await obtenerCuentaWhatsAppZernio();

  if (!cuentaWp) {
    return { exito: false, mensaje: 'No hay cuenta de WhatsApp conectada en Zernio' };
  }

  const accountId = cuentaWp._id || cuentaWp.id;
  const cliente = new ClienteZernio();
  const resMeta = await cliente.solicitar(`/whatsapp/templates?accountId=${encodeURIComponent(accountId)}`);

  if (!resMeta.exito || !resMeta.datos?.templates) {
    return {
      exito: false,
      mensaje: resMeta.error?.mensaje || 'Error al obtener plantillas desde Zernio/Meta',
    };
  }

  const templatesMeta = resMeta.datos.templates;

  for (const t of templatesMeta) {
    const nombre = t.name;
    const estado = (t.status || 'PENDING').toUpperCase();
    const categoria = (t.category || 'MARKETING').toUpperCase();
    const idioma = t.language || 'es';
    const metaId = String(t.id);

    // Extraer componentes
    let encabezadoTipo = 'NINGUNO';
    let encabezadoContenido = null;
    let cuerpo = '';
    let pie = null;
    let botones = [];

    if (Array.isArray(t.components)) {
      for (const comp of t.components) {
        const compTipo = (comp.type || '').toUpperCase();
        if (compTipo === 'HEADER') {
          const formato = (comp.format || 'TEXT').toUpperCase();
          encabezadoTipo = formato === 'TEXT' ? 'TEXTO' : (formato === 'VIDEO' ? 'VIDEO' : 'IMAGEN');
          encabezadoContenido =
            comp.text ||
            (Array.isArray(comp.example?.header_handle) && comp.example.header_handle[0]) ||
            (Array.isArray(comp.example?.header_url) && comp.example.header_url[0]) ||
            comp.url ||
            null;
        } else if (compTipo === 'BODY') {
          cuerpo = comp.text || '';
        } else if (compTipo === 'FOOTER') {
          pie = comp.text || null;
        } else if (compTipo === 'BUTTONS' && Array.isArray(comp.buttons)) {
          botones = comp.buttons.map((b) => ({
            tipo: (b.type || 'QUICK_REPLY').toUpperCase(),
            texto: b.text || 'Opción',
            url: b.url || null,
            telefono: b.phone_number || null,
          }));
        }
      }
    }

    if (!cuerpo) continue;

    // Formatear etiqueta legible
    const etiqueta = nombre
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    // Buscar si ya existe por nombre
    const existente = await pool.query(
      `SELECT id, encabezado_contenido FROM "CRM_Opticas".plantillas 
       WHERE nombre = $1 AND (optica_id IS NULL OR optica_id = $2)
       ORDER BY id ASC LIMIT 1`,
      [nombre, idOpticaNumerico]
    );

    const encabezadoContenidoFinal =
      encabezadoContenido || (existente.rows.length > 0 ? existente.rows[0].encabezado_contenido : null);

    if (existente.rows.length > 0) {
      await pool.query(
        `UPDATE "CRM_Opticas".plantillas
         SET estado = $1,
             meta_template_id = $2,
             categoria = $3,
             cuerpo = $4,
             encabezado_tipo = $5,
             encabezado_contenido = $6,
             pie = $7,
             botones_json = $8::jsonb,
             actualizado_en = NOW()
         WHERE id = $9`,
        [
          estado,
          metaId,
          categoria,
          cuerpo,
          encabezadoTipo,
          encabezadoContenidoFinal,
          pie,
          JSON.stringify(botones),
          existente.rows[0].id,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO "CRM_Opticas".plantillas
          (optica_id, nombre, etiqueta, categoria, idioma, encabezado_tipo, encabezado_contenido, cuerpo, pie, botones_json, estado, es_sistema, meta_template_id, actualizado_en)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, FALSE, $12, NOW())`,
        [
          idOpticaNumerico,
          nombre,
          etiqueta,
          categoria,
          idioma,
          encabezadoTipo,
          encabezadoContenido,
          cuerpo,
          pie,
          JSON.stringify(botones),
          estado,
          metaId,
        ]
      );
    }
  }

  ultimaSincronizacionZernio = Date.now();
  return { exito: true, total_sincronizadas: templatesMeta.length };
}

/**
 * Obtener plantillas oficiales y personalizadas disponibles para la óptica
 */
export async function obtenerPlantillas(opticaId) {
  const idOpticaNumerico = Number(opticaId) || 1;

  // Sincronizar en segundo plano si pasaron más de 45 segundos
  const ahora = Date.now();
  if (ahora - ultimaSincronizacionZernio > 45000) {
    sincronizarPlantillasConZernio(idOpticaNumerico).catch((err) => {
      console.warn('Aviso: Sincronización automática de plantillas omitida:', err.message);
    });
  }

  const res = await pool.query(
    `SELECT id, optica_id, nombre, etiqueta, categoria, idioma, encabezado_tipo, 
            encabezado_contenido, cuerpo, pie, botones_json, estado, es_sistema, 
            meta_template_id, creado_en, actualizado_en
     FROM "CRM_Opticas".plantillas
     WHERE (optica_id = $1 OR optica_id IS NULL)
       AND es_sistema = FALSE
       AND meta_template_id IS NOT NULL
     ORDER BY id DESC`,
    [idOpticaNumerico]
  );

  return res.rows.map((p) => ({
    ...p,
    botones: typeof p.botones_json === 'string' ? JSON.parse(p.botones_json) : (p.botones_json || []),
  }));
}

/**
 * Crear una nueva plantilla oficial conectando con Zernio -> Meta
 */
export async function crearPlantilla(opticaId, datos) {
  const idOpticaNumerico = Number(opticaId) || 1;
  const {
    nombre,
    etiqueta,
    categoria = 'MARKETING',
    idioma = 'es_ES',
    encabezado_tipo = 'NINGUNO',
    encabezado_contenido = null,
    cuerpo,
    pie = null,
    botones = [],
  } = datos;

  if (!etiqueta || !cuerpo) {
    throw new Error('La plantilla debe tener un título descriptivo y un mensaje en el cuerpo.');
  }

  // Generar nombre técnico normalizado en minúsculas y guiones bajos (requisito estricto de Meta)
  const nombreNormalizado =
    nombre?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
    etiqueta
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

  let metaTemplateId = null;
  let estadoMeta = 'PENDING';

  // 1. Conectar con Zernio para registrar en Meta Cloud API
  const cuentaWp = await obtenerCuentaWhatsAppZernio();

  if (cuentaWp) {
    const accountId = cuentaWp._id || cuentaWp.id;
    const componentesZernio = [];

    // Header (Texto, Imagen o Documento)
    if (encabezado_tipo === 'TEXTO' && encabezado_contenido) {
      componentesZernio.push({
        type: 'header',
        format: 'text',
        text: encabezado_contenido.trim(),
      });
    } else if (encabezado_tipo === 'IMAGEN') {
      const URL_MUESTRA_IMAGEN = 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=800&auto=format&fit=crop&q=80';
      let urlEjemplo = URL_MUESTRA_IMAGEN;

      if (encabezado_contenido && typeof encabezado_contenido === 'string') {
        const contenidoLimpio = encabezado_contenido.trim();
        if (contenidoLimpio.startsWith('http://') || contenidoLimpio.startsWith('https://')) {
          urlEjemplo = contenidoLimpio;
        } else if (contenidoLimpio.startsWith('/') && process.env.URL_BASE_APLICACION) {
          urlEjemplo = `${process.env.URL_BASE_APLICACION.replace(/\/$/, '')}${contenidoLimpio}`;
        }
      }

      componentesZernio.push({
        type: 'header',
        format: 'image',
        example: {
          header_handle: [urlEjemplo],
        },
      });
    } else if (encabezado_tipo === 'VIDEO') {
      const URL_MUESTRA_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
      let urlEjemplo = URL_MUESTRA_VIDEO;

      if (encabezado_contenido && typeof encabezado_contenido === 'string') {
        const contenidoLimpio = encabezado_contenido.trim();
        if (contenidoLimpio.startsWith('http://') || contenidoLimpio.startsWith('https://')) {
          urlEjemplo = contenidoLimpio;
        } else if (contenidoLimpio.startsWith('/') && process.env.URL_BASE_APLICACION) {
          urlEjemplo = `${process.env.URL_BASE_APLICACION.replace(/\/$/, '')}${contenidoLimpio}`;
        }
      }

      componentesZernio.push({
        type: 'header',
        format: 'video',
        example: {
          header_handle: [urlEjemplo],
        },
      });
    }

    // Body
    componentesZernio.push({
      type: 'body',
      text: cuerpo.trim(),
    });

    // Footer
    if (pie && pie.trim()) {
      componentesZernio.push({
        type: 'footer',
        text: pie.trim(),
      });
    }

    // Buttons (Quick Reply, URL, Teléfono, Copiar Código, Catálogo, Flujo)
    if (Array.isArray(botones) && botones.length > 0) {
      componentesZernio.push({
        type: 'buttons',
        buttons: botones.map((b) => {
          const tipoBoton = (b.tipo || 'QUICK_REPLY').toUpperCase();
          if (tipoBoton === 'URL') {
            return {
              type: 'url',
              text: b.texto.trim(),
              url: b.url ? b.url.trim() : 'https://ejemplo.com',
            };
          }
          if (tipoBoton === 'PHONE_NUMBER' || tipoBoton === 'TELEFONO') {
            return {
              type: 'phone_number',
              text: b.texto.trim(),
              phone_number: b.telefono ? b.telefono.trim().replace(/\s+/g, '') : '+573000000000',
            };
          }
          if (tipoBoton === 'COPY_CODE') {
            return {
              type: 'copy_code',
              example: [b.codigo ? b.codigo.trim() : 'PROMO'],
            };
          }
          if (tipoBoton === 'CATALOG') {
            return {
              type: 'catalog',
              text: b.texto.trim() || 'Ver Catálogo',
            };
          }
          if (tipoBoton === 'FLOW') {
            return {
              type: 'flow',
              text: b.texto.trim(),
            };
          }
          if (tipoBoton === 'REQUEST_CONTACT_INFO') {
            return {
              type: 'request_contact_info',
            };
          }
          return {
            type: 'quick_reply',
            text: b.texto.trim(),
          };
        }),
      });
    }

    const cliente = new ClienteZernio();
    const resMeta = await cliente.solicitar('/whatsapp/templates', {
      metodo: 'POST',
      cuerpo: {
        accountId,
        name: nombreNormalizado,
        category: categoria.toUpperCase(),
        language: idioma || 'es',
        components: componentesZernio,
      },
    });

    if (!resMeta.exito) {
      throw new Error(`El canal oficial rechazó la plantilla: ${resMeta.error?.mensaje || 'Error en formato'}`);
    }

    metaTemplateId = resMeta.datos?.template?.id ? String(resMeta.datos.template.id) : null;
    estadoMeta = (resMeta.datos?.template?.status || 'PENDING').toUpperCase();
  }

  // 2. Guardar en Base de Datos Supabase
  const res = await pool.query(
    `INSERT INTO "CRM_Opticas".plantillas
      (optica_id, nombre, etiqueta, categoria, idioma, encabezado_tipo, encabezado_contenido, cuerpo, pie, botones_json, estado, es_sistema, meta_template_id)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, FALSE, $12)
     RETURNING *`,
    [
      idOpticaNumerico,
      nombreNormalizado,
      etiqueta.trim(),
      categoria,
      idioma,
      encabezado_tipo,
      encabezado_contenido,
      cuerpo.trim(),
      pie ? pie.trim() : null,
      JSON.stringify(botones),
      estadoMeta,
      metaTemplateId,
    ]
  );

  return {
    ...res.rows[0],
    botones,
  };
}

/**
 * Obtener la cuota diaria real consultada desde Zernio (Meta Messaging Limit Tier)
 */
export async function obtenerCuotaDiaria(opticaId) {
  const idOpticaNumerico = Number(opticaId) || 1;

  // 1. Obtener la cuenta conectada en Zernio
  const cuentaWp = await obtenerCuentaWhatsAppZernio();
  const tierMeta = cuentaWp?.metadata?.messagingLimitTier || 'TIER_250';
  const calidadMeta = cuentaWp?.metadata?.qualityRating || 'GREEN';
  const limiteDiario = calcularLimitePorTier(tierMeta);

  // 2. Consultar mensajes enviados en la ventana móvil de 24 horas
  const res = await pool.query(
    `SELECT COUNT(*)::int AS enviados_ultimas_24h
     FROM "CRM_Opticas".campanas_destinatarios
     WHERE optica_id = $1
       AND enviado_en >= (NOW() - INTERVAL '24 HOURS')`,
    [idOpticaNumerico]
  );

  const enviadosHoy = res.rows[0]?.enviados_ultimas_24h || 0;
  const disponiblesHoy = Math.max(0, limiteDiario - enviadosHoy);

  return {
    limite_diario: limiteDiario,
    tier_meta: tierMeta,
    calidad_meta: calidadMeta,
    telefono_cuenta: cuentaWp?.username || cuentaWp?.metadata?.displayPhoneNumber || null,
    enviados_hoy: enviadosHoy,
    disponibles_hoy: disponiblesHoy,
    porcentaje_consumido: Math.min(100, Math.round((enviadosHoy / limiteDiario) * 100)),
  };
}

/**
 * Calcula la audiencia de un lote antes de enviar
 */
export async function calcularAudienciaLote(opticaId, { plantillaId, segmentoId, telefonosDirectos = [], diasExclusion = 7, forzarReenvio = false }) {
  const idOpticaNumerico = Number(opticaId) || 1;
  const idPlantillaNumerico = Number(plantillaId);

  // 1. Obtener la plantilla
  let resPlantilla = await pool.query(
    `SELECT * FROM "CRM_Opticas".plantillas WHERE id = $1 AND (optica_id IS NULL OR optica_id = $2)`,
    [idPlantillaNumerico, idOpticaNumerico]
  );
  if (resPlantilla.rows.length === 0) {
    // Si el ID vino de otra óptica o sesión previa, buscar por mismo nombre o meta_template_id para la óptica activa
    const resPorNombre = await pool.query(
      `SELECT p2.* FROM "CRM_Opticas".plantillas p1
       JOIN "CRM_Opticas".plantillas p2 ON (p2.nombre = p1.nombre OR p2.meta_template_id = p1.meta_template_id)
       WHERE p1.id = $1 AND (p2.optica_id IS NULL OR p2.optica_id = $2)
       ORDER BY p2.id DESC LIMIT 1`,
      [idPlantillaNumerico, idOpticaNumerico]
    );
    if (resPorNombre.rows.length > 0) {
      resPlantilla = resPorNombre;
    } else {
      const resCualquiera = await pool.query(
        `SELECT * FROM "CRM_Opticas".plantillas WHERE id = $1`,
        [idPlantillaNumerico]
      );
      if (resCualquiera.rows.length > 0) {
        resPlantilla = resCualquiera;
      } else {
        throw new Error('Plantilla no encontrada');
      }
    }
  }
  const plantilla = resPlantilla.rows[0];

  // 2. Obtener lista inicial de candidatos
  let candidatos = [];

  if (segmentoId) {
    const resultadoSegmento = await obtenerPacientesDeSegmento(segmentoId, idOpticaNumerico);
    const pacientesSegmento = resultadoSegmento.pacientes || [];
    candidatos = pacientesSegmento
      .filter((p) => p.telefono && p.telefono.trim() !== '')
      .map((p) => ({
        contacto_id: Number(p.id),
        nombre: p.nombre_completo,
        telefono: normalizarTelefono(p.telefono),
      }));
  } else if (telefonosDirectos && telefonosDirectos.length > 0) {
    candidatos = telefonosDirectos
      .map((item) => {
        if (typeof item === 'string') {
          return { contacto_id: null, nombre: 'Paciente', telefono: normalizarTelefono(item) };
        }
        return {
          contacto_id: item.contacto_id ? Number(item.contacto_id) : null,
          nombre: item.nombre || 'Paciente',
          telefono: normalizarTelefono(item.telefono),
        };
      })
      .filter((c) => c.telefono && c.telefono.length >= 10);

    // Enriquecer candidatos con nombre y contacto_id si ya están registrados en contactos
    if (candidatos.length > 0) {
      const lista10Digitos = Array.from(
        new Set(
          candidatos
            .map((c) => c.telefono.replace(/[^0-9]/g, '').slice(-10))
            .filter((t) => t.length === 10)
        )
      );

      if (lista10Digitos.length > 0) {
        try {
          const resContactos = await pool.query(
            `SELECT id, nombre_completo, telefono
             FROM "CRM_Opticas".contactos
             WHERE optica_id = $1
               AND RIGHT(REGEXP_REPLACE(COALESCE(telefono, ''), '[^0-9]', '', 'g'), 10) = ANY($2::text[])`,
            [idOpticaNumerico, lista10Digitos]
          );

          if (resContactos.rows.length > 0) {
            const mapaContactos = new Map();
            for (const c of resContactos.rows) {
              const u10 = String(c.telefono || '').replace(/[^0-9]/g, '').slice(-10);
              if (u10 && !mapaContactos.has(u10)) {
                mapaContactos.set(u10, c);
              }
            }

            for (const cand of candidatos) {
              const u10Cand = cand.telefono.replace(/[^0-9]/g, '').slice(-10);
              const contactoBD = mapaContactos.get(u10Cand);
              if (contactoBD) {
                if (!cand.contacto_id) cand.contacto_id = Number(contactoBD.id);
                if ((!cand.nombre || cand.nombre === 'Paciente') && contactoBD.nombre_completo) {
                  cand.nombre = contactoBD.nombre_completo.trim();
                }
              }
            }
          }
        } catch (errEnriquecer) {
          console.warn('Error al enriquecer telefonos directos con contactos de BD:', errEnriquecer.message);
        }
      }
    }
  }

  // 3. Consultar quiénes ya recibieron esta plantilla en los últimos `diasExclusion`
  const resHistorial = await pool.query(
    `SELECT cd.contacto_id, cd.telefono, cd.enviado_en, c.nombre_campana AS campana_nombre
     FROM "CRM_Opticas".campanas_destinatarios cd
     LEFT JOIN "CRM_Opticas".campanas c ON c.id = cd.campana_id
     WHERE cd.optica_id = $1
       AND cd.plantilla_id = $2
       AND cd.enviado_en >= (NOW() - make_interval(days => $3))
     ORDER BY cd.enviado_en DESC`,
    [idOpticaNumerico, idPlantillaNumerico, Number(diasExclusion) || 7]
  );

  const mapaHistorial = new Map();
  for (const row of resHistorial.rows) {
    const telNorm = normalizarTelefono(row.telefono);
    const datosEnvio = {
      enviado_en: row.enviado_en,
      campana_nombre: row.campana_nombre || 'Campaña previa',
    };
    if (row.contacto_id && !mapaHistorial.has(`id_${row.contacto_id}`)) {
      mapaHistorial.set(`id_${row.contacto_id}`, datosEnvio);
    }
    if (telNorm && !mapaHistorial.has(`tel_${telNorm}`)) {
      mapaHistorial.set(`tel_${telNorm}`, datosEnvio);
    }
  }

  // 4. Separar audiencia
  const yaContactados = [];
  const pendientesElegibles = [];

  for (const c of candidatos) {
    const envioPrevio =
      (c.contacto_id && mapaHistorial.get(`id_${c.contacto_id}`)) ||
      (c.telefono && mapaHistorial.get(`tel_${c.telefono}`));

    if (envioPrevio) {
      const fechaEnvio = new Date(envioPrevio.enviado_en);
      const diasHace = Math.max(0, Math.floor((Date.now() - fechaEnvio.getTime()) / (24 * 60 * 60 * 1000)));
      const fechaStr = fechaEnvio.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' });
      const horaStr = fechaEnvio.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true });

      const excluidoItem = {
        ...c,
        fecha_previo: envioPrevio.enviado_en,
        fecha_texto: `${fechaStr} a las ${horaStr}`,
        dias_hace: diasHace,
        motivo: diasHace === 0
          ? 'Recibió esta plantilla hoy'
          : diasHace === 1
          ? 'Recibió esta plantilla ayer'
          : `Recibió esta plantilla hace ${diasHace} días`,
      };
      yaContactados.push(excluidoItem);

      if (forzarReenvio) {
        pendientesElegibles.push(c);
      }
    } else {
      pendientesElegibles.push(c);
    }
  }

  // 5. Calcular número de lote correlativo para esta plantilla y segmento
  const resLotesPrevios = await pool.query(
    `SELECT COUNT(*)::int AS total_lotes
     FROM "CRM_Opticas".campanas
     WHERE optica_id = $1 AND plantilla_id = $2`,
    [idOpticaNumerico, idPlantillaNumerico]
  );
  const loteNumero = (resLotesPrevios.rows[0]?.total_lotes || 0) + 1;

  // 6. Consultar cuota disponible
  const cuota = await obtenerCuotaDiaria(idOpticaNumerico);
  const limiteLoteHoy = Math.min(cuota.limite_diario, cuota.disponibles_hoy);
  const cantidadAEnviarHoy = Math.min(pendientesElegibles.length, limiteLoteHoy);

  return {
    exito: true,
    plantilla: {
      id: plantilla.id,
      nombre: plantilla.nombre,
      etiqueta: plantilla.etiqueta,
      categoria: plantilla.categoria,
      estado: plantilla.estado,
      idioma: plantilla.idioma,
      encabezado_tipo: plantilla.encabezado_tipo,
      encabezado_contenido: plantilla.encabezado_contenido,
    },
    lote_numero: loteNumero,
    dias_exclusion_aplicados: Number(diasExclusion) || 7,
    forzar_reenvio_activo: Boolean(forzarReenvio),
    total_audiencia_inicial: candidatos.length,
    ya_contactados_recientes: yaContactados.length,
    excluidos_detalle: yaContactados,
    pendientes_elegibles: pendientesElegibles.length,
    limite_diario_disponible: cuota.disponibles_hoy,
    limite_diario_total: cuota.limite_diario,
    tier_meta: cuota.tier_meta,
    cantidad_a_enviar_hoy: cantidadAEnviarHoy,
    destinatarios_lote_hoy: pendientesElegibles.slice(0, cantidadAEnviarHoy),
    muestra_destinatarios: pendientesElegibles.slice(0, 10),
  };
}

/**
 * Ejecuta el lanzamiento de un lote de mensajes masivos con plantilla conectando directamente con Zernio
 */
export async function lanzarLoteCampana(opticaId, datos) {
  const idOpticaNumerico = Number(opticaId) || 1;
  const {
    plantillaId,
    segmentoId = null,
    telefonosDirectos = [],
    nombreCampana,
    diasExclusion = 7,
    forzarReenvio = false,
    tamanoLoteDeseado = null,
  } = datos;

  // 1. Calcular audiencia elegible
  const calculo = await calcularAudienciaLote(idOpticaNumerico, {
    plantillaId,
    segmentoId,
    telefonosDirectos,
    diasExclusion,
    forzarReenvio,
  });

  if (calculo.pendientes_elegibles === 0) {
    throw new Error('Todos los destinatarios de esta audiencia ya recibieron esta plantilla recientemente.');
  }

  if (calculo.limite_diario_disponible <= 0) {
    throw new Error(`Has alcanzado el límite diario de ${calculo.limite_diario_total} envíos según tu nivel de Meta (${calculo.tier_meta}). Podrás enviar el siguiente lote en 24 horas.`);
  }

  const cantidadFinal = Math.min(
    calculo.pendientes_elegibles,
    calculo.limite_diario_disponible,
    tamanoLoteDeseado ? Number(tamanoLoteDeseado) : calculo.limite_diario_total
  );

  const destinatarios = calculo.destinatarios_lote_hoy.slice(0, cantidadFinal);

  // 2. Obtener cuenta oficial conectada de WhatsApp en Zernio (forzar actualización)
  cacheCuentaWp = null;
  cacheTimestampCuenta = 0;
  const cuentaWp = await obtenerCuentaWhatsAppZernio();
  if (!cuentaWp) {
    throw new Error('No hay una cuenta activa de WhatsApp conectada en Zernio para realizar envíos.');
  }

  const accountId = cuentaWp._id || cuentaWp.id;
  const profileId = cuentaWp.profileId?._id || cuentaWp.profileId || process.env.ZERNIO_PROFILE_ID || '6ab69ff9350727f662688794';

  const nombreFinal =
    nombreCampana?.trim() ||
    `Lote #${calculo.lote_numero} - ${calculo.plantilla.etiqueta} (${new Date().toLocaleDateString('es-CO')})`;

  // 3. Preparar componentes para Meta (encabezado multimedia si aplica)
  const componentesBroadcast = [];
  if (calculo.plantilla.encabezado_tipo === 'IMAGEN' && calculo.plantilla.encabezado_contenido) {
    componentesBroadcast.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: { link: calculo.plantilla.encabezado_contenido },
        },
      ],
    });
  } else if (calculo.plantilla.encabezado_tipo === 'VIDEO' && calculo.plantilla.encabezado_contenido) {
    componentesBroadcast.push({
      type: 'header',
      parameters: [
        {
          type: 'video',
          video: { link: calculo.plantilla.encabezado_contenido },
        },
      ],
    });
  }

  const cliente = new ClienteZernio();

  // 4. Paso A: Crear el borrador de campaña broadcast en Zernio
  const resCrear = await cliente.solicitar('/broadcasts', {
    metodo: 'POST',
    cuerpo: {
      profileId,
      accountId,
      platform: 'whatsapp',
      name: nombreFinal,
      template: {
        name: calculo.plantilla.nombre,
        language: calculo.plantilla.idioma || 'es',
        ...(componentesBroadcast.length > 0 ? { components: componentesBroadcast } : {}),
      },
    },
  });

  if (!resCrear.exito) {
    throw new Error(`Zernio rechazó la campaña masiva: ${resCrear.error?.mensaje || 'Error en plantilla de WhatsApp'}`);
  }

  const broadcastId = resCrear.datos?.broadcast?.id || resCrear.datos?.id;

  // 5. Paso B: Asociar destinatarios al broadcast
  const telefonosDestino = destinatarios.map((d) => d.telefono);
  const resRecipients = await cliente.solicitar(`/broadcasts/${broadcastId}/recipients`, {
    metodo: 'POST',
    cuerpo: {
      phones: telefonosDestino,
    },
  });

  if (!resRecipients.exito) {
    await cliente.solicitar(`/broadcasts/${broadcastId}`, { metodo: 'DELETE' }).catch(() => {});
    throw new Error(`Error al registrar destinatarios en Zernio: ${resRecipients.error?.mensaje || 'Formato de teléfono no válido'}`);
  }

  // 6. Paso C: Disparar el envío real a WhatsApp Meta
  const resDisparo = await cliente.solicitar(`/broadcasts/${broadcastId}/send`, {
    metodo: 'POST',
  });

  if (!resDisparo.exito) {
    throw new Error(`Error al emitir el envío masivo en Meta/WhatsApp: ${resDisparo.error?.mensaje || 'Error en el proveedor'}`);
  }

  // 7. Esperar y sondear Zernio para capturar la auditoría real de entrega de Meta
  let datosBc = {};
  let totalEnviadosReal = 0;
  let totalFallidosReal = 0;
  let listaRecipients = [];

  for (let intento = 0; intento < 3; intento++) {
    await new Promise((r) => setTimeout(r, 1500));
    const resAuditoriaBc = await cliente.solicitar(`/broadcasts/${broadcastId}`);
    datosBc = resAuditoriaBc.datos?.broadcast || {};

    const resRecipientsAuditoria = await cliente.solicitar(`/broadcasts/${broadcastId}/recipients`);
    listaRecipients = resRecipientsAuditoria.datos?.recipients || [];

    const exitosos = listaRecipients.filter((r) => ['sent', 'delivered', 'read'].includes(r.status)).length;
    const fallidos = listaRecipients.filter((r) => r.status === 'failed').length;

    totalEnviadosReal = exitosos > 0 ? exitosos : (Number(datosBc.sentCount || 0) + Number(datosBc.deliveredCount || 0) + Number(datosBc.readCount || 0));
    totalFallidosReal = fallidos > 0 ? fallidos : Number(datosBc.failedCount || 0);

    const hayFallos = fallidos > 0 || totalFallidosReal > 0;
    const todosProcesados = (totalEnviadosReal + totalFallidosReal) >= destinatarios.length;

    if (hayFallos || todosProcesados) {
      break;
    }
  }

  const mapaErroresPorTel = new Map();
  for (const r of listaRecipients) {
    const tel = normalizarTelefono(r.platformIdentifier || r.contactName);
    if (tel) {
      mapaErroresPorTel.set(tel, {
        status: r.status,
        error: r.error,
        errorCode: r.errorCode,
        messageId: r.messageId,
      });
    }
  }

  const hayAlgunFallo = listaRecipients.some((r) => r.status === 'failed') || totalFallidosReal > 0;
  let estadoFinalCampana = 'completado';
  let errorGlobal = null;

  if (hayAlgunFallo && totalEnviadosReal === 0) {
    estadoFinalCampana = 'fallido';
    const primerFallo = listaRecipients.find((r) => r.status === 'failed');
    if (primerFallo) {
      if (primerFallo.errorCode === 131042) {
        errorGlobal = 'Meta rechazó el envío (Error 131042): Problema de método de pago en WhatsApp Business. Debes asociar una tarjeta en Meta Business Suite -> Cuentas de WhatsApp -> Pagos.';
      } else {
        errorGlobal = `Meta rechazó el envío: ${primerFallo.error} (código ${primerFallo.errorCode})`;
      }
    } else {
      errorGlobal = 'Meta rechazó la entrega de los mensajes del lote.';
    }
  } else if (totalFallidosReal > 0 && totalEnviadosReal > 0) {
    estadoFinalCampana = 'parcial';
    errorGlobal = `Se enviaron ${totalEnviadosReal} mensajes pero ${totalFallidosReal} fueron rechazados por Meta.`;
  }

  // 8. Paso D: Registrar campaña en base de datos con auditoría real y broadcast_id
  const resCampana = await pool.query(
    `INSERT INTO "CRM_Opticas".campanas
      (optica_id, plantilla_id, nombre_campana, segmento_id, origen_tipo, total_destinatarios, total_enviados, total_fallidos, estado, error_mensaje, broadcast_id)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      idOpticaNumerico,
      Number(calculo.plantilla.id),
      nombreFinal,
      segmentoId ? Number(segmentoId) : null,
      segmentoId ? 'segmento' : 'csv',
      destinatarios.length,
      totalEnviadosReal,
      totalFallidosReal,
      estadoFinalCampana,
      errorGlobal,
      broadcastId,
    ]
  );

  const campana = resCampana.rows[0];

  // 9. Paso E: Registrar trazabilidad de envíos individuales
  for (let i = 0; i < destinatarios.length; i++) {
    const dest = destinatarios[i];
    const infoTel = mapaErroresPorTel.get(dest.telefono);
    const estadoEntrega = infoTel?.status === 'failed' ? 'fallido' : (infoTel?.status === 'sent' ? 'enviado' : (estadoFinalCampana === 'fallido' ? 'fallido' : 'enviado'));
    const idMensaje = infoTel?.messageId || `zernio_bc_${broadcastId}_${i + 1}`;
    const errorDestinatario = infoTel?.error ? `${infoTel.error} (${infoTel.errorCode})` : errorGlobal;

    await pool.query(
      `INSERT INTO "CRM_Opticas".campanas_destinatarios
        (campana_id, optica_id, plantilla_id, contacto_id, telefono, nombre_destinatario, estado_entrega, id_mensaje_plataforma, error_mensaje)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        campana.id,
        idOpticaNumerico,
        Number(calculo.plantilla.id),
        dest.contacto_id || null,
        dest.telefono,
        dest.nombre || 'Paciente',
        estadoEntrega,
        idMensaje,
        errorDestinatario,
      ]
    );
  }

  if (estadoFinalCampana === 'fallido') {
    throw new Error(errorGlobal || 'Meta rechazó la entrega de los mensajes del lote.');
  }

  return {
    exito: true,
    campana_id: campana.id,
    lote_numero: calculo.lote_numero,
    nombre_campana: campana.nombre_campana,
    total_enviados: totalEnviadosReal,
    total_fallidos: totalFallidosReal,
    broadcast_id: broadcastId,
    estado: estadoFinalCampana,
    restantes_para_proximos_dias: Math.max(0, calculo.pendientes_elegibles - totalEnviadosReal),
  };
}

/**
 * Elimina un lote y su trazabilidad asociada
 */
export async function eliminarLoteCampana(opticaId, campanaId) {
  const idOpticaNumerico = Number(opticaId) || 1;
  const res = await pool.query(
    `DELETE FROM "CRM_Opticas".campanas
     WHERE id = $1 AND optica_id = $2
     RETURNING id`,
    [Number(campanaId), idOpticaNumerico]
  );
  return { exito: res.rowCount > 0 };
}

/**
 * Obtener historial de campañas y lotes lanzados por la óptica, sincronizando automáticamente con Zernio
 */
export async function obtenerHistorialLotes(opticaId) {
  const idOpticaNumerico = Number(opticaId) || 1;

  const res = await pool.query(
    `SELECT ce.id, ce.optica_id, ce.plantilla_id, ce.nombre_campana, ce.segmento_id,
            ce.origen_tipo, ce.total_destinatarios, ce.total_enviados, ce.total_fallidos,
            ce.estado, ce.error_mensaje, ce.broadcast_id, ce.creado_en,
            p.etiqueta AS plantilla_etiqueta, p.categoria AS plantilla_categoria,
            s.nombre AS segmento_nombre
     FROM "CRM_Opticas".campanas ce
     JOIN "CRM_Opticas".plantillas p ON p.id = ce.plantilla_id
     LEFT JOIN "CRM_Opticas".segmentos s ON s.id = ce.segmento_id
     WHERE ce.optica_id = $1
     ORDER BY ce.id DESC
     LIMIT 50`,
    [idOpticaNumerico]
  );

  const campanas = res.rows;

  // Sincronizar en tiempo real los lotes más recientes con Zernio si tienen broadcast_id
  try {
    const cliente = new ClienteZernio();
    for (const c of campanas.slice(0, 5)) {
      if (c.broadcast_id && c.estado !== 'fallido') {
        const resBc = await cliente.solicitar(`/broadcasts/${c.broadcast_id}`, { sin_reintentos: true });
        const bc = resBc.datos?.broadcast;
        if (bc && Number(bc.failedCount) > 0) {
          const nuevosFallidos = Number(bc.failedCount || 0);
          const nuevosEnviados = Number(bc.sentCount || 0) + Number(bc.deliveredCount || 0) + Number(bc.readCount || 0);
          const nuevoEstado = (nuevosFallidos > 0 && nuevosEnviados === 0) ? 'fallido' : (nuevosFallidos > 0 ? 'parcial' : 'completado');

          let errorMsg = c.error_mensaje;
          if (!errorMsg) {
            const resRec = await cliente.solicitar(`/broadcasts/${c.broadcast_id}/recipients`, { sin_reintentos: true });
            const primerFallo = (resRec.datos?.recipients || []).find((r) => r.status === 'failed');
            if (primerFallo) {
              if (primerFallo.errorCode === 131042) {
                errorMsg = 'Meta rechazó el envío (Error 131042): Problema de método de pago en WhatsApp Business. Debes asociar una tarjeta en Meta Business Suite -> Cuentas de WhatsApp -> Pagos.';
              } else {
                errorMsg = `Meta rechazó el envío: ${primerFallo.error} (código ${primerFallo.errorCode})`;
              }
            }
          }

          await pool.query(
            `UPDATE "CRM_Opticas".campanas
             SET total_enviados = $1, total_fallidos = $2, estado = $3, error_mensaje = $4
             WHERE id = $5`,
            [nuevosEnviados, nuevosFallidos, nuevoEstado, errorMsg, c.id]
          );

          c.total_enviados = nuevosEnviados;
          c.total_fallidos = nuevosFallidos;
          c.estado = nuevoEstado;
          c.error_mensaje = errorMsg;
        }
      }
    }
  } catch (err) {
    console.warn('Advertencia al sincronizar historial con Zernio:', err.message);
  }

  return campanas;
}

/**
 * Normaliza teléfonos a formato internacional E.164 (+57 por defecto en Colombia)
 */
function normalizarTelefono(tel) {
  if (!tel) return '';
  const soloDigitos = String(tel).replace(/[^0-9]/g, '');
  if (soloDigitos.length === 10 && soloDigitos.startsWith('3')) {
    return `+57${soloDigitos}`;
  }
  if (soloDigitos.startsWith('57') && soloDigitos.length === 12) {
    return `+${soloDigitos}`;
  }
  if (String(tel).startsWith('+')) {
    return `+${soloDigitos}`;
  }
  return soloDigitos ? `+${soloDigitos}` : '';
}

/**
 * Retorna un mapa indexado por nombre de plantilla en minúsculas
 * con su encabezado, cuerpo, pie y botones para enriquecer mensajes de chat.
 */
export async function obtenerMapaPlantillasPorNombre(opticaId = 1) {
  try {
    const { rows } = await pool.query(
      `SELECT id, optica_id, nombre, etiqueta, categoria, idioma, encabezado_tipo, 
              encabezado_contenido, cuerpo, pie, botones_json, estado
       FROM "CRM_Opticas".plantillas
       WHERE (optica_id = $1 OR optica_id IS NULL)
       ORDER BY id DESC`,
      [Number(opticaId) || 1]
    );

    const mapa = new Map();
    for (const p of rows) {
      const clave = (p.nombre || '').trim().toLowerCase();
      if (clave && !mapa.has(clave)) {
        let botones = [];
        try {
          botones = typeof p.botones_json === 'string' ? JSON.parse(p.botones_json || '[]') : (p.botones_json || []);
        } catch {
          botones = [];
        }

        mapa.set(clave, {
          id: p.id,
          nombre: p.nombre,
          etiqueta: p.etiqueta,
          categoria: p.categoria,
          idioma: p.idioma,
          encabezado_tipo: p.encabezado_tipo || 'NINGUNO',
          encabezado_contenido: p.encabezado_contenido,
          cuerpo: p.cuerpo,
          pie: p.pie,
          botones,
        });
      }
    }
    return mapa;
  } catch (err) {
    console.warn('Aviso: no se pudo obtener mapa de plantillas:', err.message);
    return new Map();
  }
}

