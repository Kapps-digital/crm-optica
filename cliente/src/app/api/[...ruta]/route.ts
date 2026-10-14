import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs';
import { base_datos as bdModulo } from '@/backend/base_datos/conexion.mjs';
import { ClienteZernio } from '@/backend/servicios/cliente_zernio.mjs';
import { enviar_mensaje, esta_en_ventana_24_horas } from '@/backend/servicios/gestor_mensajeria.mjs';
import { sincronizar_conversaciones_zernio, sincronizar_mensajes_conversacion } from '@/backend/servicios/sincronizador_zernio.mjs';
import {
  obtenerSegmentosConConteo,
  obtenerPacientesDeSegmento,
  crearSegmentoPersonalizado,
  actualizarSegmentoPersonalizado,
  eliminarSegmentoPersonalizado,
} from '@/backend/servicios/gestor_segmentacion.mjs';
import {
  obtenerPlantillas,
  crearPlantilla,
  sincronizarPlantillasConZernio,
  obtenerCuotaDiaria,
  calcularAudienciaLote,
  lanzarLoteCampana,
  obtenerHistorialLotes,
  eliminarLoteCampana,
  obtenerMapaPlantillasPorNombre,
} from '@/backend/servicios/gestor_plantillas.mjs';
import {
  obtener_canales_optica,
  obtener_url_conexion_whatsapp,
  vincular_cuenta_whatsapp_activa,
  desconectar_canal_whatsapp,
  reconectar_canal_whatsapp,
  actualizar_datos_optica,
  subir_logo_storage_optica,
} from '@/backend/servicios/gestor_canales.mjs';

const base_datos = bdModulo as any;
const subirLogoStorage: any = subir_logo_storage_optica;

const SECRETO_JWT = process.env.JWT_SECRET || 'crm_optica_secreto_super_seguro_2026';

function extraerSesion(request: NextRequest): { usuario: any; optica_id: number } {
  const authHeader = request.headers.get('authorization');
  const opticaSolicitada = request.headers.get('x-optica-id') || request.nextUrl.searchParams.get('optica_id');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const usuario: any = jwt.verify(token, SECRETO_JWT);
      let optica_id = Number(usuario.optica_id) || 1;
      if (usuario.rol === 'admin' && opticaSolicitada) {
        optica_id = Number(opticaSolicitada);
      }
      return { usuario, optica_id };
    } catch {
      return { usuario: null, optica_id: 1 };
    }
  }

  return { usuario: null, optica_id: 1 };
}

async function procesarPeticion(
  metodo: string,
  request: NextRequest,
  segmentosRuta: string[]
): Promise<NextResponse> {
  const rutaStr = segmentosRuta.join('/');
  const { usuario, optica_id } = extraerSesion(request);
  const searchParams = request.nextUrl.searchParams;

  let body: any = {};
  if (metodo === 'POST' || metodo === 'PUT' || metodo === 'PATCH') {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  try {
    // 1. ESTADO DEL SISTEMA
    if (metodo === 'GET' && rutaStr === 'estado') {
      const total_contactos = (await base_datos.prepare('SELECT COUNT(*) AS total FROM contactos WHERE optica_id = ?').get(optica_id))?.total || 0;
      const total_conversaciones = (await base_datos.prepare('SELECT COUNT(*) AS total FROM conversaciones WHERE optica_id = ?').get(optica_id))?.total || 0;
      const total_mensajes = (await base_datos.prepare('SELECT COUNT(*) AS total FROM mensajes').get())?.total || 0;
      const eventos_recibidos = (await base_datos.prepare("SELECT COUNT(*) AS total FROM eventos_webhook WHERE estado = 'recibido'").get())?.total || 0;

      return NextResponse.json({
        sistema: 'CRM Óptica Serverless Vercel',
        estado: 'en_linea',
        motor_bd: 'Supabase PostgreSQL (CRM_Opticas)',
        optica_id,
        metricas: {
          total_contactos: Number(total_contactos),
          total_conversaciones: Number(total_conversaciones),
          total_mensajes: Number(total_mensajes),
          eventos_pendientes_sweeper: Number(eventos_recibidos),
        },
      });
    }

    // 2. AUTENTICACIÓN
    if (metodo === 'POST' && rutaStr === 'auth/login') {
      const { usuario: uNombre, contrasena } = body;
      if (!uNombre || !contrasena) {
        return NextResponse.json({ exito: false, error: 'Debe ingresar usuario y contraseña' }, { status: 400 });
      }
      const usuarioLimpio = String(uNombre).trim().toLowerCase();
      const usuarioDb = await base_datos.prepare(`
        SELECT 
          u.id, u.optica_id, u.nombre, u.usuario, u.hash_contrasena, u.rol, u.activo,
          o.nombre AS optica_nombre, o.slug AS optica_slug, o.logo_url AS optica_logo,
          o.color_primario, o.color_secundario, o.telefono AS optica_telefono
        FROM usuarios u
        JOIN opticas o ON u.optica_id = o.id
        WHERE LOWER(u.usuario) = ? AND u.activo = true AND o.activo = true
      `).get(usuarioLimpio);

      if (!usuarioDb) {
        return NextResponse.json({ exito: false, error: 'Usuario o contraseña incorrectos' }, { status: 401 });
      }

      const coincide = bcrypt.compareSync(contrasena, usuarioDb.hash_contrasena);
      if (!coincide) {
        return NextResponse.json({ exito: false, error: 'Usuario o contraseña incorrectos' }, { status: 401 });
      }

      const token = jwt.sign(
        {
          id: Number(usuarioDb.id),
          usuario: usuarioDb.usuario,
          nombre: usuarioDb.nombre,
          rol: usuarioDb.rol,
          optica_id: Number(usuarioDb.optica_id),
        },
        SECRETO_JWT,
        { expiresIn: '7d' }
      );

      base_datos.prepare("UPDATE usuarios SET ultimo_acceso = datetime('now') WHERE id = ?").run(usuarioDb.id).catch(() => {});

      return NextResponse.json({
        exito: true,
        token,
        usuario: {
          id: Number(usuarioDb.id),
          usuario: usuarioDb.usuario,
          nombre: usuarioDb.nombre,
          rol: usuarioDb.rol,
          optica_id: Number(usuarioDb.optica_id),
        },
        optica: {
          id: Number(usuarioDb.optica_id),
          nombre: usuarioDb.optica_nombre,
          slug: usuarioDb.optica_slug,
          logo_url: usuarioDb.optica_logo,
          color_primario: usuarioDb.color_primario || '#0284c7',
          color_secundario: usuarioDb.color_secundario || '#0369a1',
          telefono: usuarioDb.optica_telefono,
        },
      });
    }

    if (metodo === 'GET' && rutaStr === 'auth/perfil') {
      if (!usuario) {
        return NextResponse.json({ exito: false, error: 'Sesión no iniciada' }, { status: 401 });
      }
      const usuarioDb = await base_datos.prepare(`
        SELECT id, optica_id, nombre, usuario, rol FROM usuarios WHERE id = ? AND activo = true
      `).get(usuario.id);

      if (!usuarioDb) {
        return NextResponse.json({ exito: false, error: 'Usuario no encontrado' }, { status: 404 });
      }

      const opticaDb = await base_datos.prepare(`
        SELECT 
          id, nombre, slug, logo_url, color_primario, color_secundario, telefono,
          duracion_cita_minutos, control_meses_defecto, especialista_defecto,
          registro_profesional_defecto, motivo_cita_defecto, notificacion_auto_citas_whatsapp,
          hora_inicio_atencion, hora_fin_atencion
        FROM opticas WHERE id = ? AND activo = true
      `).get(optica_id);

      return NextResponse.json({
        exito: true,
        usuario: {
          id: Number(usuarioDb.id),
          usuario: usuarioDb.usuario,
          nombre: usuarioDb.nombre,
          rol: usuarioDb.rol,
          optica_id: Number(usuarioDb.optica_id),
        },
        optica: opticaDb ? {
          id: Number(opticaDb.id),
          nombre: opticaDb.nombre,
          slug: opticaDb.slug,
          logo_url: opticaDb.logo_url,
          color_primario: opticaDb.color_primario || '#0284c7',
          color_secundario: opticaDb.color_secundario || '#0369a1',
          telefono: opticaDb.telefono,
          duracion_cita_minutos: Number(opticaDb.duracion_cita_minutos) || 30,
          control_meses_defecto: Number(opticaDb.control_meses_defecto) || 12,
          especialista_defecto: opticaDb.especialista_defecto || '',
          registro_profesional_defecto: opticaDb.registro_profesional_defecto || '',
          motivo_cita_defecto: opticaDb.motivo_cita_defecto || '',
          notificacion_auto_citas_whatsapp: opticaDb.notificacion_auto_citas_whatsapp !== false,
          hora_inicio_atencion: opticaDb.hora_inicio_atencion || '08:00',
          hora_fin_atencion: opticaDb.hora_fin_atencion || '18:00',
        } : null,
      });
    }

    if (metodo === 'GET' && rutaStr === 'opticas') {
      const opticas = await base_datos.prepare(`
        SELECT id, nombre, slug, logo_url, color_primario, color_secundario, telefono, activo 
        FROM opticas WHERE activo = true ORDER BY id ASC
      `).all();
      return NextResponse.json({ exito: true, opticas: opticas.map((o: any) => ({ ...o, id: Number(o.id) })) });
    }

    // 3. CONVERSACIONES Y MENSAJES
    if (metodo === 'GET' && rutaStr === 'conversaciones') {
      const conversaciones = await base_datos.prepare(`
        SELECT 
          c.id, c.contacto_id, c.canal, c.id_cuenta_zernio, c.id_conversacion_zernio,
          c.ultimo_mensaje_entrante_en, c.ultimo_leido_en, c.estado,
          COALESCE(c.mensajes_no_leidos, 0) AS mensajes_no_leidos,
          co.nombre_completo AS contacto_nombre, co.telefono AS contacto_telefono,
          co.business_scoped_user_id AS contacto_bsuid,
          (SELECT texto FROM mensajes WHERE conversacion_id = c.id ORDER BY creado_en DESC, id DESC LIMIT 1) AS ultimo_mensaje_texto,
          (SELECT creado_en FROM mensajes WHERE conversacion_id = c.id ORDER BY creado_en DESC, id DESC LIMIT 1) AS ultimo_mensaje_fecha,
          (SELECT direccion FROM mensajes WHERE conversacion_id = c.id ORDER BY creado_en DESC, id DESC LIMIT 1) AS ultimo_mensaje_direccion,
          (
            SELECT COUNT(*)::int 
            FROM mensajes m 
            WHERE m.conversacion_id = c.id 
              AND m.direccion = 'entrante' 
              AND (c.ultimo_leido_en IS NULL OR m.creado_en > c.ultimo_leido_en)
          ) AS mensajes_entrantes_sin_leer
        FROM conversaciones c
        JOIN contactos co ON c.contacto_id = co.id
        WHERE c.optica_id = ?
        ORDER BY COALESCE(
          (SELECT MAX(creado_en) FROM mensajes WHERE conversacion_id = c.id),
          c.ultimo_mensaje_entrante_en,
          c.actualizado_en,
          c.creado_en
        ) DESC
      `).all(optica_id);

      const mapaPlantillas = await obtenerMapaPlantillasPorNombre(optica_id);

      const enriquecidas = conversaciones.map((conv: any) => {
        const entrantesSinLeer = Number(conv.mensajes_entrantes_sin_leer || 0);
        const enTablaNoLeidos = Number(conv.mensajes_no_leidos || 0);

        let cantidad_no_leidos = 0;
        if (conv.ultimo_mensaje_direccion !== 'saliente') {
          cantidad_no_leidos = Math.max(entrantesSinLeer, enTablaNoLeidos);
          const fechaMsg = conv.ultimo_mensaje_fecha ? new Date(conv.ultimo_mensaje_fecha).getTime() : 0;
          const fechaLeido = conv.ultimo_leido_en ? new Date(conv.ultimo_leido_en).getTime() : 0;
          if (conv.ultimo_mensaje_direccion === 'entrante' && (!fechaLeido || fechaMsg > fechaLeido) && cantidad_no_leidos === 0) {
            cantidad_no_leidos = 1;
          }
        }

        let ultimoTexto = conv.ultimo_mensaje_texto || '';
        const matchTemplate = ultimoTexto.match(/\[Template:\s*([a-zA-Z0-9_-]+)\]/i);
        if (matchTemplate) {
          const nombrePlantilla = matchTemplate[1].toLowerCase();
          const pInfo = mapaPlantillas.get(nombrePlantilla);
          if (pInfo) {
            const prefijo = pInfo.encabezado_tipo === 'IMAGEN' ? '📷 ' : (pInfo.encabezado_tipo === 'VIDEO' ? '📹 ' : '');
            ultimoTexto = `${prefijo}${pInfo.cuerpo || pInfo.etiqueta || pInfo.nombre}`;
          } else {
            ultimoTexto = `Plantilla: ${matchTemplate[1]}`;
          }
        }

        return {
          ...conv,
          ultimo_mensaje_texto: ultimoTexto,
          mensajes_no_leidos: cantidad_no_leidos,
          no_leido: cantidad_no_leidos > 0,
          ventana_24h_activa: esta_en_ventana_24_horas(conv.ultimo_mensaje_entrante_en),
          sin_contestar: conv.ultimo_mensaje_direccion === 'entrante',
        };
      });

      return NextResponse.json({ exito: true, conversaciones: enriquecidas });
    }

    if (rutaStr === 'conversaciones/sincronizar') {
      const resultado = await sincronizar_conversaciones_zernio({ sincronizar_mensajes_profundo: true, max_conversaciones_mensajes: 15 });
      return NextResponse.json(resultado);
    }

    // Mensajes de conversación: conversaciones/:id/mensajes
    if (metodo === 'GET' && segmentosRuta[0] === 'conversaciones' && segmentosRuta[2] === 'mensajes') {
      const conversacion_id = segmentosRuta[1];
      const mensajes = await base_datos.prepare(`
        SELECT * FROM mensajes 
        WHERE conversacion_id = ? 
        AND (texto != '[Unsupported message]' OR url_adjunto IS NOT NULL)
        ORDER BY creado_en ASC, id ASC
      `).all(conversacion_id);

      const mapaPlantillas = await obtenerMapaPlantillasPorNombre(optica_id);
      const mensajesEnriquecidos = mensajes.map((m: any) => {
        let plantillaInfo = null;
        const match = (m.texto || '').match(/\[Template:\s*([a-zA-Z0-9_-]+)\]/i);
        if (match) {
          const p = mapaPlantillas.get(match[1].toLowerCase());
          if (p) plantillaInfo = p;
        }

        let tipoContenido = m.tipo_contenido;
        if (m.texto === '[reaction]' || (m.texto && /^\[reaction(?::\s*[^\]]+)?\]$/i.test(m.texto.trim()))) {
          tipoContenido = 'reaction';
        }

        let reaccionesNormalizadas: any[] = [];
        if (Array.isArray(m.reacciones)) {
          reaccionesNormalizadas = m.reacciones.map((r: any) => ({
            emoji: r.emoji,
            direccion: r.de_mi ? 'saliente' : (r.direccion || 'entrante'),
            id: r.id || undefined,
          }));
        } else if (typeof m.reacciones === 'string') {
          try {
            const parsed = JSON.parse(m.reacciones);
            if (Array.isArray(parsed)) {
              reaccionesNormalizadas = parsed.map((r: any) => ({
                emoji: r.emoji,
                direccion: r.de_mi ? 'saliente' : (r.direccion || 'entrante'),
                id: r.id || undefined,
              }));
            }
          } catch {}
        }

        return {
          ...m,
          tipo_contenido: tipoContenido,
          plantilla: plantillaInfo,
          reacciones: reaccionesNormalizadas,
        };
      });

      return NextResponse.json({ exito: true, mensajes: mensajesEnriquecidos });
    }

    // Marcar leído: conversaciones/:id/marcar-leido
    if (metodo === 'POST' && segmentosRuta[0] === 'conversaciones' && segmentosRuta[2] === 'marcar-leido') {
      const conversacion_id = segmentosRuta[1];
      await base_datos.prepare('UPDATE conversaciones SET mensajes_no_leidos = 0, ultimo_leido_en = now() WHERE id = ?').run(conversacion_id);
      const conv = await base_datos.prepare('SELECT * FROM conversaciones WHERE id = ?').get(conversacion_id);
      if (conv && conv.id_conversacion_zernio && conv.id_cuenta_zernio) {
        try {
          const cliente = new ClienteZernio();
          await cliente.solicitar(`/inbox/conversations/${conv.id_conversacion_zernio}/read`, {
            metodo: 'POST',
            cuerpo: { accountId: conv.id_cuenta_zernio },
            sin_reintentos: true,
          });
        } catch {}
      }
      return NextResponse.json({ exito: true });
    }

    // Enviar mensaje
    if (metodo === 'POST' && rutaStr === 'mensajes/enviar') {
      const { usar_plantilla, nombre_plantilla, idioma_plantilla, componentes_plantilla } = body;
      if (usar_plantilla || nombre_plantilla) {
        let plantilla_aprobada = null;
        if (nombre_plantilla) {
          plantilla_aprobada = await base_datos.prepare(`
            SELECT * FROM plantillas 
            WHERE (nombre = ? OR etiqueta = ?) AND (estado = 'APPROVED' OR estado = 'APROBADA')
            LIMIT 1
          `).get(nombre_plantilla, nombre_plantilla);
        }
        if (!plantilla_aprobada && usar_plantilla) {
          plantilla_aprobada = await base_datos.prepare(`
            SELECT * FROM plantillas 
            WHERE estado = 'APPROVED' OR estado = 'APROBADA'
            ORDER BY (CASE WHEN nombre = 'optica_digital' THEN 1 ELSE 2 END), id ASC LIMIT 1
          `).get();
        }

        if (plantilla_aprobada) {
          body.nombre_plantilla = plantilla_aprobada.nombre;
          body.idioma_plantilla = idioma_plantilla || plantilla_aprobada.idioma || 'es';
          if (!body.texto || body.texto.trim() === '') {
            body.texto = `[Template: ${plantilla_aprobada.nombre}]`;
          }
        }
      }

      const resultado = await enviar_mensaje(body);
      if (!resultado.exito) {
        return NextResponse.json(resultado, { status: 400 });
      }
      return NextResponse.json(resultado);
    }

    // 4. CONTACTOS Y PACIENTES
    if (metodo === 'GET' && rutaStr === 'contactos') {
      const contactos = await base_datos.prepare(`
        SELECT 
          c.*, c.nombre_completo AS nombre,
          COALESCE(c.es_paciente, false) AS es_paciente,
          CAST((SELECT COUNT(*) FROM formulas_opticas WHERE contacto_id = c.id) AS INTEGER) AS total_formulas,
          CAST((SELECT COUNT(*) FROM citas WHERE contacto_id = c.id) AS INTEGER) AS total_citas,
          (SELECT fecha_examen FROM formulas_opticas WHERE contacto_id = c.id ORDER BY id DESC LIMIT 1) AS ultima_formula_fecha,
          (SELECT tipo_lente FROM formulas_opticas WHERE contacto_id = c.id ORDER BY id DESC LIMIT 1) AS ultimo_tipo_lente
        FROM contactos c
        WHERE c.optica_id = ?
        ORDER BY LOWER(TRIM(COALESCE(c.nombre_completo, ''))) ASC, c.actualizado_en DESC
      `).all(optica_id);
      return NextResponse.json({ exito: true, contactos });
    }

    if (metodo === 'POST' && rutaStr === 'contactos') {
      const { nombre, nombre_completo, tipo_documento = 'CC', cedula, documento, telefono, correo, edad, sexo = 'masculino', es_paciente = true } = body;
      const nombreFinal = String(nombre_completo || nombre || '').trim();
      const doc = String(cedula || documento || '').trim();
      const sexoFinal = sexo ? String(sexo).trim().toLowerCase() : 'masculino';

      if (!nombreFinal) {
        return NextResponse.json({ exito: false, error: 'El nombre completo es obligatorio' }, { status: 400 });
      }

      let existente = null;
      if (doc) {
        existente = await base_datos.prepare('SELECT * FROM contactos WHERE optica_id = ? AND TRIM(cedula) = TRIM(?)').get(optica_id, doc);
      }
      if (!existente && telefono && String(telefono).trim()) {
        existente = await base_datos.prepare('SELECT * FROM contactos WHERE optica_id = ? AND TRIM(telefono) = TRIM(?)').get(optica_id, String(telefono).trim());
      }

      if (existente) {
        await base_datos.prepare(`
          UPDATE contactos SET 
            nombre_completo = COALESCE(?, nombre_completo),
            tipo_documento = COALESCE(?, tipo_documento),
            cedula = COALESCE(?, cedula),
            telefono = COALESCE(?, telefono),
            correo = COALESCE(?, correo),
            edad = COALESCE(?, edad),
            sexo = COALESCE(?, sexo),
            es_paciente = ?,
            actualizado_en = datetime('now')
          WHERE id = ?
        `).run(nombreFinal, tipo_documento ? String(tipo_documento).trim().toUpperCase() : 'CC', doc || null, telefono ? String(telefono).trim() : null, correo ? String(correo).trim() : null, edad ? Number(edad) : null, sexoFinal, Boolean(es_paciente), existente.id);
        const actualizado = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(existente.id);
        return NextResponse.json({ exito: true, contacto: actualizado, actualizado: true });
      }

      const insercion = await base_datos.prepare(`
        INSERT INTO contactos (optica_id, nombre_completo, tipo_documento, cedula, telefono, correo, edad, sexo, es_paciente)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(optica_id, nombreFinal, tipo_documento ? String(tipo_documento).trim().toUpperCase() : 'CC', doc || null, telefono ? String(telefono).trim() : null, correo ? String(correo).trim() : null, edad ? Number(edad) : null, sexoFinal, Boolean(es_paciente));

      const nuevo = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(insercion.lastInsertRowid);
      return NextResponse.json({ exito: true, contacto: nuevo, creado: true });
    }

    if (metodo === 'GET' && segmentosRuta[0] === 'contactos' && segmentosRuta.length === 2) {
      const contactoId = segmentosRuta[1];
      const contacto = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(contactoId);
      if (!contacto) {
        return NextResponse.json({ exito: false, mensaje: 'Paciente no encontrado' }, { status: 404 });
      }
      const formulas = await base_datos.prepare(`
        SELECT 
          id, contacto_id, fecha_examen,
          od_esfera AS esfera_od, od_cilindro AS cilindro_od, od_eje AS eje_od, od_adicion AS adicion_od, od_agudeza_visual AS av_od,
          oi_esfera AS esfera_oi, oi_cilindro AS cilindro_oi, oi_eje AS eje_oi, oi_adicion AS adicion_oi, oi_agudeza_visual AS av_oi,
          distancia_pupilar, tipo_lente, observaciones, optometra, proximo_control AS proximo_control_en_meses, creado_en
        FROM formulas_opticas WHERE contacto_id = ? ORDER BY id DESC
      `).all(contactoId);
      const citas = await base_datos.prepare('SELECT * FROM citas WHERE contacto_id = ? ORDER BY fecha_cita DESC, hora_cita DESC').all(contactoId);
      return NextResponse.json({ exito: true, contacto, formulas, citas });
    }

    if (metodo === 'PUT' && segmentosRuta[0] === 'contactos' && segmentosRuta.length === 2) {
      const id = Number(segmentosRuta[1]);
      const actual = await base_datos.prepare('SELECT * FROM contactos WHERE id = ?').get(id);
      if (!actual) return NextResponse.json({ exito: false, error: 'Contacto no encontrado' }, { status: 404 });

      const { nombre, nombre_completo, tipo_documento, cedula, documento, telefono, correo, edad, sexo, es_paciente } = body;
      const nombreFinal = nombre_completo !== undefined ? nombre_completo : nombre;
      const doc = cedula !== undefined ? cedula : documento;

      await base_datos.prepare(`
        UPDATE contactos SET 
          nombre_completo = ?, tipo_documento = ?, cedula = ?, telefono = ?, correo = ?, edad = ?, sexo = ?, es_paciente = ?, actualizado_en = datetime('now')
        WHERE id = ?
      `).run(
        nombreFinal !== undefined ? (nombreFinal ? String(nombreFinal).trim() : null) : actual.nombre_completo,
        tipo_documento !== undefined ? (tipo_documento ? String(tipo_documento).trim().toUpperCase() : 'CC') : (actual.tipo_documento || 'CC'),
        doc !== undefined ? (doc ? String(doc).trim() : null) : actual.cedula,
        telefono !== undefined ? (telefono ? String(telefono).trim() : null) : actual.telefono,
        correo !== undefined ? (correo ? String(correo).trim() : null) : actual.correo,
        edad !== undefined ? (edad ? Number(edad) : null) : actual.edad,
        sexo !== undefined ? (sexo ? String(sexo).trim().toLowerCase() : 'masculino') : (actual.sexo || 'masculino'),
        es_paciente !== undefined ? Boolean(es_paciente) : actual.es_paciente,
        id
      );

      const actualizado = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(id);
      return NextResponse.json({ exito: true, contacto: actualizado });
    }

    // 5. FÓRMULAS
    if (metodo === 'POST' && (rutaStr === 'formulas' || (segmentosRuta[0] === 'contactos' && segmentosRuta[2] === 'formulas'))) {
      const contacto_id = segmentosRuta[1] || body.contacto_id;
      if (!contacto_id) return NextResponse.json({ exito: false, error: 'contacto_id es obligatorio' }, { status: 400 });

      const {
        esfera_od, od_esfera, cilindro_od, od_cilindro, eje_od, od_eje, adicion_od, od_adicion, av_od, od_agudeza_visual,
        esfera_oi, oi_esfera, cilindro_oi, oi_cilindro, eje_oi, oi_eje, adicion_oi, oi_adicion, av_oi, oi_agudeza_visual,
        distancia_pupilar, tipo_lente, observaciones, optometra, proximo_control, proximo_control_en_meses, fecha_examen,
      } = body;

      const insercion = await base_datos.prepare(`
        INSERT INTO formulas_opticas (
          contacto_id, optica_id, od_esfera, od_cilindro, od_eje, od_adicion, od_agudeza_visual,
          oi_esfera, oi_cilindro, oi_eje, oi_adicion, oi_agudeza_visual, distancia_pupilar, tipo_lente,
          observaciones, optometra, fecha_examen, proximo_control
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        contacto_id, optica_id,
        esfera_od ?? od_esfera ?? '+0.00', cilindro_od ?? od_cilindro ?? '-0.00', eje_od ?? od_eje ?? '0', adicion_od ?? od_adicion ?? '+0.00', av_od ?? od_agudeza_visual ?? '20/20',
        esfera_oi ?? oi_esfera ?? '+0.00', cilindro_oi ?? oi_cilindro ?? '-0.00', eje_oi ?? oi_eje ?? '0', adicion_oi ?? oi_adicion ?? '+0.00', av_oi ?? oi_agudeza_visual ?? '20/20',
        distancia_pupilar || '62 mm', tipo_lente || 'Monofocal Antirreflejo', observaciones || null, optometra || 'Dr. Samir Bolívar',
        fecha_examen ? fecha_examen.split('T')[0] : new Date().toISOString().split('T')[0],
        proximo_control_en_meses ? String(proximo_control_en_meses) : (proximo_control || '12')
      );

      await base_datos.prepare("UPDATE contactos SET actualizado_en = datetime('now') WHERE id = ?").run(contacto_id);
      return NextResponse.json({ exito: true, formula_id: Number(insercion.lastInsertRowid) });
    }

    // 6. CITAS
    if (metodo === 'GET' && rutaStr === 'citas') {
      const fecha_inicio = searchParams.get('fecha_inicio');
      const fecha_fin = searchParams.get('fecha_fin');
      const estado = searchParams.get('estado');
      const especialista = searchParams.get('especialista');

      let consulta = `
        SELECT c.*, COALESCE(c.estado, 'pendiente') AS estado,
          co.nombre_completo AS contacto_nombre, co.telefono AS contacto_telefono, co.correo AS contacto_correo
        FROM citas c LEFT JOIN contactos co ON co.id = c.contacto_id WHERE c.optica_id = ?
      `;
      const paramsSql: any[] = [optica_id];

      if (fecha_inicio && fecha_fin) {
        consulta += ` AND c.fecha_cita >= ? AND c.fecha_cita <= ?`;
        paramsSql.push(fecha_inicio, fecha_fin);
      } else if (fecha_inicio) {
        consulta += ` AND c.fecha_cita = ?`;
        paramsSql.push(fecha_inicio);
      }

      if (estado && estado !== 'todos') {
        consulta += ` AND c.estado = ?`;
        paramsSql.push(estado);
      }

      if (especialista && especialista !== 'todos') {
        consulta += ` AND c.especialista = ?`;
        paramsSql.push(especialista);
      }

      consulta += ` ORDER BY c.fecha_cita ASC, c.hora_cita ASC, c.id ASC`;
      const citas = await base_datos.prepare(consulta).all(...paramsSql);
      return NextResponse.json({ exito: true, citas: citas || [] });
    }

    if (metodo === 'POST' && (rutaStr === 'citas' || (segmentosRuta[0] === 'contactos' && segmentosRuta[2] === 'citas'))) {
      const contacto_id = segmentosRuta[1] || body.contacto_id;
      if (!contacto_id) return NextResponse.json({ exito: false, error: 'contacto_id es obligatorio' }, { status: 400 });

      const { fecha_cita, hora_cita, motivo, especialista, observaciones } = body;
      if (!fecha_cita || !hora_cita) return NextResponse.json({ exito: false, error: 'Fecha y hora requeridas' }, { status: 400 });

      const citaExistente = await base_datos.prepare(`
        SELECT id FROM citas 
        WHERE contacto_id = ? AND TRIM(fecha_cita) = TRIM(?) AND LOWER(TRIM(hora_cita)) = LOWER(TRIM(?))
          AND (estado IS NULL OR estado NOT IN ('cancelada', 'anulada'))
      `).get(contacto_id, fecha_cita, hora_cita);

      if (citaExistente) {
        return NextResponse.json({ exito: false, duplicada: true, error: 'Este paciente ya tiene una cita para esa fecha y hora.' }, { status: 409 });
      }

      const insercion = await base_datos.prepare(`
        INSERT INTO citas (contacto_id, optica_id, fecha_cita, hora_cita, motivo, especialista, observaciones)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(contacto_id, optica_id, fecha_cita, hora_cita, motivo || 'Examen visual y control', especialista || null, observaciones || null);

      await base_datos.prepare("UPDATE contactos SET actualizado_en = datetime('now') WHERE id = ?").run(contacto_id);
      return NextResponse.json({ exito: true, cita_id: Number(insercion.lastInsertRowid) });
    }

    if (metodo === 'PUT' && segmentosRuta[0] === 'citas' && segmentosRuta.length === 2) {
      const idCita = Number(segmentosRuta[1]);
      const citaActual = await base_datos.prepare('SELECT * FROM citas WHERE id = ?').get(idCita);
      if (!citaActual) return NextResponse.json({ exito: false, error: 'Cita no encontrada' }, { status: 404 });

      const { fecha_cita, hora_cita, motivo, especialista, observaciones, estado } = body;
      const nuevaFecha = fecha_cita || citaActual.fecha_cita;
      const nuevaHora = hora_cita || citaActual.hora_cita;
      const nuevoEstado = estado || citaActual.estado || 'pendiente';

      if (nuevoEstado !== 'cancelada' && (fecha_cita || hora_cita)) {
        const conflicto = await base_datos.prepare(`
          SELECT id FROM citas 
          WHERE contacto_id = ? AND TRIM(fecha_cita) = TRIM(?) AND LOWER(TRIM(hora_cita)) = LOWER(TRIM(?)) AND id != ?
            AND (estado IS NULL OR estado NOT IN ('cancelada', 'anulada'))
        `).get(citaActual.contacto_id, nuevaFecha, nuevaHora, idCita);
        if (conflicto) return NextResponse.json({ exito: false, duplicada: true, error: 'Horario ocupado' }, { status: 409 });
      }

      await base_datos.prepare(`
        UPDATE citas SET fecha_cita = ?, hora_cita = ?, motivo = ?, especialista = ?, observaciones = ?, estado = ? WHERE id = ?
      `).run(nuevaFecha, nuevaHora, motivo ?? citaActual.motivo, especialista ?? citaActual.especialista, observaciones ?? citaActual.observaciones, nuevoEstado, idCita);

      const citaActualizada = await base_datos.prepare('SELECT * FROM citas WHERE id = ?').get(idCita);
      return NextResponse.json({ exito: true, cita: citaActualizada });
    }

    if (metodo === 'DELETE' && segmentosRuta[0] === 'citas' && segmentosRuta.length === 2) {
      const idCita = Number(segmentosRuta[1]);
      await base_datos.prepare("UPDATE citas SET estado = 'cancelada' WHERE id = ?").run(idCita);
      return NextResponse.json({ exito: true, mensaje: 'Cita cancelada' });
    }

    // 7. AUTO-SEGMENTACIÓN
    if (metodo === 'GET' && rutaStr === 'segmentos') {
      const resultado = await obtenerSegmentosConConteo(optica_id);
      return NextResponse.json({ exito: true, ...resultado });
    }

    if (metodo === 'GET' && segmentosRuta[0] === 'segmentos' && segmentosRuta[2] === 'pacientes') {
      const resultado = await obtenerPacientesDeSegmento(segmentosRuta[1], optica_id);
      return NextResponse.json({ exito: true, ...resultado });
    }

    if (metodo === 'POST' && rutaStr === 'segmentos') {
      const nuevo = await crearSegmentoPersonalizado({ opticaId: optica_id, ...body });
      return NextResponse.json({ exito: true, segmento: nuevo }, { status: 201 });
    }

    if (metodo === 'PUT' && segmentosRuta[0] === 'segmentos' && segmentosRuta.length === 2) {
      const actualizado = await actualizarSegmentoPersonalizado({ idSegmento: segmentosRuta[1], opticaId: optica_id, ...body });
      return NextResponse.json({ exito: true, segmento: actualizado });
    }

    if (metodo === 'DELETE' && segmentosRuta[0] === 'segmentos' && segmentosRuta.length === 2) {
      const resultado = await eliminarSegmentoPersonalizado(segmentosRuta[1], optica_id);
      return NextResponse.json(resultado);
    }

    // 8. PLANTILLAS Y LOTES
    if (metodo === 'GET' && rutaStr === 'plantillas') {
      const plantillas = await obtenerPlantillas(optica_id);
      const cuota = await obtenerCuotaDiaria(optica_id);
      return NextResponse.json({ exito: true, plantillas, cuota });
    }

    if (metodo === 'POST' && rutaStr === 'plantillas') {
      const nueva = await crearPlantilla(optica_id, body);
      return NextResponse.json({ exito: true, plantilla: nueva });
    }

    if (metodo === 'POST' && rutaStr === 'plantillas/sincronizar-meta') {
      const resultado = await sincronizarPlantillasConZernio(optica_id);
      const plantillas = await obtenerPlantillas(optica_id);
      const cuota = await obtenerCuotaDiaria(optica_id);
      return NextResponse.json({ ...resultado, plantillas, cuota });
    }

    if (metodo === 'GET' && rutaStr === 'plantillas/cuota-diaria') {
      const cuota = await obtenerCuotaDiaria(optica_id);
      return NextResponse.json({ exito: true, cuota });
    }

    if (metodo === 'POST' && rutaStr === 'plantillas/calcular-lote') {
      const resultado = await calcularAudienciaLote(optica_id, body);
      return NextResponse.json(resultado);
    }

    if (metodo === 'POST' && rutaStr === 'plantillas/lanzar-lote') {
      const resultado = await lanzarLoteCampana(optica_id, body);
      return NextResponse.json(resultado);
    }

    if (metodo === 'GET' && rutaStr === 'plantillas/historial-lotes') {
      const historial = await obtenerHistorialLotes(optica_id);
      return NextResponse.json({ exito: true, historial });
    }

    if (metodo === 'DELETE' && segmentosRuta[0] === 'plantillas' && segmentosRuta[1] === 'lotes' && segmentosRuta.length === 3) {
      const resultado = await eliminarLoteCampana(optica_id, segmentosRuta[2]);
      return NextResponse.json(resultado);
    }

    // 9. CANALES Y CONFIGURACIÓN
    if (metodo === 'GET' && rutaStr === 'canales/estado') {
      const resultado = await obtener_canales_optica(optica_id);
      return NextResponse.json(resultado);
    }

    if (metodo === 'GET' && rutaStr === 'canales/conectar/whatsapp') {
      const redirect_url = searchParams.get('redirect_url') || `${request.nextUrl.origin}/api/canales/callback`;
      const resultado = await obtener_url_conexion_whatsapp(optica_id, redirect_url);
      return NextResponse.json(resultado);
    }

    if (metodo === 'POST' && rutaStr === 'canales/vincular') {
      const resultado = await vincular_cuenta_whatsapp_activa(optica_id);
      return NextResponse.json(resultado);
    }

    if (metodo === 'POST' && rutaStr === 'canales/reconectar') {
      const resultado = await reconectar_canal_whatsapp(optica_id);
      return NextResponse.json(resultado);
    }

    if (metodo === 'POST' && rutaStr === 'canales/desconectar') {
      const resultado = await desconectar_canal_whatsapp(optica_id, body);
      return NextResponse.json(resultado);
    }

    if (metodo === 'PUT' && rutaStr === 'configuracion/optica') {
      const resultado = await actualizar_datos_optica(optica_id, body);
      return NextResponse.json(resultado, { status: resultado.exito ? 200 : 400 });
    }

    if (metodo === 'POST' && rutaStr === 'configuracion/optica/logo') {
      const { imagen_base64, tipo_mime, nombre_archivo } = body;
      if (!imagen_base64) return NextResponse.json({ exito: false, error: 'Imagen requerida' }, { status: 400 });
      const base64Limpio = imagen_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Limpio, 'base64');
      const resultado = await subirLogoStorage(optica_id, {
        buffer,
        tipo_mime: tipo_mime || 'image/png',
        nombre_original: nombre_archivo || 'logo.png',
      });
      return NextResponse.json(resultado);
    }

    return NextResponse.json(
      { exito: false, error: `Ruta no encontrada: ${metodo} /api/${rutaStr}` },
      { status: 404 }
    );
  } catch (err: any) {
    console.error(`Error procesando API [${metodo} /api/${rutaStr}]:`, err);
    return NextResponse.json({ exito: false, error: err?.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await context.params;
  return procesarPeticion('GET', request, ruta);
}

export async function POST(request: NextRequest, context: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await context.params;
  return procesarPeticion('POST', request, ruta);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await context.params;
  return procesarPeticion('PUT', request, ruta);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await context.params;
  return procesarPeticion('DELETE', request, ruta);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await context.params;
  return procesarPeticion('PATCH', request, ruta);
}
